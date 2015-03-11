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

var EventEmitter = require('events').EventEmitter;
var tcp = require('./tcp');
var auth = require('./auth');
var util = require('../util');
var Transaction = require('./Transaction');
var MessageBuffer = require('./MessageBuffer');
var common = require('./common');
var request = require('./request');
var reply = require('./reply');
var createExecuteTask = require('./ExecuteTask').create;
var ReplySegment = reply.Segment;
var part = require('./part');
var MessageType = common.MessageType;
var MessageTypeName = common.MessageTypeName;
var SegmentKind = common.SegmentKind;
var PartKind = common.PartKind;
var bignum = util.bignum;
var debug = util.debuglog('hdb');
var trace = util.tracelog();

var EMPTY_BUFFER = common.EMPTY_BUFFER;
var MAX_PACKET_SIZE = common.MAX_PACKET_SIZE;
var PACKET_HEADER_LENGTH = common.PACKET_HEADER_LENGTH;
var SEGMENT_HEADER_LENGTH = common.SEGMENT_HEADER_LENGTH;
var PART_HEADER_LENGTH = common.PART_HEADER_LENGTH;
var MAX_AVAILABLE_SIZE = MAX_PACKET_SIZE -
  PACKET_HEADER_LENGTH - SEGMENT_HEADER_LENGTH - PART_HEADER_LENGTH;

module.exports = Connection;

util.inherits(Connection, EventEmitter);

function Connection(settings) {
  EventEmitter.call(this);

  var self = this;
  // public
  this.clientId = util.cid;
  this.connectOptions = new part.ConnectOptions();
  this.protocolVersion = undefined;
  // private
  this._settings = settings || {};
  this._socket = undefined;
  this._queue = new util.Queue().pause();
  this._state = new ConnectionState();
  this._statementContext = undefined;
  this._transaction = new Transaction();
  this._transaction.once('error', function onerror(err) {
    self.destroy(err);
  });
}

Connection.create = function createConnection(settings) {
  return new Connection(settings);
};

Object.defineProperties(Connection.prototype, {
  autoCommit: {
    get: function getAutoCommit() {
      return this._transaction.autoCommit;
    },
    set: function setAutoCommit(autoCommit) {
      this._transaction.setAutoCommit(autoCommit);
    }
  },
  holdCursorsOverCommit: {
    get: function getHoldCursorsOverCommit() {
      return !!this._settings.holdCursorsOverCommit;
    },
    set: function setHoldCursorsOverCommit(holdCursorsOverCommit) {
      this._settings.holdCursorsOverCommit = holdCursorsOverCommit;
    }
  },
  scrollableCursor: {
    get: function setScrollableCursor() {
      return !!this._settings.scrollableCursor;
    },
    set: function setScrollableCursor(scrollableCursor) {
      this._settings.scrollableCursor = scrollableCursor;
    }
  },
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
      if (this._socket.readyState !== 'open') {
        return 'closed';
      }
      // no protocol version ==> open not yet finished
      if (!this.protocolVersion) {
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

  function invalidInitializationReply() {
    var err = new Error('Invalid initialization reply');
    err.code = 'EHDBINIT';
    return err;
  }

  function cleanup() {
    socket.removeListener('error', onerror);
    socket.removeListener('data', ondata);
  }

  function onerror(err) {
    cleanup();
    cb(err);
  }

  function ondata(chunk) {
    cleanup();
    if (!chunk || chunk.length < InitializationReply.LENGTH) {
      return cb(invalidInitializationReply());
    }
    var reply = InitializationReply.read(chunk, 0);
    self.protocolVersion = reply.protocolVersion;
    self._addListeners(socket);
    self.emit('open');
    cb();
  }

  var socket = self._socket = self._connect(options, function connectListener() {
    socket.write(initializationRequestBuffer);
  });
  socket.once('error', onerror);
  socket.on('data', ondata);
};

Connection.prototype._connect = tcp.connect;

Connection.prototype._addListeners = function _addListeners(socket) {
  var self = this;
  var packet = new MessageBuffer();

  function cleanup() {
    socket.removeListener('error', onerror);
    socket.removeListener('data', ondata);
    socket.removeListener('close', onclose);
  }

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
      self.receive(buffer, cb);
    }
  }
  socket.on('data', ondata);

  function onerror(err) {
    self.emit('error', err);
  }
  socket.on('error', onerror);

  function onclose(hadError) {
    cleanup();
    self._cleanup();
    self.emit('close', hadError);
  }
  socket.on('close', onclose);
};

Connection.prototype._cleanup = function _cleanup() {
  this._socket = undefined;
  this._state = undefined;
  this._queue.abort();
  this._queue = undefined;
};

Connection.prototype.send = function send(message, receive) {
  if (this._statementContext) {
    message.unshift(PartKind.STATEMENT_CONTEXT, this._statementContext.getOptions());
  }

  debug('send', message);
  trace('REQUEST', message);

  var size = MAX_PACKET_SIZE - PACKET_HEADER_LENGTH;
  var buffer = message.toBuffer(size);
  var packet = new Buffer(PACKET_HEADER_LENGTH + buffer.length);
  buffer.copy(packet, PACKET_HEADER_LENGTH);

  var state = this._state;
  state.messageType = message.type;
  state.receive = receive;
  // Increase packet count
  state.packetCount++;
  // Session identifier
  bignum.writeUInt64LE(packet, state.sessionId, 0);
  // Packet sequence number in this session
  // Packets with the same sequence number belong to one request / reply pair
  packet.writeUInt32LE(state.packetCount, 8);
  // Used space in this packet
  packet.writeUInt32LE(buffer.length, 12);
  // Total space in this packet
  packet.writeUInt32LE(size, 16);
  // Number of segments in this packet
  packet.writeUInt16LE(1, 20);
  // Filler
  packet.fill(0x00, 22, PACKET_HEADER_LENGTH);
  // Write request packet to socket
  if (this._socket) {
    this._socket.write(packet);
  }
};

Connection.prototype.setStatementContext = function setStatementContext(options) {
  if (options && options.length) {
    if (!this._statementContext) {
      this._statementContext = new part.StatementContext();
    }
    this._statementContext.setOptions(options);
  } else {
    this._statementContext = undefined;
  }
};

Connection.prototype.getAvailableSize = function getAvailableSize() {
  var availableSize = MAX_AVAILABLE_SIZE;
  if (this._statementContext) {
    availableSize -= this._statementContext.size;
  }
  return availableSize;
};

Connection.prototype.setTransactionFlags = function setTransactionFlags(flags) {
  if (flags) {
    this._transaction.setFlags(flags);
  }
};

Connection.prototype._parseReplySegment = function _parseReplySegment(buffer) {
  var segment = ReplySegment.create(buffer, 0);
  trace(segment.kind === SegmentKind.ERROR ? 'ERROR' : 'REPLY', segment);
  return segment.getReply();
};

Connection.prototype.receive = function receive(buffer, cb) {
  var error, reply;
  try {
    reply = this._parseReplySegment(buffer);
    this.setStatementContext(reply.statementContext);
    this.setTransactionFlags(reply.transactionFlags);
    if (reply.kind === SegmentKind.ERROR) {
      error = reply.error;
    } else if (this._transaction.error) {
      error = this._transaction.error;
    }
    debug('receive', reply);
  } catch (err) {
    error = err;
    error.code = 'EHDBMSGPARSE';
    debug('receive', error);
  }
  if (error && error.fatal) {
    this.destroy(error);
  }
  cb(error, reply);
};

Connection.prototype.enqueue = function enqueue(task, cb) {
  var queueable;
  if (util.isFunction(task)) {
    queueable = this._queue.createTask(task, cb);
    queueable.name = task.name;
  } else if (util.isObject(task)) {
    if (task instanceof request.Segment) {
      queueable = this._queue.createTask(this.send.bind(this, task), cb);
      queueable.name = MessageTypeName[task.type];
    } else if (util.isFunction(task.run)) {
      queueable = task;
    }
  }
  if (queueable) {
    this._queue.push(queueable);
  }
};

Connection.prototype._createAuthenticationManager = auth.createManager;

Connection.prototype.connect = function connect(options, cb) {
  var self = this;

  var manager;
  try {
    manager = this._createAuthenticationManager(options);
  } catch (err) {
    return util.setImmediate(function () {
      cb(err);
    });
  }

  function connReceive(err, reply) {
    if (err) {
      return cb(err);
    }
    if (util.isArray(reply.connectOptions)) {
      self.connectOptions.setOptions(reply.connectOptions);
    }
    manager.finalize(reply.authentication);
    self._settings.user = manager.userFromServer;
    if (manager.sessionCookie) {
      self._settings.sessionCookie = manager.sessionCookie;
    }
    self._queue.resume();
    cb(null, reply);
  }

  function authReceive(err, reply) {
    if (err) {
      return cb(err);
    }
    try {
      manager.initialize(reply.authentication);
    } catch (err) {
      return cb(err);
    }
    self.send(request.connect({
      authentication: manager.finalData(),
      clientId: self.clientId,
      connectOptions: self.connectOptions.getOptions()
    }), connReceive);
  }
  this.send(request.authenticate({
    authentication: manager.initialData()
  }), authReceive);
};

Connection.prototype.disconnect = function disconnect(cb) {
  var self = this;

  function done(err, reply) {
    if (err) {
      return cb(err);
    }
    self._statementContext = undefined;
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

Connection.prototype.executeDirect = function executeDirect(options, cb) {
  options = util.extend({
    autoCommit: this.autoCommit,
    holdCursorsOverCommit: this.holdCursorsOverCommit,
    scrollableCursor: this.scrollableCursor
  }, options);
  this.enqueue(request.executeDirect(options), cb);
};

Connection.prototype.prepare = function prepare(options, cb) {
  options = util.extend({
    holdCursorsOverCommit: this.holdCursorsOverCommit,
    scrollableCursor: this.scrollableCursor
  }, options);
  this.enqueue(request.prepare(options), cb);
};

Connection.prototype.readLob = function readLob(options, cb) {
  if (options.locatorId) {
    options = {
      readLobRequest: options
    };
  }
  options.autoCommit = this.autoCommit;
  this.enqueue(request.readLob(options), cb);
};

Connection.prototype.execute = function execute(options, cb) {
  options = util.extend({
    autoCommit: this.autoCommit,
    holdCursorsOverCommit: this.holdCursorsOverCommit,
    scrollableCursor: this.scrollableCursor,
    parameters: EMPTY_BUFFER
  }, options);
  if (options.parameters === EMPTY_BUFFER) {
    return this.enqueue(request.execute(options), cb);
  }
  this.enqueue(createExecuteTask(this, options, cb));
};

Connection.prototype.fetchNext = function fetchNext(options, cb) {
  options.autoCommit = this.autoCommit;
  this.enqueue(request.fetchNext(options), cb);
};

Connection.prototype.closeResultSet = function closeResultSet(options, cb) {
  this.enqueue(request.closeResultSet(options), cb);
};

Connection.prototype.dropStatement = function dropStatement(options, cb) {
  this.enqueue(request.dropStatementId(options), cb);
};

Connection.prototype.commit = function commit(options, cb) {
  if (util.isFunction(options)) {
    cb = options;
    options = {};
  }
  this.enqueue(request.commit(options), cb);
};

Connection.prototype.rollback = function rollback(options, cb) {
  if (util.isFunction(options)) {
    cb = options;
    options = {};
  }
  this.enqueue(request.rollback(options), cb);
};

Connection.prototype.close = function close() {
  var self = this;

  function closeConnection() {
    debug('close');
    self.destroy();
  }
  if (this._queue.empty && !this._queue.busy) {
    return closeConnection();
  }
  this._queue.once('drain', closeConnection);
};

Connection.prototype.destroy = function destroy(err) {
  if (this._socket) {
    this._socket.destroy(err);
  }
};

Connection.prototype.setAutoCommit = function setAutoCommit(autoCommit) {
  this._transaction.autoCommit = autoCommit;
};

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
  0xff, 0xff, 0xff, 0xff, 4, 20, 0, 4, 1, 0, 0, 1, 1, 1
]);