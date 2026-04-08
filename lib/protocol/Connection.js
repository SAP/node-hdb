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

const EventEmitter = require('events').EventEmitter;
const tcp = require('./tcp');
const auth = require('./auth');
const util = require('../util');
const ClientInfo = require('./ClientInfo');
const Transaction = require('./Transaction');
const MessageBuffer = require('./MessageBuffer');
const common = require('./common');
const request = require('./request');
const reply = require('./reply');
const compressor = require('./Compressor');
const createExecuteTask = require('./ExecuteTask').create;
const ReplySegment = reply.Segment;
const part = require('./part');
const DataFormatVersion = require('./common/DataFormatVersion');
const {IgnoreTopologyEnum, SystemInfo} = require('./ConnectionTopology');
const {PhysicalConnection, PhysicalConnectionSet} = require('./PhysicalConnection');
const MessageType = common.MessageType;
const MessageTypeName = common.MessageTypeName;
const SegmentKind = common.SegmentKind;
const ErrorLevel = common.ErrorLevel;
const PartKind = common.PartKind;
const debug = util.debuglog('hdb');
const trace = util.tracelog();

const EMPTY_BUFFER = common.EMPTY_BUFFER;
const DEFAULT_PACKET_SIZE = common.DEFAULT_PACKET_SIZE;
const MINIMUM_PACKET_SIZE = common.MINIMUM_PACKET_SIZE;
const MAXIMUM_PACKET_SIZE = common.MAXIMUM_PACKET_SIZE;
const PACKET_HEADER_LENGTH = common.PACKET_HEADER_LENGTH;
const SEGMENT_HEADER_LENGTH = common.SEGMENT_HEADER_LENGTH;
const PART_HEADER_LENGTH = common.PART_HEADER_LENGTH;
const DEFAULT_SPATIAL_TYPES = common.DEFAULT_SPATIAL_TYPES;
const MIN_COMPRESS_PKT_LEN = common.MIN_COMPRESS_PKT_LEN;
const DEFAULT_IGNORE_TOPOLOGY = IgnoreTopologyEnum.IgnoreTopology_NotIgnoring;
// TODO: connect property 'distribution'
// const DEFAULT_DISTRIBUTION_MODE = common.ClientDistributionMode.STATEMENT_ONLY;

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
  this._ignoreTopology = DEFAULT_IGNORE_TOPOLOGY;
  // TODO: connect property 'distribution'
  // this._distributionMode = DEFAULT_DISTRIBUTION_MODE;
  this._systemInfo = new SystemInfo();
  this._physicalConnections = new PhysicalConnectionSet(this);
  this._clientConnectionIdCounter = 0;
  // TCP connect function used for every PhysicalConnection opened by this logical connection.
  // Defaults to tcp.connect (handles TLS, proxy, keep-alive)
  this._connectFn = tcp.connect;
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
      const pconn = this._physicalConnections.getAnchorConnection();
      // no anchor pconn or no socket ==> connectListener callback in open has not been called
      if (!pconn || !pconn._socket) {
        return 'new';
      }
      // socket is closed ==> socket ended but not closed
      if (pconn._socket.readyState !== 'open') {
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
  },
  spatialTypes: {
    get: function getSpatialTypes() {
      return this._settings.spatialTypes || DEFAULT_SPATIAL_TYPES;
    }
  }
});

// Open an anchor connection
Connection.prototype.open = function open(options, cb) {
  const self = this;

  // Merge initializationTimeout from settings into options for the physical layer
  const pconnOptions = util.extend({}, options);
  if (!pconnOptions.initializationTimeout) {
    pconnOptions.initializationTimeout = self.initializationTimeout;
  }

  // TODO: initialize location based host and port for pconn
  const pconn = new PhysicalConnection(++self._clientConnectionIdCounter, undefined);

  pconn.open(pconnOptions, self._connectFn, function(err) {
    if (err) {
      return cb(err);
    }
    self.host = options['host'];
    self.port = options['port'];
    self.protocolVersion = pconn.protocolVersion;

    // Wire permanent listeners — data is dispatched through Connection.receive()
    function onError(err) {
      const cb = pconn._handshakeReceive || (self._state && self._state.receive);
      if (pconn._handshakeReceive) {
        pconn._handshakeReceive = undefined;
      } else if (self._state) {
        self._state.receive = null;
      }
      if (cb) {
        cb(err);
      } else if (self.listeners('error').length) {
        self.emit('error', err);
      } else {
        debug('onerror', err);
      }
    }

    pconn._addListeners(
      function onData(buffer, sessionId) {
        if (self._state.sessionId !== sessionId) {
          self._state.sessionId = sessionId;
          self._state.packetCount = -1;
        }
        // buffer is already decompressed by pconn
        const receiveCb = pconn._handshakeReceive || self._state.receive;
        pconn._handshakeReceive = undefined;
        self._state.receive = undefined;
        self._state.messageType = undefined;
        self.receive(buffer, receiveCb);
      },
      onError,
      function onClose(hadError) {
        self._cleanup();
        self.emit('close', hadError);
      },
      function onEnd(err) {
        self._clearQueue(err);
        onError(err);
      }
    );

    // Register pconn as the anchor physical connection
    self._physicalConnections.addAnchorConnection(pconn);

    self.emit('open');
    cb();
  });
};


Connection.prototype._cleanup = function _cleanup() {
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

  const pconn = this._physicalConnections.getAnchorConnection();
  if (!pconn) {
    return;
  }

  const state = this._state;
  state.messageType = message.type;
  state.receive = receive;

  const err = pconn.send(message, this.packetSizeLimit);
  if (err) {
    return receive(err);
  }
  // pconn owns sessionId and packetCount; sync back to _state for backward compatibility
  state.sessionId = pconn._sessionId;
  state.packetCount = pconn._packetCount;
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

Connection.prototype._setIgnoreTopology = function (failureReason) {
  if (failureReason === null ||
      failureReason === undefined ||
      failureReason === IgnoreTopologyEnum.IgnoreTopology_NotIgnoring) {
    return;
  }
  this._ignoreTopology = failureReason;
  // TODO: connect property 'distribution'
  // this._distributionMode = common.ClientDistributionMode.OFF;
  // this.connectOptions.setOptions([
  //   {name: common.ConnectOption.CLIENT_DISTRIBUTION_MODE, value: common.ClientDistributionMode.OFF},
  // ]);
};

Connection.prototype._updateTopology = function (topologyUpdateRecords) {
  if (!Array.isArray(topologyUpdateRecords) ||
      topologyUpdateRecords.length === 0 ||
      this._ignoreTopology != IgnoreTopologyEnum.IgnoreTopology_NotIgnoring) {
    return;
  }
  for (let i = 0; i < topologyUpdateRecords.length; ++i) {
    const topologyUpdateRecord = topologyUpdateRecords[i];
    const connectPort = this.port; // TODO: replace connectPort by anchor conn's port
    const {isValid, failureReason} = topologyUpdateRecord.validateAndUpdate(connectPort);
    if (!isValid) {
      // host or port invalid for direct connection or port forwarding detected
      this._setIgnoreTopology(failureReason);
      return;
    }
  }
  const rc = this._systemInfo.addOrUpdateTopology(topologyUpdateRecords);
  if (rc.detectedBadTopology) {
    this._setIgnoreTopology(IgnoreTopologyEnum.IgnoreTopology_InvalidTopology);
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
    this._updateTopology(reply.topologyUpdateRecords);
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
  let queueable;

  if (!this._queue ||
      this.readyState === 'new' ||
      this.readyState === 'closed') {
    const err = new Error('Connection closed');
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
    if(key.toUpperCase() === "DATAFORMATSUPPORT") {
      if (options[key] && options[key] >= 1 && options[key] <= DataFormatVersion.MAX_VERSION) {
        this.connectOptions.setOptions([
          {name : common.ConnectOption.DATA_FORMAT_VERSION,
           value : options[key]},
          {name : common.ConnectOption.DATA_FORMAT_VERSION2,
           value : options[key]}
        ]);
      } else {
        // Raise an error for the invalid data format version
        if (options[key] > DataFormatVersion.MAX_VERSION) {
          return cb(new Error(util.format("Maximum driver supported data format %d is less than client requested %d",
            DataFormatVersion.MAX_VERSION, options[key])));
        } else {
          return cb(new Error(util.format("Data format %s is invalid. Supported values are 1 to %d",
            options[key], DataFormatVersion.MAX_VERSION)));
        }
      }
    } else if (key.toUpperCase() === 'SPATIALTYPES') {
      this._settings['spatialTypes'] = util.getBooleanProperty(options[key]) ? 1 : 0;
    } else if (key.toUpperCase() === 'VECTOROUTPUTTYPE') {
      this._settings['vectorOutputType'] = options[key].toUpperCase() === 'ARRAY' ? 'Array' : 'Buffer';
    } else if (key.toUpperCase() === 'IGNORETOPOLOGY') {
      this._ignoreTopology = util.getBooleanProperty(options[key])
        ? IgnoreTopologyEnum.IgnoreTopology_Requested
        : IgnoreTopologyEnum.IgnoreTopology_NotIgnoring;
    }
    // TODO: update _distributionMode based on connect property 'distribution'
  }
  this.connectOptions.setOptions([
    {name : common.ConnectOption.OS_USER,
     value : this._clientInfo.getUser()}
  ]);
  this.clientContextOptions.setOptions([
    {name : common.ClientContextOption.CLIENT_APPLICATION_PROGRAM,
     value : this._clientInfo.getApplication()}
  ]);

  const compressionFlags = compressor.determineCompressionFlags(options['compress']);
  if(compressionFlags) {
    this.connectOptions.setOptions([{name: common.ConnectOption.COMPRESSION_LEVEL_AND_FLAGS, value: compressionFlags}]);
  }

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

  var authOptions = {
    clientContext: this.clientContextOptions.getOptions(),
    authentication: manager.initialData(),
    useCesu8: self.useCesu8
  };

  if (this._redirectType == common.RedirectType.REDIRECTION_NONE) {
    authOptions.dbConnectInfo = true;
  }

  const pconn = self._physicalConnections.getAnchorConnection();
  pconn.authenticate(self, manager, authOptions, function(err, reply) {
    if (err) {
      return cb(err, reply);
    }
    self._queue.resume();
    cb(null, reply);
  });
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
  const pconn = this._physicalConnections.getAnchorConnection();
  if (pconn && pconn._socket) {
    pconn.closeAllListeners('close');
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
  const pconn = this._physicalConnections.getAnchorConnection();
  if (pconn) {
    pconn.destroy(err);
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
