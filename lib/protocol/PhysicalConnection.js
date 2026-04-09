// Copyright 2026 SAP AG.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http: //www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
// either express or implied. See the License for the specific
// language governing permissions and limitations under the License.

const {Location, INVALID_VOLUME_ID} = require("./ConnectionTopology");
const MessageBuffer = require("./MessageBuffer");
const compressor = require("./Compressor");
const common = require("./common");
const request = require("./request");
const bignum = require("../util").bignum;

// Constants
const INVALID_CLIENTCONNECTION_ID = 0;
const MIN_COMPRESS_PKT_LEN = common.MIN_COMPRESS_PKT_LEN;
const PACKET_HEADER_LENGTH = common.PACKET_HEADER_LENGTH;
const MessageType = common.MessageType;

class Version {
  constructor(major, minor) {
    this.major = major;
    this.minor = minor;
  }

  static read(buffer, offset) {
    return new Version(
      buffer.readInt8(offset),
      buffer.readInt16LE(offset + 1)
    );
  }
}

class InitializationReply {
  static LENGTH = 8;

  constructor(productVersion, protocolVersion) {
    this.productVersion = productVersion;
    this.protocolVersion = protocolVersion;
  }

  static read(buffer) {
    return new InitializationReply(
      Version.read(buffer, 0),
      Version.read(buffer, 3)
    );
  }
}

const initializationRequestBuffer = Buffer.from([
  0xff, 0xff, 0xff, 0xff, 4, 20, 0, 4, 1, 0, 0, 1, 1, 1,
]);

class PhysicalConnection {
  constructor(clientConnectionId, location) {
    this._clientConnectionId = clientConnectionId;
    this._location = location;
    this._ownLocation = false;
    this._sessionId = 0;
    this._serverConnectionId = -1;

    this._socket = undefined;
    this._compressionEnabled = false;
    this.protocolVersion = undefined;
    this._packetCount = -1;
    this._handshakeReceive = undefined; // reply cb for AUTHENTICATE/CONNECT
  }

  /**
   * Open the physical connection: TCP connect + HDB init handshake.
   * @param {object} options  Connection options (host, port, initializationTimeout, …)
   * @param {function} connectFn  Injectable TCP connect function (tcp.connect or mock)
   * @param {function} cb  Callback(err)
   */
  open(options, connectFn, cb) {
    const self = this;
    const initializationTimeout = options.initializationTimeout || 5000;
    let timeoutObject = null;

    function invalidInitializationReply() {
      const err = new Error("Invalid initialization reply");
      err.code = "EHDBINIT";
      return err;
    }

    function initializationTimeoutError() {
      const seconds = Math.round(initializationTimeout / 1000);
      const err = new Error("No initialization reply received within " + seconds + " sec");
      err.code = "EHDBTIMEOUT";
      return err;
    }

    function cleanup() {
      clearTimeout(timeoutObject);
      self._socket.removeListener("error", onerror);
      self._socket.removeListener("data", ondata);
    }

    function onerror(err) {
      cleanup();
      self._socket.destroy();
      cb(err);
    }

    function ondata(chunk) {
      cleanup();
      if (!chunk || chunk.length < InitializationReply.LENGTH) {
        return cb(invalidInitializationReply());
      }
      const reply = InitializationReply.read(chunk, 0);
      self.protocolVersion = reply.protocolVersion;
      cb();
    }

    connectFn(options, function connectListener(err, socket) {
      if (err) {
        cb(err);
        return;
      }

      self._socket = socket;
      self._socket.once("error", onerror);
      self._socket.on("data", ondata);

      timeoutObject = setTimeout(onerror, initializationTimeout, initializationTimeoutError());
      self._socket.write(initializationRequestBuffer);
    });
  }

  /**
   * Wire permanent socket event listeners after handshake.
   * Decompresses incoming packets before passing the buffer to onData.
   * @param {function} onData   Called with (buffer, sessionId) for each complete packet
   * @param {function} onError  Called with (err) for socket errors
   * @param {function} onClose  Called with (hadError) when socket closes
   * @param {function} onEnd    Called with (err) when server sends TCP FIN (graceful close)
   */
  _addListeners(onData, onError, onClose, onEnd) {
    const self = this;
    const socket = this._socket;
    const packet = new MessageBuffer();

    function cleanup() {
      socket.removeListener("error", onError);
      socket.removeListener("data", ondataHandler);
      socket.removeListener("close", oncloseHandler);
    }

    function ondataHandler(chunk) {
      packet.push(chunk);
      if (packet.isReady()) {
        const header = packet.header;
        self._sessionId = header.sessionId;
        let buffer = packet.getData();
        if (self._compressionEnabled && compressor.isPacketCompressed(header.packetOptions)) {
          buffer = compressor.decompress(buffer, header.compressionVarpartLength);
        }
        packet.clear();
        onData(buffer, self._sessionId);
      }
    }
    socket.on("data", ondataHandler);
    socket.on("error", onError);

    function oncloseHandler(hadError) {
      cleanup();
      onClose(hadError);
    }
    socket.on("close", oncloseHandler);

    function onendHandler() {
      const err = new Error("Connection closed by server");
      err.code = "EHDBCLOSE";
      onEnd(err);
    }
    socket.on("end", onendHandler);
  }

  /**
   * Authenticate this physical connection: drives the AUTHENTICATE→CONNECT
   * two-packet exchange on this socket using per-pconn state.
   * @param {object} conn  The logical Connection (for state, settings, options)
   * @param {object} manager  Auth manager (initialData/finalData/initialize/finalize)
   * @param {object} authOptions  Options for request.authenticate()
   * @param {function} cb  Callback(err, reply)
   */
  authenticate(conn, manager, authOptions, cb) {
    const self = this;

    function connReceive(err, reply) {
      if (err) {
        return cb(err);
      }
      if (Array.isArray(reply.connectOptions)) {
        conn.connectOptions.setOptions(reply.connectOptions);
        if (compressor.lz4Available &&
            compressor.isLZ4CompressionNegotiated(conn.connectOptions.compressionLevelAndFlags)) {
          self._compressionEnabled = true;
        }
      }
      manager.finalize(reply.authentication);
      conn._settings.user = manager.userFromServer;
      if (manager.sessionCookie) {
        conn._settings.sessionCookie = manager.sessionCookie;
      }
      cb(null, reply);
    }

    function authReceive(err, reply) {
      if (err) {
        return cb(err, reply);
      }
      manager.initialize(reply.authentication, function (err) {
        if (err) {
          return cb(err);
        }
        var redirectOptions = [];
        if (typeof conn._initialHost === "undefined") {
          conn._initialHost = conn.host;
        }
        if (typeof conn._initialPort === "undefined") {
          conn._initialPort = conn.port;
        }
        redirectOptions.push({
          name: common.ConnectOption.ENDPOINT_HOST,
          value: conn._initialHost,
        });
        redirectOptions.push({
          name: common.ConnectOption.ENDPOINT_PORT,
          value: conn._initialPort,
        });
        var endpointList = undefined;
        if (typeof conn._initialHost !== "undefined" && typeof conn._initialPort !== "undefined") {
          endpointList = conn._initialHost + ":" + conn._initialPort.toString();
        }
        redirectOptions.push({
          name: common.ConnectOption.ENDPOINT_LIST,
          value: endpointList,
        });
        redirectOptions.push({
          name: common.ConnectOption.REDIRECTION_TYPE,
          value: conn._redirectType,
        });
        if (typeof conn._redirectHost === "undefined") {
          conn._redirectHost = conn._initialHost;
        }
        redirectOptions.push({
          name: common.ConnectOption.REDIRECTED_HOST,
          value: conn._redirectHost,
        });
        if (typeof conn._redirectPort === "undefined") {
          conn._redirectPort = conn._initialPort;
        }
        redirectOptions.push({
          name: common.ConnectOption.REDIRECTED_PORT,
          value: conn._redirectPort,
        });
        conn.connectOptions.setOptions(redirectOptions);

        const connectMsg = request.connect({
          authentication: manager.finalData(),
          clientId: conn.clientId,
          connectOptions: conn.connectOptions.getOptions(),
          useCesu8: conn.useCesu8,
        });
        conn._state.messageType = MessageType.CONNECT;
        self._handshakeReceive = connReceive;
        self.send(connectMsg, conn.packetSizeLimit);
      });
    }

    const authMsg = request.authenticate(authOptions);
    conn._state.messageType = MessageType.AUTHENTICATE;
    self._handshakeReceive = authReceive;
    self.send(authMsg, conn.packetSizeLimit);
  }

  /**
   * Build a packet from message and write it to the socket, applying compression if appropriate.
   * @param {object} message Request segment (has .toBuffer() and .type)
   * @param {number} packetSizeLimit Max packet size from logical connection
   */
  send(message, packetSizeLimit) {
    if (!this._socket) {
      return;
    }
    const messageType = message.type;
    const size = packetSizeLimit - PACKET_HEADER_LENGTH;
    const buffer = message.toBuffer(size);
    if (buffer.length > size) {
      return new Error('Packet size limit exceeded');
    }
    const packet = Buffer.alloc(PACKET_HEADER_LENGTH + buffer.length);
    buffer.copy(packet, PACKET_HEADER_LENGTH);
    // Session identifier
    bignum.writeUInt64LE(packet, this._sessionId, 0);
    // Packet sequence number in this session
    // Packets with the same sequence number belong to one request / reply pair
    this._packetCount++;
    packet.writeUInt32LE(this._packetCount, 8);
    // Used space in this packet
    packet.writeUInt32LE(buffer.length, 12);
    // Total space in this packet
    packet.writeUInt32LE(size, 16);
    // Number of segments in this packet
    packet.writeUInt16LE(1, 20);
    // Filler
    packet.fill(0x00, 22, PACKET_HEADER_LENGTH);

    if (messageType !== common.MessageType.AUTHENTICATE &&
        messageType !== common.MessageType.CONNECT &&
        this._compressionEnabled &&
        packet.length > MIN_COMPRESS_PKT_LEN) {
      // finalPacket will be compressed if compression is effective:
      //  * compressedPacket.length < 0.95 * packet.length => compressed packet
      //  * compressedPacket.length >= 0.95 * packet.length => uncompressed packet
      this._socket.write(compressor.compress(packet));
    } else {
      this._socket.write(packet);
    }
  }

  /**
   * Destroy the underlying socket.
   * @param {Error} [err]
   */
  destroy(err) {
    if (this._socket) {
      this._socket.destroy(err);
    }
  }

  close() {
    if (this._socket) {
      this._socket.destroy();
    }
  }

  isConnected() {
    return this._socket && this._socket.readyState === "open" && !!this.protocolVersion;
  }
}

class PhysicalConnectionSet {
  constructor(conn) {
    // linked logic connection
    this._conn = conn;
    // anchor connection's client connection id
    this._anchorConnection = INVALID_CLIENTCONNECTION_ID;
    // anchor connection's volume id
    this._anchorConnectionVolumeId = INVALID_VOLUME_ID;
    // all connections: Map<clientConnectionId, physicalConnection>
    this._connections = new Map();
  }

  /**
   * Register a physical connection as the anchor connection and add it to the set.
   * Must only be called once per logical connection.
   * @param {PhysicalConnection} pconn
   */
  addAnchorConnection(pconn) {
    this._anchorConnection = pconn._clientConnectionId;
    this._anchorConnectionVolumeId = pconn._location
      ? pconn._location._volumeId
      : undefined;
    this.addConnection(pconn);
  }

  /**
   * Add a physical connection (anchor or secondary) to the set.
   * @param {PhysicalConnection} pconn
   */
  addConnection(pconn) {
    this._connections.set(pconn._clientConnectionId, pconn);
  }

  /**
   * Retrieve a physical connection by client connection id.
   * @param {number} clientConnectionId
   * @returns {PhysicalConnection|undefined}
   */
  getConnection(clientConnectionId) {
    return this._connections.get(clientConnectionId);
  }

  /**
   * Retrieve the anchor physical connection.
   * @returns {PhysicalConnection|undefined}
   */
  getAnchorConnection() {
    return this.getConnection(this._anchorConnection);
  }

  /**
   * Remove a physical connection from the set by client connection id.
   * @param {number} clientConnectionId
   */
  removeConnection(clientConnectionId) {
    this._connections.delete(clientConnectionId);
  }

  /**
   * Return the number of physical connections currently in the set.
   * @returns {number}
   */
  size() {
    return this._connections.size;
  }

  closeAll() {
    this._anchorConnection = INVALID_CLIENTCONNECTION_ID;
    this._anchorConnectionVolumeId = INVALID_VOLUME_ID;
    this._connections.forEach(pconn => {
      pconn.close();
    });
    this._connections.clear();
  }
}

module.exports = {
  PhysicalConnection,
  PhysicalConnectionSet,
};
