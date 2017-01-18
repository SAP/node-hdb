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
var Transform = util.stream.Transform;
var Reader = require('./Reader');

module.exports = ResultSetTransform;

util.inherits(ResultSetTransform, Transform);

function ResultSetTransform(parseRow, rs, options) {
  options = options || {};
  // private
  this._parseRow = parseRow;
  this._rs = rs;
  this._threshold = options.threshold || ResultSetTransform.DEFAULT_TRESHHOLD;
  this._arrayMode = normalizeArrayMode(options.arrayMode);
  if (this._arrayMode) {
    this._objectBuffer = new Collector(this, this._arrayMode);
  } else {
    this._objectBuffer = this;
  }
  // call Transform constructor
  options.objectMode = false;
  options.highWaterMark = options.highWaterMark || this._arrayMode ? 4 : 1024;
  Transform.call(this, options);
  this._readableState.objectMode = true;
}

ResultSetTransform.DEFAULT_TRESHHOLD = 128;

ResultSetTransform.prototype._createReader = function _createReader(chunk) {
  return new Reader(chunk, this._rs, this._rs.useCesu8);
};

ResultSetTransform.prototype._transform = function _transform(chunk, encoding,
  done) {
  var reader = this._createReader(chunk);
  var parseRow = this._parseRow.bind(reader);
  var objectBuffer = this._objectBuffer;
  var arrayMode = this._arrayMode;
  var threshold = this._threshold;

  function run() {
    var i = 0;
    try {
      while (reader.hasMore() && i++ < threshold) {
        objectBuffer.push(parseRow());
      }
    } catch (err) {
      return done(err);
    }
    if (reader.hasMore()) {
      return util.setImmediate(run);
    }
    if (arrayMode === true) {
      objectBuffer.flush();
    }
    done();
  }
  util.setImmediate(run);
};

ResultSetTransform.prototype._flush = function _flush(done) {
  if (this._arrayMode > 1) {
    this._objectBuffer.flush();
  }
  this.push(null);
  done();
};

function Collector(readable, mode) {
  this.readable = readable;
  this.rows = [];
  this.flushLength = mode === true ? -1 : mode;
}

Object.defineProperties(Collector.prototype, {
  empty: {
    get: function isEmpty() {
      return !this.rows.length;
    }
  }
});

Collector.prototype.push = function push(row) {
  this.rows.push(row);
  if (this.rows.length === this.flushLength) {
    this.flush();
  }
};

Collector.prototype.flush = function flush() {
  if (this.rows.length) {
    this.readable.push(this.rows);
    this.rows = [];
  }
};

function normalizeArrayMode(mode) {
  /* jshint bitwise:false */
  if (util.isBoolean(mode)) {
    return mode;
  }
  mode = ~~mode;
  if (mode > 1) {
    return mode;
  }
  return false;
}