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
var lib = require('../hdb').lib;
var util = lib.util;

module.exports = MockConnection;

util.inherits(MockConnection, EventEmitter);

function MockConnection(settings) {
  EventEmitter.call(this);

  this.clientId = 'nodejs@localhost';
  this.connectOptions = {};
  this.autoCommit = true;
  this.readyState = 'new';
  this._settings = settings || {};
  this._hadError = false;
  this._transactionFlags = {
    committed: true,
    rolledBack: true
  };
}

MockConnection.prototype.open = function open(options, cb) {
  /* jshint expr: true */
  var self = this;
  options.should.be.an.Object;
  options.should.have.property('host');
  options.should.have.property('port');
  this.readyState.should.equal('new');
  setTimeout(function () {
    self.emit('open');
    cb();
  }, 1);
};

MockConnection.prototype.setError = function setError(msg) {
  this.emit('error', new Error(msg));
  this._hadError = true;
  util.setImmediate(this.close.bind(this));
};

MockConnection.prototype.close = function close() {
  this.readyState = 'closed';
  this.emit('close', this._hadError);
};

MockConnection.prototype.connect = function connect(options, cb) {
  /* jshint expr: true */
  var self = this;
  options.should.be.an.Object;
  options.should.have.property('user');
  options.should.have.property('password');
  this.readyState = 'connecting';
  util.setImmediate(function () {
    this.readyState = 'connected';
    self.emit('connect');
    cb();
  });
};

MockConnection.prototype.disconnect = function disconnect(cb) {
  /* jshint expr: true */
  var self = this;
  this.readyState = 'disconnecting';
  util.setImmediate(function () {
    this.readyState = 'disconnected';
    self.emit('disconnect');
    cb();
  });
};

MockConnection.prototype.commit = function commit(cb) {
  var self = this;
  util.setImmediate(function () {
    cb(null, {
      transactionFlags: self._transactionFlags
    })
  });
};

MockConnection.prototype.rollback = function rollback(cb) {
  var self = this;
  util.setImmediate(function () {
    cb(null, {
      transactionFlags: self._transactionFlags
    })
  });
};