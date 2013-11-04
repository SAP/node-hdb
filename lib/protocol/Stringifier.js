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

var util = require('util');
var Transform = require('stream').Transform;

module.exports = Stringifier;

util.inherits(Stringifier, Transform);

function Stringifier(options) {
  options = options || {};

  Transform.call(this, options);

  this._writableState.objectMode = true;

  this._map = options.map;
  this._header = options.header !== undefined ? options.header : '[';
  this._footer = options.footer !== undefined ? options.footer : ']';
  this._seperator = options.seperator !== undefined ? options.seperator : ',';
  this._stringify = options.stringify || JSON.stringify;
  this._first = true;
}

Stringifier.prototype._transform = function (chunk, encoding, done) {
  var str = '';
  if (chunk && chunk.length) {
    if (typeof this._map === 'function') {
      chunk = chunk.map(this.map);
    }
    str = this._first ? this._header : this._seperator;
    this._first = false;
    for (var i = 0; i < chunk.length; i++) {
      if (i > 0)
        str += this._seperator;
      str += this._stringify(chunk[i]);
    }
  }
  done(null, str);
};

Stringifier.prototype._flush = function (done) {
  if (this._first) {
    this.push(this._header + this._footer);
  } else {
    this.push(this._footer);
  }
  done(null);
};