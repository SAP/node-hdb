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
var lib = require('../../lib');
var util = lib.util;

module.exports = MockConnection;

util.inherits(MockConnection, EventEmitter);

function MockConnection(settings) {
  EventEmitter.call(this);

  this.clientId = 'nodejs@localhost';
  this.connectOptions = {};
  this.autoCommit = true;
  this.readyState = 'new';
  this.options = null;
  this.errors = {
    open: false,
    connect: false,
    executeDirect: false,
    execute: false,
    readLob: false,
    prepare: false,
    commit: false,
    rollback: false,
    dbConnectInfo: false
  };
  this.replies = {
    executeDirect: undefined,
    execute: undefined,
    readLob: undefined,
    dbConnectInfo: undefined
  };
  this._settings = settings || {};
  this._hadError = false;
  this._transactionFlags = {
    committed: true,
    rolledBack: true
  };
}

MockConnection.create = function createConnection(settings) {
  return new MockConnection(settings);
};

MockConnection.prototype.open = function open(options, cb) {
  /* jshint expr: true */
  var self = this;
  options.should.be.an.Object;
  options.should.have.property('host');
  options.should.have.property('port');
  this.readyState.should.equal('new');
  util.setImmediate(function () {
    var err = self.getError('open');
    if (!err) {
      self.emit('open');
    }
    cb(err);
  });
};

MockConnection.prototype.getError = function getError(id) {
  if (this.errors[id]) {
    return new Error(id);
  }
  return null;
};

MockConnection.prototype.getReply = function getReply(id) {
  return this.replies[id];
};


MockConnection.prototype.destroy = function destroy(err) {
  if (err) {
    this.emit('error', err);
    this._hadError = true;
  }
  var self = this;
  util.setImmediate(function () {
    self.close();
  });
};

MockConnection.prototype._closeSilently = function _closeSilently() {
  this.readyState = 'closed';
};

MockConnection.prototype.close = function close() {
  this.readyState = 'closed';
  this.emit('close', this._hadError);
};

MockConnection.prototype.prepare = function prepare(options, cb) {
  var self = this;
  this.options = options;
  util.setImmediate(function () {
    var err = self.getError('prepare');
    cb(err, {
      statementId: 'statementId',
      parameterMetadata: 'parameterMetadata',
      resultSets: [{
        metadata: 'metadata'
      }]
    });
  });
};

MockConnection.prototype.executeDirect = function executeDirect(options, cb) {
  var self = this;
  this.options = options;
  util.setImmediate(function () {
    var err = self.getError('executeDirect');
    var reply = self.getReply('executeDirect');
    cb(err, reply);
  });
};

MockConnection.prototype.execute = function execute(options, cb) {
  var self = this;
  this.options = options;
  util.setImmediate(function () {
    var err = self.getError('execute');
    var reply = self.getReply('execute');
    cb(err, reply);
  });
};

MockConnection.prototype.readLob = function readLob(options, cb) {
  var self = this;
  this.options = options;
  util.setImmediate(function () {
    var err = self.getError('readLob');
    var reply = self.getReply('readLob');
    cb(err, reply);
  });
};

MockConnection.prototype.connect = function connect(options, cb) {
  /* jshint expr: true */
  var self = this;
  this.options = options;
  options.should.be.an.Object;
  options.should.have.property('user');
  options.should.have.property('password');
  this.readyState = 'connecting';
  util.setImmediate(function () {
    var err = self.getError('connect');
    if (err) {
      self.readyState = 'disconnected';
    } else {
      self.readyState = 'connected';
    }
    cb(err);
  });
};

MockConnection.prototype.disconnect = function disconnect(cb) {
  this.readyState = 'disconnecting';
  util.setImmediate(function () {
    this.readyState = 'closed';
    cb();
  });
};

MockConnection.prototype.commit = function commit(cb) {
  var self = this;
  util.setImmediate(function () {
    var err = self.getError('commit');
    cb(err, {
      transactionFlags: self._transactionFlags
    });
  });
};

MockConnection.prototype.rollback = function rollback(cb) {
  var self = this;
  util.setImmediate(function () {
    var err = self.getError('rollback');
    cb(err, {
      transactionFlags: self._transactionFlags
    });
  });
};

MockConnection.prototype.fetchDbConnectInfo = function fetchDbConnectInfo(options, cb) {
  var self = this;
  util.setImmediate(function () {
    var err = self.getError('dbConnectInfo');
    var reply = self.getReply('dbConnectInfo');
    cb(err, reply);
  });
};