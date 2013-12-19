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
var Transaction = require('./Transaction');
var Writer = require('./Writer');
var common = require('./common');
var request = require('./request');
var reply = require('./reply');
var ReplySegment = reply.Segment;
var part = require('./part');
var MessageType = common.MessageType;
var MessageTypeName = common.MessageTypeName;
var SegmentKind = common.SegmentKind;
var PartKind = common.PartKind;
var bignum = util.bignum;
var debug = util.debuglog('hdb');
var trace = util.tracelog();

var MAX_PACKET_SIZE = common.MAX_PACKET_SIZE;
var PACKET_HEADER_LENGTH = common.PACKET_HEADER_LENGTH;

module.exports = Connection;

util.inherits(Connection, EventEmitter);

function Connection(settings) {
  EventEmitter.call(this);

  // public
  this.clientId = [process.pid || 'nodejs', os.hostname()].join('@');
  this.connectOptions = new part.ConnectOptions();
  this.protocolVersion = undefined;
  // private
  this._settings = settings || {};
  this._socket = undefined;
  this._queue = new util.Queue().pause();
  this._state = new ConnectionState();
  this._statementContext = undefined;
  this._transaction = new Transaction();

  var self = this;

  function onerror(err) {
    self.destroy(err);
  }
  this._transaction.once('error', onerror);
}

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
      self.receive(buffer, cb);
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

Connection.prototype.send = function send(message, receive) {
  if (this._statementContext) {
    message.unshift(PartKind.STATEMENT_CONTEXT, this._statementContext.getOptions());
  }

  debug('send', message);
  trace(SegmentKind.REQUEST, message);

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

Connection.prototype.setTransactionFlags = function setTransactionFlags(flags) {
  if (flags) {
    this._transaction.setFlags(flags);
  }
};

Connection.prototype.receive = function receive(buffer, cb) {
  var error, segment, reply;
  try {
    segment = ReplySegment.create(buffer, 0);
    trace(segment.kind, segment);
    reply = segment.getReply();
    this.setStatementContext(reply.statementContext);
    this.setTransactionFlags(reply.transactionFlags);
    if (reply.kind === SegmentKind.ERROR) {
      error = reply.error;
    } else if (this._transaction.error) {
      error = this._transaction.error;
    }
    debug('receive', reply);
  } catch (exception) {
    error = exception;
    error.code = 'EHDBMSGPARSE';
    debug('receive', error);
  }
  if (error && error.fatal) {
    this.destroy(error);
  }
  if (util.isFunction(cb)) {
    cb(error, reply);
  }
};

Connection.prototype.enqueue = function enqueue(task, cb) {
  var queueable;
  if (util.isFunction(task)) {
    queueable = this._queue.createTask(task, cb);
    queueable.name = task.name;
  } else if (util.isObject(task)) {
    if (task instanceof request.Segment) {
      task = this.send.bind(this, task);
      queueable = this._queue.createTask(task, cb);
      task.name = MessageTypeName[task.type];
    } else if (util.isFunction(task.run)) {
      queueable = task;
    }
  }
  if (queueable) {
    this._queue.push(queueable);
  }
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
    connectOptions: this.connectOptions.getOptions()
  };

  function connReceive(err, reply) {
    /* jshint validthis:true */
    if (err) {
      return cb(err);
    }
    if (util.isArray(reply.connectOptions)) {
      self.connectOptions.setOptions(reply.connectOptions);
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
    self.send(connMessage, connReceive);
  }
  this.send(authMessage, authReceive);
};

Connection.prototype.disconnect = function disconnect(cb) {
  var self = this;

  function done(err, reply) {
    if (err) {
      return cb(err);
    }
    self._statementContext = new part.StatementContext();
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
  options.autoCommit = this.autoCommit;
  options.holdCursorsOverCommit = this.holdCursorsOverCommit;
  options.scrollableCursor = this.scrollableCursor;
  this.enqueue(request.executeDirect(options), cb);
};

Connection.prototype.prepare = function prepare(options, cb) {
  options.holdCursorsOverCommit = this.holdCursorsOverCommit;
  options.scrollableCursor = this.scrollableCursor;
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
  options.autoCommit = this.autoCommit;
  options.holdCursorsOverCommit = this.holdCursorsOverCommit;
  options.scrollableCursor = this.scrollableCursor;
  var task = this._execute.bind(this, options);
  this.enqueue(task, cb);
};

Connection.prototype._execute = function _execute(options, cb) {
  var self = this;
  var writer = Writer.create(options.parameters);
  var remainingSize = MAX_PACKET_SIZE - 128;
  var needFinishTransaction = false;
  var replies = [];

  function done(err) {
    if (err) {
      return cb(err);
    }
    cb(null, replies.shift());
  }

  function finish(err) {
    if (!needFinishTransaction) {
      return done(err);
    }
    var transactionMessage;
    var options = {
      holdCursorsOverCommit: self.holdCursorsOverCommit
    };
    if (err) {
      transactionMessage = request.roolback(options);
    } else {
      transactionMessage = request.commit(options);
    }
    self.send(transactionMessage, done);
  }

  function first() {
    debug('execute - first');
    writer.getParameters(remainingSize, sendExecute);
  }

  function next() {
    debug('execute - next');
    if (writer.finished) {
      return finish(null);
    }
    writer.getWriteLobRequest(remainingSize, sendWriteLob);
  }

  function sendWriteLob(err, buffer) {
    if (err) {
      return finish(err);
    }
    var options = {
      writeLobRequest: buffer
    };
    self.send(request.writeLob(options), receiveWriteLob);
  }

  function receiveWriteLob(err, reply) {
    if (err) {
      return finish(err);
    }
    replies.push(reply);
    //writer.update(writeLobReply);
    next();
  }

  function sendExecute(err, parameters) {
    if (err) {
      return finish(err);
    }
    options.parameters = parameters;
    if (!writer.finished && options.autoCommit) {
      needFinishTransaction = true;
      options.autoCommit = false;
    }
    self.send(request.execute(options), receiveExecute);
  }

  function receiveExecute(err, reply) {
    if (err) {
      return finish(err);
    }
    replies.push(reply);
    if (!writer.finished) {
      writer.update(reply.writeLobReply);
    }
    next();
  }

  first();
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

Connection.prototype.destroy = function destroy(err) {
  var socket = this._socket;

  function destroySocket() {
    socket.destroy(err);
  }
  process.nextTick(destroySocket);
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