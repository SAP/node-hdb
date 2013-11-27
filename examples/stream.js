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

var util = require('../lib/util');

var EventEmitter = require('events').EventEmitter;
var Writable = util.stream.Writable;
var Stream = require('stream').Stream;
var concatStream = require('concat-stream');
var fstream = require('fstream');

util.inherits(FstreamWriter, EventEmitter);

function FstreamWriter(statement, createParams) {
  EventEmitter.call(this);
  this._end = false;
  this._busy = false;
  this._statement = statement;
  this._createParams = createParams;
}

FstreamWriter.prototype.execStatement = function execStatement(entry, data) {
  var self = this;
  var params = this._createParams(entry.props, data);

  function handleResult(err) {
    self._busy = false;
    if (err) {
      return self.emit('error', err);
    }
    if (self._end) {
      return self.emit('close');
    }
    entry.resume();
  }
  this._statement.exec(params, handleResult);
};

FstreamWriter.prototype.add = function add(entry) {
  var self = this;
  if (this._end) {
    return;
  }

  function handleData(data) {
    entry.pause();
    self._busy = true;
    self.execStatement(entry, data);
  }
  entry.pipe(concatStream(handleData));
  return true;
};

FstreamWriter.prototype.end = function end() {
  this._end = true;
  this.emit('end');
  if (!this._busy) {
    this.emit('close');
  }
};

util.inherits(FstreamReader, Writable);

function FstreamReader(createEntry) {
  Writable.call(this, {
    objectMode: true,
    highWaterMark: 128
  });
  this._done = undefined;
  this._destination = undefined;
  this._createEntry = createEntry;
}

Object.defineProperty(FstreamReader.prototype, 'readable', {
  get: function getReadable() {
    return !!this._done;
  }
});

FstreamReader.prototype._write = function _write(row, encoding, done) {
  var entry = this._createEntry(row);
  var notBusy = this._destination.add(entry);
  if (notBusy !== false) {
    return done();
  }
  if (this._done) {
    throw new Error('Do not call _write before previous _write has been done');
  }
  this._done = done;
};

FstreamReader.prototype.pause = function pause() {}

FstreamReader.prototype.resume = function resume() {
  if (this._done) {
    var done = this._done;
    this._done = undefined;
    done();
  }
};

FstreamReader.prototype.pipe = function pipe(dest) {
  this._destination = dest;
  this.once('finish', function onfinish() {
    dest.end();
  });
  return Stream.prototype.pipe.call(this, dest)
}

exports.Writer = createWriteStream;

function createWriteStream(statement, createParams) {
  return new FstreamWriter(statement, createParams);
}

exports.Reader = createReadStream;

function createReadStream(createEntry) {
  return new FstreamReader(createEntry);
}