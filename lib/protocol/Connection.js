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
var MessageTypeName = common.MessageTypeName;
var SegmentKind = common.SegmentKind;
var bignum = util.bignum;
var debug = util.debuglog('hdb');

var MAX_PACKET_SIZE = Math.pow(2, 17);
var PACKET_HEADER_LENGTH = 32;

module.exports = Connection;

util.inherits(Connection, EventEmitter);

function Connection() {
  EventEmitter.call(this);

  this._socket = undefined;
  this._queue = new util.Queue().pause();
  this._state = new ConnectionState();
}

Connection.open = function openConnection(options, cb) {
  var connection = new Connection();
  connection.open(options, cb);
  return connection;
};

Object.defineProperties(Connection.prototype, {
  connectOptions: {
    get: function getConnectOptions() {
      return this._state.connectOptions;
    }
  },
  clientId: {
    get: function getConnectOptions() {
      return this._state.clientId;
    }
  },
  readyState: {
    get: function getReadyState() {
      if (!this._socket) {
        return 'closed';
      }
      var sessionId = this._state.sessionId;
      if (util.isUndefined(sessionId)) {
        return 'opening';
      }
      if (this._queue.running === true) {
        if (parseInt(sessionId, 10) > 0) {
          return 'connected';
        }
        return 'connecting';
      }
      return this._socket.readyState;
    }
  }
});

Connection.prototype.open = function open(options, cb) {
  var self = this;

  if (this._socket) {
    return;
  }

  this._socket = net.connect(util.extend(options, {
    allowHalfOpen: false
  }), function connectListener() {
    self._socket.write(initializationRequestBuffer);
  });
  this._socket.setNoDelay(true);

  function cleanup() {
    debug('cleanup');
    self._socket.removeListener('error', onerror);
    self._socket = undefined;
    self._queue.abort();
    self._state = new ConnectionState();
  }

  function onerror(err) {
    self.emit('error', err);
  }
  this._socket.on('error', onerror);

  function onclose(hadError) {
    cleanup();
    self.emit('close', hadError);
  }
  this._socket.once('close', onclose);

  this._socket.once('readable', readInitializationReply.bind(this, cb));
  return this;
};

Connection.prototype.enqueue = function enqueue(msg, cb) {
  var task = this._queue.createTask(send.bind(this, msg), cb);
  task.name = MessageTypeName[msg.type];
  this._queue.push(task);
};

Connection.prototype.connect = function connect(options, cb) {
  var state = this._state;

  if (state.connecting === true) {
    return cb(new Error('Already connecting'));
  }
  state.connecting = true;

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
    state.connecting = false;
    if (err) {
      return cb(err);
    }
    this._queue.resume();
    cb(null, reply);
  }

  function authReceive(err, reply) {
    /* jshint validthis:true */
    if (err) {
      state.connecting = false;
      return cb(err);
    }

    var authReply = authMethod.Authentication.convert(reply.authentication);
    algorithm.salts = [authReply.salt];
    algorithm.serverChallenge = authReply.serverChallenge;
    connOptions.authentication.clientProof = algorithm.getClientProof(options.password);
    var connMessage = request.connect(authMethod, connOptions);
    send.call(this, connMessage, connReceive.bind(this));
  }
  send.call(this, authMessage, authReceive.bind(this));
};

Connection.prototype.disconnect = function disconnect(cb) {
  var self = this;
  var state = this._state;

  if (state.disconnecting === true) {
    return cb(new Error('Already disconnecting'));
  }
  state.disconnecting = true;

  function done(err, reply) {
    state.disconnecting = false;
    if (err) {
      return cb(err);
    }
    state.sessionId = -1;
    state.packetCount = -1;
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
  if (this._queue.empty && !this._queue.busy) {
    return closeConnection.call(this);
  }
  this._queue.once('drain', closeConnection.bind(this));
};

function closeConnection() {
  /* jshint validthis:true */
  debug('close');
  this._socket.readable = false;
  this._socket.end();
}

function send(message, receive) {
  /* jshint validthis:true */

  debug('send', message);

  var state = this._state;
  var buffer = messageToBuffer(message);
  var length = buffer.length - PACKET_HEADER_LENGTH;

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

function readInitializationReply(cb) {
  /* jshint validthis:true */
  var state = this._state;
  var chunk;

  chunk = this._socket.read(InitializationReply.LENGTH);
  if (chunk === null) {
    return;
  }
  this._socket.read();
  this._socket.on('readable', readReply.bind(this));

  state.sessionId = -1;
  state.packetCount = -1;

  var info = InitializationReply.read(chunk, 0);
  this.emit('open', info);
  if (util.isFunction(cb)) {
    cb(info);
  }
}

function readReply() {
  /* jshint validthis:true */
  var state = this._state;
  var chunk;

  if (util.isUndefined(state.packetHeader)) {
    chunk = this._socket.read(PACKET_HEADER_LENGTH);
    if (chunk === null) {
      return;
    }
    state.packetHeader = PacketHeader.read(chunk, 0);
    if (state.sessionId !== state.packetHeader.sessionId) {
      state.sessionId = state.packetHeader.sessionId;
      state.packetCount = -1;
    }
  }
  chunk = this._socket.read(state.packetHeader.length);
  if (chunk === null) {
    return;
  }
  this._socket.read();

  state.packetHeader = undefined;
  var cb = state.receive;
  state.receive = undefined;
  if (util.isFunction(cb)) {
    var error, segment, reply;
    try {
      segment = ReplySegment.create(chunk, 0);
      reply = segment.getReply();
      if (reply.kind === SegmentKind.ERROR) {
        error = reply.error;
      }
    } catch (err) {
      error = err;
      error.code = 'PROTOCOL_PARSE_ERROR';
    }
    debug('receive', reply);
    cb(error, reply);
  }
}

function ConnectionState() {
  var pid = process.pid || 'nodejs';
  this.clientId = [pid, os.hostname()].join('@');
  this.connectOptions = common.DEFAULT_CONNECT_OPTIONS.slice(0);
  this.connecting = false;
  this.disconnecting = false;
  this.sessionId = undefined;
  this.packetCount = undefined;
  this.packetHeader = undefined;
  this.receive = undefined;
}

function PacketHeader(sessionId, packetCount, length) {
  this.sessionId = sessionId;
  this.packetCount = packetCount;
  this.length = length;
}

PacketHeader.read = function readPacketHeader(buffer, offset) {
  offset = offset || 0;

  return new PacketHeader(
    bignum.readUInt64LE(buffer, offset),
    buffer.readUInt32LE(offset + 8),
    buffer.readUInt32LE(offset + 12)
  );
};

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