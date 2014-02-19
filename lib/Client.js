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

module.exports = Client;

util.inherits(Client, EventEmitter);

function Client(options) {
  EventEmitter.call(this);

  this._settings = util.extend({
    fetchSize: 1024,
    holdCursorsOverCommit: true,
    scrollableCursor: true,
    reconnect: true
  }, options);
  this._initConnection();
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

Client.prototype._createConnection = function _createConnection(settings) {
  return new Connection(settings);
};

Client.prototype._initConnection = function _initConnection() {
  var connection = this._connection = this._createConnection(this._settings);
  var self = this;

  function cleanup() {
    connection.removeListener('error', onerror);
    connection.removeListener('close', onclose);
  }

  function onerror(err) {
    self.emit('error', err);
  }
  connection.on('error', onerror);

  function onclose(hadError) {
    cleanup();
    self.emit('close', hadError);
    if (hadError && self.get('reconnect')) {
      self.connect();
    }
  }
  connection.on('close', onclose);
};

Client.prototype.setAutoCommit = function setAutoCommit(autoCommit) {
  this._connection.autoCommit = autoCommit;
};

Client.prototype.commit = function commit(cb) {
  function done(err, reply) {
    if (err) {
      return cb(err);
    }
    if (!reply.transactionFlags.committed) {
      err = new Error('Commit has not been confirmed by the server');
      err.code = 'EHDBCOMMIT';
      return cb(err);
    }
    cb(null);
  }
  this._connection.commit(done);
};

Client.prototype.rollback = function rollback(cb) {
  function done(err, reply) {
    if (err) {
      return cb(err);
    }
    if (!reply.transactionFlags.rolledBack) {
      err = new Error('Rollback has not been confirmed by the server');
      err.code = 'EHDBROLLBACK';
      return cb(err);
    }
    cb(null);
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

  var openOptions = util.extend({
    host: this._settings.host,
    port: this._settings.port,
    ssl: this._settings.ssl,
  }, options);

  var authOptions = util.extend({
    user: this._settings.user,
    password: this._settings.password,
    assertion: this._settings.assertion,
    sessionCookie: this._settings.sessionCookie
  }, options);

  // SAML assertion can only be used once
  if (this._settings.assertion) {
    this._settings.assertion = undefined;
  }

  var self = this;

  function done(err) {
    if (!err) {
      self.emit('connect');
    }
    if (util.isFunction(cb)) {
      cb(err);
    }
  }

  function authenticate(err) {
    if (err) {
      return done(err);
    }
    self._connection.connect(authOptions, done);
  }

  if (this._connection.readyState === 'new') {
    this._connection.open(openOptions, authenticate);
  } else if (this._connection.readyState === 'closed') {
    this._initConnection();
    this._connection.open(openOptions, authenticate);
  } else {
    authenticate();
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

Client.prototype.prepare = function prepare(command, cb) {
  var options;
  if (util.isString(command)) {
    options = {
      command: command
    };
  } else if (util.isObject(command)) {
    options = command;
  }

  var statement = new Statement(this._connection);
  this._connection.prepare({
    command: command
  }, function onreply(err, reply) {
    statement.handle(err, reply, cb);
  });
  return this;
};

Client.prototype.destroy = function destroy(err) {
  this._connection.destroy(err);
};

Client.prototype.exec = function exec(command, options, cb) {
  var defaults = {
    autoFetch: true
  };
  executeDirect.call(this, defaults, command, options, cb);
  return this;
};

Client.prototype.execute = function execute(command, options, cb) {
  var defaults = {
    autoFetch: false
  };
  executeDirect.call(this, defaults, command, options, cb);
  return this;
};

function executeDirect(defaults, command, options, cb) {
  /* jshint validthis: true */
  if (util.isFunction(options)) {
    cb = options;
    options = defaults;
  } else if (util.isObject(options)) {
    options = util.extend(defaults, options);
  } else {
    var autoFetch = !! options;
    options = defaults;
    options.autoFetch = autoFetch;
  }
  var executeOptions = {
    command: command,
  };
  var result = new Result(this._connection, options);

  function onreply(err, reply) {
    result.handle(err, reply, cb);
  }
  this._connection.executeDirect(executeOptions, onreply);
}