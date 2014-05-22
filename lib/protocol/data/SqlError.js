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

var util = require('../../util');
var ErrorLevel = require('../common/ErrorLevel');

exports.read = read;
exports.getByteLength = getByteLength;
exports.getArgumentCount = getArgumentCount;

function read(part) {
  var err = new SqlError();
  _read.call(err, part.buffer, 0);
  return err;
}

function _read(buffer, offset) {
  /* jshint validthis:true */

  offset = offset || 0;
  this.code = buffer.readInt32LE(offset);
  offset += 4;
  this.position = buffer.readInt32LE(offset);
  offset += 4;
  var length = buffer.readInt32LE(offset);
  offset += 4;
  this.level = buffer.readInt8(offset);
  if (this.level === ErrorLevel.FATAL) {
    this.fatal = true;
  }
  offset += 1;
  this.sqlState = buffer.toString('ascii', offset, offset + 5);
  offset += 5;
  this.message = buffer.toString('utf-8', offset, offset + length);
  offset += util.alignLength(length, 8);
  return offset;
}

function getByteLength(err) {
  return 18 + Buffer.byteLength(err.message);
}

function getArgumentCount(err) {
  /* jshint unused:false */
  return 1;
}

util.inherits(SqlError, Error);

function SqlError() {
  Error.call(this);

  this.message = undefined;
  this.code = undefined;
  this.sqlState = undefined;
  this.level = undefined;
  this.position = undefined;
}