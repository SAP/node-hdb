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

var util = require('./util');
var EventEmitter = require('events').EventEmitter;
var protocol = require('./protocol');
var Connection = protocol.Connection;
var Result = protocol.Result;
var Statement = protocol.Statement;
var ConnectionManager = protocol.ConnectionManager;

module.exports = Client;

util.inherits(Client, EventEmitter);

function Client(options) {
  EventEmitter.call(this);

  this._settings = util.extend({
    fetchSize: 1024,
    holdCursorsOverCommit: true,
    scrollableCursor: true
  }, options);
  this._settings.useCesu8 = (this._settings.useCesu8 !== false);

  this._connection = this._createConnection(this._settings);
}

Object.defineProperties(Client.prototype, {
  connectOptions: {
    get: function getConnectOptions() {
      return this._connection.connectOptions;
    }
  },
  clientId: {
    get: function getClientId() {
      return this._connection.clientId;
    }
  },
  readyState: {
    get: function getreadyState() {
      return this._connection.readyState;
    }
  }
});

Client.prototype._createConnection = Connection.create;
Client.prototype._createResult = Result.create;
Client.prototype._createStatement = Statement.create;

Client.prototype.setAutoCommit = function setAutoCommit(autoCommit) {
  this._connection.autoCommit = autoCommit;
};

Client.prototype.commit = function commit(cb) {
  function done(err, reply) {
    if (util.isFunction(cb)) {
      if (err) {
        return cb(err);
      }
      if (util.isObject(reply.transactionFlags) && !reply.transactionFlags.committed) {
        err = new Error('Commit has not been confirmed by the server');
        err.code = 'EHDBCOMMIT';
        return cb(err);
      }
      cb(null);
    }
  }
  this._connection.commit(done);
};

Client.prototype.rollback = function rollback(cb) {
  function done(err, reply) {
    if (util.isFunction(cb)) {
      if (err) {
        return cb(err);
      }
      if (util.isObject(reply.transactionFlags) && !reply.transactionFlags.rolledBack) {
        err = new Error('Rollback has not been confirmed by the server');
        err.code = 'EHDBROLLBACK';
        return cb(err);
      }
      cb(null);
    }
  }
  this._connection.rollback(done);
};

Client.prototype.get = function (key) {
  if (util.isUndefined(key)) {
    return this._settings;
  }
  return this._settings[key];
};

Client.prototype.set = function (key, value) {
  if (!value && util.isObject(key)) {
    this._settings = util.extend(this._settings, key);
  } else {
    this._settings[key] = value;
  }
  return this;
};

Client.prototype.connect = function connect(options, cb) {
  if (util.isFunction(options)) {
    cb = options;
    options = {};
  }
  var connectOptions = util.extend({}, this._settings, options);
  var connManager = new ConnectionManager(connectOptions);

  // SAML assertion can only be used once
  if (this._settings.assertion) {
    this._settings.assertion = undefined;
  }

  // JWT token can only be used once
  if (this._settings.token) {
    this._settings.token = undefined;
  }

  var self = this;

  function done(err, reply) {
    if (err) {
      var dbi = reply && reply['dbConnectInfo'];
      if (dbi && self._connection._redirectType == protocol.common.RedirectType.REDIRECTION_NONE) {
        // Abandon connection and reconnect to provided host/port
        var host, port;
        dbi.forEach(function(option) {
          if (option['name'] === protocol.common.DbConnectInfoOption.HOST) {
            host = option['value'];
          } else if (option['name'] === protocol.common.DbConnectInfoOption.PORT) {
            port = option['value'];
          }
        });
        self.set({
          host: host,
          port: port
        });
        connectOptions = util.extend({}, self._settings, options);
        self._connection._closeSilently();
        doRedirect();
        return;
      }
    } else {
      self.emit('connect');
    }
    if (util.isFunction(cb)) {
      cb(err);
    }
  }

  function onopen(err) {
    if (err) {
      return done(err);
    }
    self._addListeners(self._connection);
    self._connection.connect(connectOptions, done);
  }

  function doRedirect() {
    var initialHost = self._connection.host;
    var initialPort = self._connection.port;

    self._connection = self._createConnection(self._settings);
    self._connection.setInitialHostAndPort(initialHost, initialPort);
    self._connection.setRedirectHostAndPort(self._settings.host, self._settings.port);
    self._connection.setRedirectType(protocol.common.RedirectType.REDIRECTION_TENANTWITHAZAWARE);
    connManager = new ConnectionManager(connectOptions);
    connManager.openConnection(self._connection, onopen);
  }

  if (this._connection.readyState === 'new') {
    connManager.openConnection(this._connection, onopen);
  } else if (this._connection.readyState === 'closed') {
    this._connection = this._createConnection(this._settings);
    connManager.openConnection(this._connection, onopen);
  } else if (this._connection.readyState === 'disconnected') {
    this._connection.connect(connectOptions, done);
  } else {
    if (util.isFunction(cb)) {
      util.setImmediate(function deferError() {
        var msg = util.format('Cannot connect in state "%s"', self.readyState);
        var err = new Error(msg);
        err.code = 'EHDBCONNECT';
        cb(err);
      });
    }
  }
  return this;
};

Client.prototype.disconnect = function disconnect(cb) {
  var self = this;

  function done(err) {
    if (!err) {
      self.emit('disconnect');
    }
    if (util.isFunction(cb)) {
      cb(err);
    }
  }
  this._connection.disconnect(done);
  return this;
};

Client.prototype.close = function close() {
  this._connection.close();
};
Client.prototype.end = Client.prototype.close;

Client.prototype.destroy = function destroy(err) {
  this._connection.destroy(err);
};

Client.prototype.prepare = function prepare(command, options, cb) {
  /* jshint unused:false */
  return Client.prototype._prepare.apply(this, normalizeArguments(arguments, {}));
};

Client.prototype.exec = function exec(command, options, cb) {
  /* jshint unused:false */
  return Client.prototype._execute.apply(this, normalizeArguments(arguments, {
    autoFetch: true
  }));
};

Client.prototype.execute = function execute(command, options, cb) {
  /* jshint unused:false */
  return Client.prototype._execute.apply(this, normalizeArguments(arguments, {
    autoFetch: false
  }));
};

Client.prototype.setClientInfo = function setClientInfo(key, val) {
  if(key == null || val == null || String(key).length == 0 || String(val).length == 0) {
    var err = new Error('Invalid arguments for Client.setClientInfo()');
    if (this.listeners('error').length) {
      this.emit('error', err);
    } else {
      throw(err);
    }
  } else {
    this._connection._setClientInfo(String(key), String(val));
  }
};

Client.prototype._execute = function _execute(command, options, cb) {
  var result = this._createResult(this._connection, options);
  this._connection.executeDirect({
    command: command
  }, function handleReply(err, reply) {
    result.handle(err, reply, cb);
  });
  return this;
};

Client.prototype._prepare = function _prepare(command, options, cb) {
  var statement = this._createStatement(this._connection, options);
  this._connection.prepare({
    command: command
  }, function handleReply(err, reply) {
    statement.handle(err, reply, cb);
  });
  return this;
};

Client.prototype._addListeners = function _addListeners(connection) {
  var self = this;

  function cleanup() {
    connection.removeListener('error', onerror);
    connection.removeListener('close', onclose);
  }

  function onerror(err) {
   if (self.listeners('error').length) {
      self.emit('error', err);
    }
  }
  connection.on('error', onerror);

  function onclose(hadError) {
    cleanup();
    self.emit('close', hadError);
  }
  connection.on('close', onclose);
};

function normalizeArguments(args, defaults) {
  var command = args[0];
  var options = args[1];
  var cb = args[2];
  defaults = defaults || {};
  if (util.isFunction(options)) {
    cb = options;
    if (util.isObject(command)) {
      options = util.extend(defaults, command);
      if (options.command) {
        command = options.command;
        options.command = undefined;
      } else if (options.sql) {
        command = options.sql;
        options.sql = undefined;
      }
    } else {
      options = defaults;
    }
  } else {
    options = util.extend(defaults, options);
  }
  return [command, options, cb];
}
