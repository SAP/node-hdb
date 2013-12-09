// Copyright 2013 SAP AG.
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
'use strict';

var net = require('net');
var os = require('os');
var EventEmitter = require('events').EventEmitter;
var auth = require('./auth');
var util = require('../util');
var common = require('./common');
var request = require('./request');
var reply = require('./reply');
var ReplySegment = reply.Segment;
var MessageType = common.MessageType;
var MessageTypeName = common.MessageTypeName;
var SegmentKind = common.SegmentKind;
var bignum = util.bignum;
var debug = util.debuglog('hdb');
var trace = util.tracelog();

var MAX_PACKET_SIZE = common.MAX_PACKET_SIZE;
var PACKET_HEADER_LENGTH = common.PACKET_HEADER_LENGTH;

module.exports = Connection;

util.inherits(Connection, EventEmitter);

function Connection() {
  EventEmitter.call(this);

  var pid = process.pid || 'nodejs';
  this.clientId = [pid, os.hostname()].join('@');
  this.connectOptions = common.DEFAULT_CONNECT_OPTIONS.slice(0);
  this._socket = undefined;
  this._protocolVersion = undefined;
  this._queue = new util.Queue().pause();
  this._state = new ConnectionState();
}

Object.defineProperties(Connection.prototype, {
  readyState: {
    get: function getReadyState() {
      // no state ==> socket must be closed
      if (!this._state) {
        return 'closed';
      }
      // no socket ==> open has not been called 
      if (!this._socket) {
        return 'new';
      }
      // socket is closed ==> socket ended but not closed
      if (this._socket.readyState === 'closed') {
        return 'closed';
      }
      // no protocol version ==> open not yet finished
      if (!this._protocolVersion) {
        return 'opening';
      }
      switch (this._state.messageType) {
      case MessageType.AUTHENTICATE:
      case MessageType.CONNECT:
        return 'connecting';
      case MessageType.DISCONNECT:
        return 'disconnecting';
      }
      if (this._state.sessionId === -1) {
        return 'disconnected';
      }
      return 'connected';
    }
  }
});

Connection.prototype.open = function open(options, cb) {
  var self = this;

  if (this._socket) {
    return cb(new Error('Call open only once'));
  }

  function done(err) {
    if (err) {
      self.emit('error', err);
    } else {
      self.emit('open');
    }
    if (util.isFunction(cb)) {
      cb(err);
    }
  }

  function onready(err, protocolVersion) {
    if (err) {
      return done(err);
    }
    self._protocolVersion = protocolVersion;
    self._initConnection();
    done(null);
  }
  this._socket = this._createSocket(options);
  this._initSocket(this._socket, onready);
};

Connection.prototype._createSocket = function _createSocket(options) {
  var socket = net.connect(util.extend(options, {
    allowHalfOpen: false
  }));
  socket.setNoDelay(true);
  return socket;
};

Connection.prototype._initSocket = function _initSocket(socket, cb) {
  function cleanup() {
    socket.removeListener('error', onerror);
    socket.removeListener('data', ondata);
    socket.removeListener('connect', onconnect);
  }

  function onconnect() {
    socket.write(initializationRequestBuffer);
  }
  socket.on('connect', onconnect);

  function ondata(chunk) {
    cleanup();
    if (!chunk || chunk.length < InitializationReply.LENGTH) {
      var err = new Error('Invalid initialization reply');
      err.code = 'EHDBINIT';
      return cb(err);
    }
    cb(null, InitializationReply.read(chunk, 0).protocolVersion);
  }
  socket.once('data', ondata);

  function onerror(err) {
    cleanup();
    cb(err);
  }
  socket.on('error', onerror);
};

Connection.prototype._initConnection = function _initConnection() {
  var self = this;
  var packet = new MessageBuffer();

  // register listerners on socket
  function ondata(chunk) {
    packet.push(chunk);
    if (packet.isReady()) {
      if (self._state.sessionId !== packet.header.sessionId) {
        self._state.sessionId = packet.header.sessionId;
        self._state.packetCount = -1;
      }
      var buffer = packet.getData();
      packet.clear();
      var cb = self._state.receive;
      self._state.receive = undefined;
      self._state.messageType = undefined;
      parse(buffer, cb);
    }
  }
  this._socket.on('data', ondata);

  function onerror(err) {
    self.emit('error', err);
  }
  this._socket.on('error', onerror);

  function onclose(hadError) {
    self._socket.removeAllListeners();
    self._socket = undefined;
    self._state = undefined;
    self._queue.abort();
    self._queue = undefined;
    self.emit('close', hadError);
  }
  this._socket.once('close', onclose);
};

Connection.prototype.send = function _send(message, receive) {
  debug('send', message);
  trace(SegmentKind.REQUEST, message);

  var state = this._state;
  var buffer = messageToBuffer(message);
  var length = buffer.length - PACKET_HEADER_LENGTH;

  state.messageType = message.type;
  state.receive = receive;
  // Increaee packet count
  state.packetCount++;
  // Session identifier
  bignum.writeUInt64LE(buffer, state.sessionId, 0);
  // Packet sequence number in this session
  // Packets with the same sequence number belong to one request / reply pair
  buffer.writeUInt32LE(state.packetCount, 8);
  // Used space in this packet
  buffer.writeUInt32LE(length, 12);
  // Total space in this buffer
  buffer.writeUInt32LE(MAX_PACKET_SIZE, 16);
  // Number of segments in this packet
  buffer.writeUInt16LE(1, 20);
  // Filler
  buffer.fill(0x00, 22, PACKET_HEADER_LENGTH);
  // Write request packet to socket
  if (this._socket) {
    this._socket.write(buffer);
  }
};

Connection.prototype.enqueue = function enqueue(msg, cb) {
  var task = this._queue.createTask(this.send.bind(this, msg), cb);
  task.name = MessageTypeName[msg.type];
  this._queue.push(task);
};

Connection.prototype.connect = function connect(options, cb) {
  var self = this;

  var name = options.algorithm || 'SCRAMSHA256';
  var authMethod = auth[name];
  var algorithm = new authMethod.Algorithm(options.clientChallenge);

  var authOptions = {
    authentication: {
      user: options.user,
      algorithm: name,
      clientChallenge: algorithm.clientChallenge
    }
  };
  var authMessage = request.authenticate(authMethod, authOptions);

  var connOptions = {
    authentication: {
      user: options.user,
      algorithm: name,
      clientProof: undefined
    },
    clientId: this.clientId,
    connectOptions: this.connectOptions
  };

  function connReceive(err, reply) {
    /* jshint validthis:true */
    if (err) {
      return cb(err);
    }
    self._queue.resume();
    cb(null, reply);
  }

  function authReceive(err, reply) {
    /* jshint validthis:true */
    if (err) {
      return cb(err);
    }
    var authReply = authMethod.Authentication.convert(reply.authentication);
    algorithm.salts = [authReply.salt];
    algorithm.serverChallenge = authReply.serverChallenge;
    connOptions.authentication.clientProof = algorithm.getClientProof(options.password);
    var connMessage = request.connect(authMethod, connOptions);
    this.send(connMessage, connReceive.bind(this));
  }
  this.send(authMessage, authReceive.bind(this));
};

Connection.prototype.disconnect = function disconnect(cb) {
  var self = this;

  function done(err, reply) {
    if (err) {
      return cb(err);
    }
    self._state = new ConnectionState();
    cb(null, reply);
  }

  function enqueueDisconnect() {
    self.enqueue(request.disconnect(), done);
  }

  if (this._queue.empty && !this._queue.busy) {
    return enqueueDisconnect();
  }
  this._queue.once('drain', enqueueDisconnect);
};

Connection.prototype.executeDirect = function executeDirect(sql, cb) {
  var options;
  if (util.isString(sql)) {
    options = {
      command: sql
    };
  } else if (util.isObject(sql)) {
    options = sql;
  }
  this.enqueue(request.executeDirect(options), cb);
};

Connection.prototype.prepare = function prepare(sql, cb) {
  var options;
  if (util.isString(sql)) {
    options = {
      command: sql
    };
  } else if (util.isObject(sql)) {
    options = sql;
  }
  this.enqueue(request.prepare(options), cb);
};

Connection.prototype.readLob = function readLob(options, cb) {
  if (options.locatorId) {
    options = {
      readLobRequest: options
    };
  }
  this.enqueue(request.readLob(options), cb);
};

Connection.prototype.execute = function execute(options, cb) {
  this.enqueue(request.execute(options), cb);
};

Connection.prototype.fetchNext = function fetchNext(options, cb) {
  this.enqueue(request.fetchNext(options), cb);
};

Connection.prototype.closeResultSet = function closeResultSet(resultSetId, cb) {
  var options;
  if (Buffer.isBuffer(resultSetId)) {
    options = {
      resultSetId: resultSetId
    };
  } else if (util.isObject(resultSetId)) {
    options = resultSetId;
  }
  this.enqueue(request.closeResultSet(options), cb);
};

Connection.prototype.dropStatement = function dropStatement(statementId, cb) {
  var options;
  if (Buffer.isBuffer(statementId)) {
    options = {
      statementId: statementId
    };
  } else if (util.isObject(statementId)) {
    options = statementId;
  }
  this.enqueue(request.dropStatementId(options), cb);
};

Connection.prototype.close = function close() {
  var socket = this._socket;

  function closeConnection() {
    debug('close');
    socket.readable = false;
    socket.end();
  }
  if (this._queue.empty && !this._queue.busy) {
    return closeConnection();
  }
  this._queue.once('drain', closeConnection);
};

function parse(buffer, cb) {
  var error, segment, reply;
  try {
    segment = ReplySegment.create(buffer, 0);
    trace(segment.kind, segment);
    reply = segment.getReply();
    if (reply.kind === SegmentKind.ERROR) {
      error = reply.error;
    }
    debug('receive', reply);
  } catch (err) {
    error = err;
    error.code = 'EHDBMSGPARSE';
    debug('receive', error);
  }
  if (util.isFunction(cb)) {
    cb(error, reply);
  }
}

function messageToBuffer(message) {
  var buffer;
  if (Buffer.isBuffer(message)) {
    buffer = message;
  } else {
    buffer = message.toBuffer(MAX_PACKET_SIZE - PACKET_HEADER_LENGTH);
  }
  var target = new Buffer(PACKET_HEADER_LENGTH + buffer.length);
  buffer.copy(target, PACKET_HEADER_LENGTH);
  return target;
}

function ConnectionState() {
  this.sessionId = -1;
  this.packetCount = -1;
  this.messageType = undefined;
  this.receive = undefined;
}

function Version(major, minor) {
  this.major = major;
  this.minor = minor;
}

Version.read = function readVersion(buffer, offset) {
  return new Version(
    buffer.readInt8(offset),
    buffer.readInt16LE(offset + 1)
  );
};

function InitializationReply(productVersion, protocolVersion) {
  this.productVersion = productVersion;
  this.protocolVersion = protocolVersion;
}

InitializationReply.LENGTH = 8;

InitializationReply.read = function readInitializationReply(buffer) {
  var productVersion = Version.read(buffer, 0);
  var protocolVersion = Version.read(buffer, 3);
  return new InitializationReply(productVersion, protocolVersion);
};

var initializationRequestBuffer = new Buffer([
  0xff, 0xff, 0xff, 0xff, 4, 20, 0x00, 4, 1, 0x00, 0x00, 1, 1, 1
]);

function MessageBuffer() {
  this.length = 0;
  this.header = undefined;
  this.data = undefined;
}

MessageBuffer.prototype.isReady = function () {
  return this.header && this.length >= this.header.length;
};

MessageBuffer.prototype.push = function push(chunk) {
  if (!chunk || !chunk.length) {
    return;
  }
  this.length += chunk.length;
  if (!this.data) {
    this.data = chunk;
  } else if (Buffer.isBuffer(this.data)) {
    this.data = [this.data, chunk];
  } else {
    this.data.push(chunk);
  }
  if (!this.header && this.length >= PACKET_HEADER_LENGTH) {
    this.readHeader();
  }
};

MessageBuffer.prototype.getData = function getData() {
  if (util.isArray(this.data)) {
    return Buffer.concat(this.data, this.length);
  }
  return this.data;
};

MessageBuffer.prototype.readHeader = function readHeader() {
  var buffer = this.getData();
  this.header = {
    sessionId: bignum.readUInt64LE(buffer, 0),
    packetCount: buffer.readUInt32LE(8),
    length: buffer.readUInt32LE(12)
  };
  this.data = buffer.slice(PACKET_HEADER_LENGTH);
  this.length -= PACKET_HEADER_LENGTH;
};

MessageBuffer.prototype.clear = function clear() {
  this.length = 0;
  this.header = undefined;
  this.data = undefined;
};