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
var ClientInfo = require('./ClientInfo');
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
var ErrorLevel = common.ErrorLevel;
var PartKind = common.PartKind;
var bignum = util.bignum;
var debug = util.debuglog('hdb');
var trace = util.tracelog();

var EMPTY_BUFFER = common.EMPTY_BUFFER;
var DEFAULT_PACKET_SIZE = common.DEFAULT_PACKET_SIZE;
var MINIMUM_PACKET_SIZE = common.MINIMUM_PACKET_SIZE;
var MAXIMUM_PACKET_SIZE = common.MAXIMUM_PACKET_SIZE;
var PACKET_HEADER_LENGTH = common.PACKET_HEADER_LENGTH;
var SEGMENT_HEADER_LENGTH = common.SEGMENT_HEADER_LENGTH;
var PART_HEADER_LENGTH = common.PART_HEADER_LENGTH;

module.exports = Connection;

util.inherits(Connection, EventEmitter);

function Connection(settings) {
  EventEmitter.call(this);

  var self = this;
  // public
  this.connectOptions = new part.ConnectOptions();
  this.clientContextOptions = new part.ClientContextOptions();
  this.protocolVersion = undefined;
  // private
  this._clientInfo = new ClientInfo();
  for(var key in settings) {
    if(key.toUpperCase().startsWith("SESSIONVARIABLE:")) {
      var sv_key = key.substring(key.indexOf(":") + 1);
      var sv_value = settings[key];
      if(sv_key && sv_key.length > 0 && sv_value && sv_value.length > 0) {
        this._clientInfo.setProperty(sv_key, sv_value);
      }
      delete settings[key];
    }
  }
  this._settings = settings || {};
  this._socket = undefined;
  this._queue = new util.Queue().pause();
  this._state = new ConnectionState();
  this._statementContext = undefined;
  this._transaction = new Transaction();
  this._transaction.once('error', function onerror(err) {
    self.destroy(err);
  });
  this._initialHost = undefined;
  this._initialPort = undefined;
  this._redirectHost = undefined;
  this._redirectPort = undefined;
  this.host = this._settings['host'];
  this.port = this._settings['port'];
  this._redirectType = common.RedirectType.REDIRECTION_NONE;
}

Connection.create = function createConnection(settings) {
  return new Connection(settings);
};

Object.defineProperties(Connection.prototype, {
  clientId: {
    get: function getClientId() {
      return this._settings.clientId || util.cid;
    }
  },
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
    get: function getScrollableCursor() {
      return !!this._settings.scrollableCursor;
    },
    set: function setScrollableCursor(scrollableCursor) {
      this._settings.scrollableCursor = scrollableCursor;
    }
  },
  initializationTimeout: {
    get: function getInitializationTimeout() {
      return this._settings.initializationTimeout || 5000;
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
        default:
          // do nothing
      }
      if (this._state.sessionId === -1) {
        return 'disconnected';
      }
      return 'connected';
    }
  },
  useCesu8: {
    get: function shouldUseCesu8() {
      return (this._settings.useCesu8 === true);
    }
  },
  packetSize: {
    get: function getPacketSize() {
      let size = this._settings.packetSize || DEFAULT_PACKET_SIZE;
      size = Math.min(size, MAXIMUM_PACKET_SIZE);
      size = Math.max(size, MINIMUM_PACKET_SIZE);
      return size;
    }
  },
  packetSizeLimit: {
    get: function getPacketSizeLimit() {
      let limit = this._settings.packetSizeLimit || this.packetSize;
      limit = Math.min(limit, MAXIMUM_PACKET_SIZE);
      limit = Math.max(limit, this.packetSize);
      return limit;
    }
  }
});

Connection.prototype.open = function open(options, cb) {
  var self = this;
  var timeoutObject = null;

  function invalidInitializationReply() {
    var err = new Error('Invalid initialization reply');
    err.code = 'EHDBINIT';
    return err;
  }

  function initializationTimeoutError() {
    var seconds = Math.round(self.initializationTimeout / 1000);
    var err = new Error('No initialization reply received within ' + seconds + ' sec');
    err.code = 'EHDBTIMEOUT';
    return err;
  }

  function cleanup() {
    clearTimeout(timeoutObject);
    socket.removeListener('error', onerror);
    socket.removeListener('data', ondata);
  }

  function onerror(err) {
    cleanup();
    socket.destroy();
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
    self.host = options['host'];
    self.port = options['port'];
    timeoutObject = setTimeout(onerror, self.initializationTimeout, initializationTimeoutError());
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
    var cb = self._state && self._state.receive;
    if (cb) {
      self._state.receive = null; // a callback should be called only once
      cb(err);
    } else if (self.listeners('error').length) {
      self.emit('error', err);
    } else {
      debug('onerror', err);
    }
  }
  socket.on('error', onerror);

  function onclose(hadError) {
    cleanup();
    self._cleanup();
    self.emit('close', hadError);
  }
  socket.on('close', onclose);

  function onend() {
    var err = new Error('Connection closed by server');
    err.code = 'EHDBCLOSE';
    self._clearQueue(err);
    onerror(err);
  }
  socket.on('end', onend);
};

Connection.prototype._cleanup = function _cleanup() {
  this._socket = undefined;
  this._state = undefined;
  // Connection is closed, outstanding tasks must fail
  var err = new Error('Connection closed');
  err.code = 'EHDBCLOSE';
  this._clearQueue(err);
};

Connection.prototype._clearQueue = function _clearQueue(err) {
  if (this._queue) {
    this._queue.abort(err);
    this._queue = undefined;
  }
};

Connection.prototype.send = function send(message, receive) {
  if (this._statementContext) {
    message.unshift(PartKind.STATEMENT_CONTEXT, this._statementContext.getOptions());
  }
  if (this._clientInfo.shouldSend(message.type)) {
    message.add(PartKind.CLIENT_INFO, this._clientInfo.getUpdatedProperties());
  }

  debug('send', message);
  trace('REQUEST', message);

  var size = this.packetSizeLimit - PACKET_HEADER_LENGTH;
  var buffer = message.toBuffer(size);
  if(buffer.length > size) {
    return receive(new Error('Packet size limit exceeded'));
  }
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


Connection.prototype.getClientInfo = function getClientInfo() {
  return this._clientInfo;
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

Connection.prototype.getAvailableSize = function getAvailableSize(forLobs = false) {
  var totalSize = forLobs ? this.packetSize : this.packetSizeLimit;
  var availableSize = totalSize - PACKET_HEADER_LENGTH - SEGMENT_HEADER_LENGTH - PART_HEADER_LENGTH;
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
    if (reply.kind === SegmentKind.ERROR && util.isObject(reply.error)) {
      if (reply.error.level === ErrorLevel.WARNING) {
        this.emit('warning', reply.error);
      } else {
        error = reply.error;
      }
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
  if(cb) {
    cb(error, reply);
  }
};

Connection.prototype.enqueue = function enqueue(task, cb) {
  var queueable;

  if (!this._socket || !this._queue || this.readyState === 'closed') {
    var err = new Error('Connection closed');
    err.code = 'EHDBCLOSE';
    if (cb) {
      return cb(err);
    } else if (util.isFunction(task.callback)) {
      return task.callback(err);
    }
  }
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
  for(var key in options) {
    if(key.toUpperCase().startsWith("SESSIONVARIABLE:")) {
      var sv_key = key.substring(key.indexOf(":") + 1);
      var sv_value = options[key];
      if(sv_key && sv_key.length > 0 && sv_value && sv_value.length > 0) {
        this._clientInfo.setProperty(sv_key, sv_value);
      }
      delete options[key];
    }
  }
  this.connectOptions.setOptions([{
    name : common.ConnectOption.OS_USER,
    value : this._clientInfo.getUser()
  }]);
  this.clientContextOptions.setOptions([{
    name : common.ClientContextOption.CLIENT_APPLICATION_PROGRAM,
    value : this._clientInfo.getApplication()
  }]);
  if(options["disableCloudRedirect"] == true) {
      this._redirectType = common.RedirectType.REDIRECTION_DISABLED;
  }
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
    if (Array.isArray(reply.connectOptions)) {
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
      return cb(err, reply);
    }
    manager.initialize(reply.authentication, function(err) {
      if (err) return cb(err);
      var redirectOptions = []
      if (typeof self._initialHost === 'undefined') {
        self._initialHost = self.host;
      }
      if (typeof self._initialPort === 'undefined') {
        self._initialPort = self.port;
      }
      redirectOptions.push({
        name: common.ConnectOption.ENDPOINT_HOST,
        value: self._initialHost
      });
      redirectOptions.push({
        name: common.ConnectOption.ENDPOINT_PORT,
        value: self._initialPort
      });
      var endpointList = undefined;
      if (typeof self._initialHost !== 'undefined' && typeof self._initialPort !== 'undefined') {
        endpointList = self._initialHost + ":" + self._initialPort.toString();
      }
      redirectOptions.push({
        name: common.ConnectOption.ENDPOINT_LIST,
        value: endpointList
      });
      redirectOptions.push({
        name: common.ConnectOption.REDIRECTION_TYPE,
        value: self._redirectType
      });
      if (typeof self._redirectHost === 'undefined') {
        self._redirectHost = self._initialHost;
      }
      redirectOptions.push({
        name: common.ConnectOption.REDIRECTED_HOST,
        value: self._redirectHost
      });
      if (typeof self._redirectPort === 'undefined') {
        self._redirectPort = self._initialPort;
      }
      redirectOptions.push({
        name: common.ConnectOption.REDIRECTED_PORT,
        value: self._redirectPort
      });
      self.connectOptions.setOptions(redirectOptions);
      self.send(request.connect({
        authentication: manager.finalData(),
        clientId: self.clientId,
        connectOptions: self.connectOptions.getOptions(),
        useCesu8: self.useCesu8
      }), connReceive);
    });
  }

  var authOptions = {
    clientContext: this.clientContextOptions.getOptions(),
    authentication: manager.initialData(),
    useCesu8: self.useCesu8
  }

  if(this._redirectType == common.RedirectType.REDIRECTION_NONE) {
    authOptions.dbConnectInfo = true;
  }

  this.send(request.authenticate(authOptions), authReceive);
};

Connection.prototype.disconnect = function disconnect(cb) {
  var self = this;

  function done(err, reply) {
    self.destroy();
    cb(err, reply);
  }

  function enqueueDisconnect() {
    self.enqueue(request.disconnect(), done);
  }

  if (this.isIdle()) {
    return enqueueDisconnect();
  }
  this._queue.once('drain', enqueueDisconnect);
};

Connection.prototype.executeDirect = function executeDirect(options, cb) {
  options = util.extend({
    autoCommit: this.autoCommit,
    holdCursorsOverCommit: this.holdCursorsOverCommit,
    scrollableCursor: this.scrollableCursor,
    useCesu8: this.useCesu8
  }, options);
  this.enqueue(request.executeDirect(options), cb);
};

Connection.prototype.prepare = function prepare(options, cb) {
  options = util.extend({
    holdCursorsOverCommit: this.holdCursorsOverCommit,
    scrollableCursor: this.scrollableCursor,
    useCesu8: this.useCesu8
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
  options.useCesu8 = this.useCesu8;
  this.enqueue(request.fetchNext(options), cb);
};

Connection.prototype.closeResultSet = function closeResultSet(options, cb) {
  this.enqueue(request.closeResultSet(options), cb);
};

Connection.prototype.dropStatement = function dropStatement(options, cb) {
  options.useCesu8 = this.useCesu8;
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

  // The function doesn't use the queue. It's used before the queue starts running
Connection.prototype.fetchDbConnectInfo = function (options, cb) {
  if (this.readyState == 'closed') {
    var err = new Error('Connection unexpectedly closed');
    err.code = 'EHDBCLOSE';
    return cb(err)
  }
  this.send(request.dbConnectInfo(options), function(err, reply) {
    if (err) {
      return cb(err);
    }
    var info = new part.DbConnectInfoOptions();
    info.setOptions(reply.dbConnectInfo);
    cb(null, info);
  });
};

Connection.prototype._closeSilently = function _closeSilently() {
  if (this._socket) {
    this._socket.removeAllListeners('close');
    this.close();
  }
};

Connection.prototype.close = function close() {
  var self = this;

  function closeConnection() {
    debug('close');
    self.destroy();
  }
  if (this.readyState === 'closed') {
    return;
  }
  if (this.isIdle()) {
    return closeConnection();
  }
  this._queue.once('drain', closeConnection);
};

Connection.prototype.destroy = function destroy(err) {
  if (this._socket) {
    this._socket.destroy(err);
  }
};

Connection.prototype.isIdle = function isIdle() {
  return this._queue.empty && !this._queue.busy;
};

Connection.prototype.setAutoCommit = function setAutoCommit(autoCommit) {
  this._transaction.autoCommit = autoCommit;
};

Connection.prototype.setInitialHostAndPort = function setInitialHostAndPort(host, port) {
  this._initialHost = host;
  this._initialPort = port;
};

Connection.prototype.setRedirectHostAndPort = function setRedirectHostAndPort(host, port) {
  this._redirectHost = host;
  this._redirectPort = port;
};

Connection.prototype.setRedirectType = function setRedirectType(type) {
  this._redirectType = type;
};

Connection.prototype._setClientInfo = function _setClientInfo(key, val) {
  this._clientInfo.setProperty(key, val);
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
