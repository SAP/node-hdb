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
var bignum = util.bignum;
var common = require('./common');
var LobOptions = common.LobOptions;
var LobSourceType = common.LobSourceType;

module.exports = Reader;

function Reader(buffer, lobFactoy) {
  this.buffer = buffer;
  this.offset = 0;
  this.lobFactoy = lobFactoy;
}

Reader.prototype.hasMore = function hasMore() {
  return this.offset < this.buffer.length;
};

Reader.prototype.readTinyInt = function readTinyInt() {
  if (this.buffer[this.offset++] === 0x00) {
    return null;
  }
  var value = this.buffer.readInt8(this.offset, true);
  this.offset += 1;
  return value;
};

Reader.prototype.readSmallInt = function readSmallInt() {
  if (this.buffer[this.offset++] === 0x00) {
    return null;
  }
  var value = this.buffer.readInt16LE(this.offset, true);
  this.offset += 2;
  return value;
};

Reader.prototype.readInt = function readInt() {
  if (this.buffer[this.offset++] === 0x00) {
    return null;
  }
  var value = this.buffer.readInt32LE(this.offset, true);
  this.offset += 4;
  return value;
};

Reader.prototype.readBigInt = function readBigInt() {
  if (this.buffer[this.offset++] === 0x00) {
    return null;
  }
  var value = bignum.readInt64LE(this.buffer, this.offset);
  this.offset += 8;
  return value;
};

Reader.prototype.readString = function readString() {
  this.readBytes('utf-8');
};

Reader.prototype.readBinary = function readBinary() {
  this.readBytes();
};

Reader.prototype.readBytes = function readBytes(encoding) {
  var length = this.buffer[this.offset++];
  switch (length) {
  case 0xff:
    return null;
  case 0xf6:
    length = this.buffer.readInt16LE(this.offset, true);
    this.offset += 2;
    break;
  case 0xf7:
    length = this.buffer.readInt32LE(this.offset, true);
    this.offset += 4;
    break;
  }
  var value;
  if (encoding) {
    value = this.buffer.toString(encoding, this.offset, this.offset + length);
  } else {
    value = new Buffer(length);
    this.buffer.copy(value, 0, this.offset, this.offset + length);
  }
  this.offset += length;
  return value;
};

Reader.prototype.readDate = function readDate() {
  /* jshint bitwise:false */
  if (!(this.buffer[this.offset + 1] & 0x80)) {
    this.offset += 4;
    return null;
  }
  var year = this.buffer.readInt16LE(this.offset, true);
  if (year & 0x8000) {
    year = year & 0x7fff;
  }
  if (year & 0x4000) {
    year = year | 0x8000;
  }
  var month = this.buffer.readInt8(this.offset + 2, true) + 1;
  var day = this.buffer.readInt8(this.offset + 3, true);
  this.offset += 4;
  return bignum.lpad4(year) + '-' +
    bignum.lpad2(month) + '-' +
    bignum.lpad2(day);
};

Reader.prototype.readTime = function readTime() {
  /* jshint bitwise:false */
  if (!(this.buffer[this.offset] & 0x80)) {
    this.offset += 4;
    return null;
  }
  var hour = this.buffer.readInt8(this.offset, true);
  if (hour & 0x80) {
    hour = hour & 0x7f;
  }
  var min = this.buffer.readInt8(this.offset + 1, true);
  var msec = this.buffer.readUInt16LE(this.offset + 2, true);
  this.offset += 4;
  return bignum.lpad2(hour) + ':' +
    bignum.lpad2(min) + ':' +
    bignum.lpad2(msec / 1000);
};

Reader.prototype.readTimestamp = function readTimestamp() {
  var date = this.readDate();
  var time = this.readTime();
  if (!date && !time) {
    return null;
  } else if (date && time) {
    return date + 'T' + time;
  } else if (date) {
    return date;
  } else {
    return time;
  }
};

Reader.prototype.readDayDate = function readDayDate() {
  var value = this.buffer.readInt32LE(this.offset, true);
  this.offset += 4;
  if (value === 3652062 || value === 0) {
    return null;
  }
  return value - 1;
};

Reader.prototype.readSecondTime = function readSecondTime() {
  var value = this.buffer.readInt32LE(this.offset, true);
  this.offset += 4;
  if (value === 86402 || value === 0) {
    return null;
  }
  return value - 1;
};

Reader.prototype.readSecondDate = function readSecondDate() {
  var value = bignum.readInt64LE(this.buffer, this.offset);
  this.offset += 8;
  if (value === 315538070401) {
    return null;
  }
  return value - 1;
};

Reader.prototype.readLongDate = function readLongDate() {
  var value = bignum.readInt64LE(this.buffer, this.offset);
  this.offset += 8;
  if (value === '3155380704000000001') {
    return null;
  }
  if (typeof value === 'string') {
    var index = value.length - 7;
    return value.substring(0, index) + bignum.lpad7(value.substring(index) -
      1);
  } else {
    return value - 1;
  }
};

Reader.prototype.readLob = function readLob(type) {
  /* jshint bitwise:false, unused:false */
  // offset 0
  type = this.buffer[this.offset] || type;
  this.offset += 1;
  // offset 1
  var options = this.buffer[this.offset];
  this.offset += 1;
  // offset 2
  if (options & LobOptions.NULL_INDICATOR) {
    return null;
  }
  // skip 2 byte filler
  this.offset += 2;
  // offset 4
  var charLength = bignum.readInt64LE(this.buffer, this.offset);
  this.offset += 8;
  // offset 12
  var byteLength = bignum.readInt64LE(this.buffer, this.offset);
  this.offset += 8;
  // offset 20
  var locatorId = this.buffer.slice(this.offset, this.offset + 8);
  this.offset += 8;
  // offset 28
  var chunkLength = this.buffer.readInt32LE(this.offset, true);
  this.offset += 4;
  // offset 32
  var chunk = null;
  if (chunkLength > 0) {
    chunk = this.buffer.slice(this.offset, this.offset + chunkLength);
    this.offset += chunkLength;
  } else {
    chunk = new Buffer(0);
  }
  //if (!byteLength && !charLength) { return null; }
  return this.lobFactoy.createLob(new LobDescriptor(type, locatorId, options,
    chunk));
};

Reader.prototype.readDouble = function readDouble() {
  if (this.buffer[this.offset] === 0xff &&
    this.buffer[this.offset + 1] === 0xff &&
    this.buffer[this.offset + 2] === 0xff &&
    this.buffer[this.offset + 3] === 0xff &&
    this.buffer[this.offset + 4] === 0xff &&
    this.buffer[this.offset + 5] === 0xff &&
    this.buffer[this.offset + 6] === 0xff &&
    this.buffer[this.offset + 7] === 0xff) {
    this.offset += 8;
    return null;
  }
  var value = this.buffer.readDoubleLE(this.offset, true);
  this.offset += 8;
  return value;
};

Reader.prototype.readFloat = function readFloat() {
  if (this.buffer[this.offset] === 0xff &&
    this.buffer[this.offset + 1] === 0xff &&
    this.buffer[this.offset + 2] === 0xff &&
    this.buffer[this.offset + 3] === 0xff) {
    this.offset += 4;
    return null;
  }
  var value = this.buffer.readFloatLE(this.offset, true);
  this.offset += 4;
  return value;
};

Reader.prototype.readDecimal = function readDecimal(fraction) {
  var value;
  if (fraction > 34) {
    value = bignum.readDecFloat(this.buffer, this.offset);
  } else {
    value = bignum.readDecFixed(this.buffer, this.offset, fraction);
  }
  this.offset += 16;
  return value;
};

function LobDescriptor(type, locatorId, options, chunk) {
  this.locatorId = locatorId;
  this.options = options;
  if (Buffer.isBuffer(chunk)) {
    this.chunk = chunk;
    if (type === LobSourceType.CLOB || type === LobSourceType.NCLOB) {
      this.size = chunk.toString('utf-8').length;
    } else {
      this.size = chunk.length;
    }
  } else {
    this.chunk = undefined;
    this.size = 0;
  }
}

Object.defineProperties(LobDescriptor.prototype, {
  isLast: {
    get: function isLast() {
      /* jshint bitwise:false */
      return !!(this.options & LobOptions.LAST_DATA);
    }
  }
});