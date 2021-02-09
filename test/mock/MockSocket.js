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

module.exports = MockSocket;

var lib = require('../../lib');
var EventEmitter = require('events').EventEmitter;
var util = lib.util;

function MockSocket(options) {
  EventEmitter.call(this);
  this.initialized = false;
  this.writable = true;
  this.readable = true;
  this.delay = options.delay || 1;
  this.keepAlive = false;
  this.keepAliveIdle = 0;
  this.invalidInitializationReply = !!options.invalidInitializationReply;
  this.initializationErrorCode = options.initializationErrorCode;
  var chunk;
  if (this.invalidInitializationReply) {
    chunk = new Buffer(5);
  } else if (this.initializationErrorCode) {
    chunk = this.initializationErrorCode;
  } else {
    chunk = new Buffer([4, 20, 0, 4, 1, 0, 0, 0]);
  }
  this.chunks = [chunk];
}

MockSocket.create = function createSocket(options) {
  return new MockSocket(options);
};

util.inherits(MockSocket, EventEmitter);

MockSocket.prototype.write = function write() {
  var chunk = this.chunks.shift();
  var event, data;
  if (Buffer.isBuffer(chunk)) {
    event = 'data';
    data = chunk;
  } else if (util.isString(chunk)) {
    event = 'error';
    data = new Error('Initialization Error');
    data.code = chunk;
  } else {
    event = 'end';
    data = undefined;
  }
  var self = this;
  setTimeout(function () {
    if (!self.invalidInitializationReply &&
      !self.initializationErrorCode &&
      !self.initialized) {
      self.initialized = true;
    }
    self.emit(event, data);
  }, this.delay);
};

MockSocket.prototype.setKeepAlive = function setKeepAlive(enable, time) {
  if (enable) {
    this.keepAlive = true;
    this.keepAliveIdle = time;
  } else {
    this.keepAlive = false;
  }
};

Object.defineProperty(MockSocket.prototype, 'readyState', {
  get: function () {
    if (this.readable && this.writable) {
      return 'open';
    } else if (this.readable && !this.writable) {
      return 'readOnly';
    } else if (!this.readable && this.writable) {
      return 'writeOnly';
    } else {
      return 'closed';
    }
  }
});

MockSocket.prototype.end = function end() {
  this.writable = false;
};

MockSocket.prototype.destroy = function destroy(err) {
  this.readable = false;
  this.writable = false;
  this.emit('close', !!err);
};