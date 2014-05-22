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

var util = require('../util');
var EventEmitter = require('events').EventEmitter;
var debug = util.debuglog('hdb_lob');

module.exports = Lob;

util.inherits(Lob, EventEmitter);

Lob.DEFAULT_READ_SIZE = Math.pow(2, 17);
Lob.MAX_READ_SIZE = Math.pow(2, 18);

function Lob(readLob, ld, options) {
  EventEmitter.call(this);
  // public
  this.locatorId = ld.locatorId;
  this.finished = false;
  // private
  this._readLob = readLob;
  this._running = undefined;
  this._offset = 0;
  options = options || {};
  this._readSize = options.readSize || Lob.DEFAULT_READ_SIZE;
  this._data = undefined;
  if (ld.chunk) {
    this._data = ld;
  }
}

Lob.prototype.pause = function pause() {
  this._running = false;
};

Lob.prototype.resume = function resume() {
  if (this._running || this.finished) {
    return;
  }
  this._running = true;
  if (util.isObject(this._data)) {
    handleData.call(this, this._data);
    this._data = undefined;
  } else {
    sendReadLob.call(this);
  }
};

Lob.prototype.end = function end() {
  this.finished = true;
  this._running = false;
  this._connection = undefined;
  process.nextTick(emitEnd.bind(this));
};

function emitEnd() {
  /* jshint validthis:true */
  debug('emit "end"');
  this.emit('end');
}

Lob.prototype.read = function read(cb) {
  if (!util.isUndefined(this._running)) {
    var err = new Error('Lob invalid state error');
    return cb(err);
  }

  util.readData(this, cb);
};

Lob.prototype.createReadStream = function createReadStream(options) {
  if (!util.isUndefined(this._running)) {
    return null;
  }

  return util.createReadStream(this, ['error'], options);
};

function sendReadLob() {
  /* jshint validthis:true */
  debug('sendReadLob', this.locatorId);
  this._readLob({
    locatorId: this.locatorId,
    offset: this._offset + 1,
    length: this._readSize
  }, receiveData.bind(this));
}

function receiveData(err, reply) {
  /* jshint validthis:true */
  debug('receiveData()');
  if (err) {
    this._running = false;
    this.emit('error', err);
    return;
  }

  var data = reply.readLobReply;
  if (this._running) {
    handleData.call(this, data);
  } else {
    this._data = data;
  }
}

function handleData(data) {
  /* jshint validthis:true */
  var size = data.size || this._readSize;
  debug('handleData(%d)', size);
  if (Buffer.isBuffer(data.chunk)) {
    this._offset += size;
    this.emit('data', data.chunk);
  }

  if (data.isLast) {
    return this.end();
  }

  if (this._running) {
    process.nextTick(sendReadLob.bind(this));
  }
}