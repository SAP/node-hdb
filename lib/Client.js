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
var ResultSet = protocol.ResultSet;
var Lob = protocol.Lob;

module.exports = Client;

util.inherits(Client, EventEmitter);

function Client(options) {
  EventEmitter.call(this);

  this._settings = util.extend({}, options);
  this._connection = new Connection();

  var self = this;

  function cleanup() {
    self._connection.removeListener('error', onerror);
  }

  function onerror(err) {
    self.emit('error', err);
  }
  this._connection.on('error', onerror);

  function onclose(hadError) {
    cleanup();
    self.emit('close', hadError);
  }
  this._connection.once('close', onclose);
}

Object.defineProperties(Client.prototype, {
  connectOptions: {
    get: function getConnectOptions() {
      return this._connection.connectOptions;
    }
  },
  clientId: {
    get: function getConnectOptions() {
      return this._connection.clientId;
    }
  },
});

Client.prototype.get = function (key) {
  if (key === undefined) {
    return this._settings;
  }
  return this._settings[key];
};

Client.prototype.set = function (key, value) {
  if (!value && typeof util.isObject(key)) {
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

  var openOptions = {
    host: this._settings.host,
    port: this._settings.port
  };

  var authOptions = util.extend({
    user: this._settings.user,
    password: this._settings.password
  }, options);

  var self = this;
  var connection = this._connection;

  function done(err) {
    if (!err) {
      self.emit('connect');
    }
    if (util.isFunction(cb)) {
      cb(err);
    }
  }

  function authenticate() {
    connection.connect(authOptions, done);
  }

  if (connection.readyState === 'closed') {
    connection.open(openOptions, authenticate);
  } else {
    authenticate();
  }
  return this;
};

Client.prototype.disconnect = function disconnect(cb) {

  function done(err) {
    /* jshint validthis:true */
    if (!err) {
      this.emit('disconnect');
    }
    if (util.isFunction(cb)) {
      cb(err);
    }
  }
  this._connection.disconnect(done.bind(this));
  return this;
};

Client.prototype.end = function end() {
  this._connection.close();
};

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

Client.prototype.exec = function exec(command, options, cb) {
  var defaults = {
    autoFetch: true
  };
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
  var result = new Result(this._connection, options);
  this._connection.executeDirect({
    command: command
  }, function onreply(err, reply) {
    result.handle(err, reply, cb);
  });
  return this;
};