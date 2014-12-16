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
var bignum = util.bignum;

var READ_LOB_REQUEST_LENGTH = 24;

exports.write = write;
exports.read = read;
exports.getByteLength = getByteLength;
exports.getArgumentCount = getArgumentCount;

function write(part, req) {
  /* jshint validthis:true */

  var offset = 0;
  part = part || {};
  req = req || this;

  var buffer = new Buffer(READ_LOB_REQUEST_LENGTH);
  if (Buffer.isBuffer(req.locatorId)) {
    req.locatorId.copy(buffer, offset, 0, 8);
  } else {
    bignum.writeInt64LE(buffer, req.locatorId, offset);
  }
  offset += 8;
  bignum.writeInt64LE(buffer, req.offset, offset);
  offset += 8;
  buffer.writeInt32LE(req.length, offset);
  offset += 4;
  buffer.fill(0x00, offset);
  part.argumentCount = getArgumentCount(req);
  part.buffer = buffer;
  return part;
}

function read(part) {
  var buffer = part.buffer;
  var locatorId = new Buffer(8);
  buffer.copy(locatorId, 0);
  return {
    locatorId: locatorId,
    offset: bignum.readInt64LE(buffer, 8),
    length: buffer.readInt32LE(16)
  };
}

function getByteLength(req) {
  /* jshint unused:false */
  return READ_LOB_REQUEST_LENGTH;
}

function getArgumentCount(req) {
  /* jshint unused:false */
  return 1;
}