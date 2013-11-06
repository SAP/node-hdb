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
var Readable = require('stream').Readable;

module.exports = Lob;

util.inherits(Lob, EventEmitter);

Lob.DEFAULT_READ_SIZE = Math.pow(2, 14);
Lob.MAX_READ_SIZE = Math.pow(2, 18);
Lob.TYPE_BLOB = 0;
Lob.TYPE_CLOB = 1;

function Lob(connection, ld) {
  EventEmitter.call(this);

  this._connection = connection;
  this._running = undefined;
  this._readSize = Lob.DEFAULT_READ_SIZE;
  this.type = ld.type;
  this.id = ld.locatorId;
  this.byteLength = ld.byteLength;
  this.charLength = ld.charLength;
  this.finished = false;
  this.offset = 0;
  this._data = null;
  if (Buffer.isBuffer(ld.chunk) && ld.chunk.length) {
    var size = ld.chunk.length;
    if (this.type === Lob.TYPE_CLOB) {
      size = ld.chunk.toString('utf-8').length;
    }
    this._data = {
      isLast: ld.isLast,
      chunk: ld.chunk,
      size: size
    };
  }
}

Lob.create = function createLob(connection, ld) {
  return new Lob(connection, ld);
};

Object.defineProperties(Lob.prototype, {
  readSize: {
    get: function getFetchSize() {
      return this._readSize;
    }
  }
});

Lob.prototype.setReadSize = function setReadSize(readSize) {
  if (readSize > Lob.MAX_READ_SIZE) {
    this._readSize = Lob.MAX_READ_SIZE;
  }
  this._readSize = readSize;
  return this;
};

Lob.prototype.read = function read(cb) {
  if (typeof this._running !== 'undefined') {
    var err = new Error('Lob invalid state error');
    return cb(err);
  }
  readLob(this, cb);
};

Lob.prototype.createReadStream = function createReadStream(options) {
  if (typeof this._running !== 'undefined') {
    return null;
  }
  return createReadLobStream(this, options);
};

Lob.prototype.stopRead = function stopRead() {
  this._running = false;
  return this;
};

Lob.prototype.startRead = function startRead() {
  if (!this._running && !this.finished) {
    this._running = true;
    if (util.isObject(this._data)) {
      handleData.call(this, this._data);
      this._data = undefined;
    } else {
      sendReadLob.call(this);
    }
  }
  return this;
};

function createReadLobStream(lob, options) {
  options = options || {};
  var readable = new Readable(options);
  readable._read = function _read() {
    lob.startRead();
  };

  function cleanup() {
    lob.removeListener('error', onerror);
    lob.removeListener('data', ondata);
    lob.removeListener('end', onend);
  }

  function onerror(err) {
    cleanup();
    readable.emit('error', err);
  }
  lob.on('error', onerror);

  function ondata(chunk) {
    if (!readable.push(chunk)) {
      lob.stopFetch();
    }
  }
  lob.on('data', ondata);

  function onend() {
    cleanup();
    readable.push(null);
  }
  lob.on('end', onend);

  return readable;
}

function readLob(lob, cb) {
  var offset = 0;
  var buffer = new Buffer(lob.byteLength);

  function done(err) {
    lob.removeListener('error', onerror);
    lob.removeListener('data', ondata);
    lob.removeListener('end', onend);
    if (util.isFunction(cb)) {
      cb(err, buffer);
    }
  }

  function onerror(err) {
    done(err);
  }
  lob.on('error', onerror);

  function ondata(chunk) {
    chunk.copy(buffer, offset);
    offset += chunk.length;
  }
  lob.on('data', ondata);

  function onend() {
    done(null);
  }
  lob.on('end', onend);
  lob.startRead();
}

function sendReadLob() {
  /* jshint validthis:true */

  this._connection.readLob({
    locatorId: this.id,
    offset: this.offset + 1,
    length: this._readSize
  }, receiveData.bind(this));
}

function receiveData(err, reply) {
  /* jshint validthis:true */

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

  if (Buffer.isBuffer(data.chunk)) {
    this.offset += data.size || this._readSize;
    this.emit('data', data.chunk);
  }

  if (data.isLast) {
    this.finished = true;
    this._running = false;
    process.nextTick(this.emit.bind(this, 'end'));
    return;
  }

  if (this._running) {
    process.nextTick(sendReadLob.bind(this));
  }
}