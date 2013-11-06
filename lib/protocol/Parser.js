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
var common = require('./common');
var bignum = util.bignum;
var TypeCode = common.TypeCode;

var READ_TINYINT = 'readTinyInt()';
var READ_SMALLINT = 'readSmallInt()';
var READ_INT = 'readInt()';
var READ_BIGINT = 'readBigInt()';
var READ_STRING = 'readBytes(\'utf-8\')';
var READ_BINARY = 'readBytes()';
var READ_DATE = 'readDate()';
var READ_DAYDATE = 'readDayDate()';
var READ_TIME = 'readTime()';
var READ_SECONDTIME = 'readSecondTime()';
var READ_TIMESTAMP = 'readTimestamp()';
var READ_LONGDATE = 'readLongDate()';
var READ_SECONDDATE = 'readSecondDate()';
var READ_LOB = 'readLob(0)';
var READ_NCLOB = 'readLob(1)';
var READ_DOUBLE = 'readDouble()';
var READ_FLOAT = 'readFloat()';
var READ_DECIMAL = 'readDecimal(%d)';

var readFunctionMap = {};
readFunctionMap[TypeCode.TINYINT] = READ_TINYINT;
readFunctionMap[TypeCode.SMALLINT] = READ_SMALLINT;
readFunctionMap[TypeCode.INT] = READ_INT;
readFunctionMap[TypeCode.BIGINT] = READ_BIGINT;
readFunctionMap[TypeCode.STRING] = READ_STRING;
readFunctionMap[TypeCode.VARCHAR1] = READ_STRING;
readFunctionMap[TypeCode.VARCHAR2] = READ_STRING;
readFunctionMap[TypeCode.CHAR] = READ_STRING;
readFunctionMap[TypeCode.NCHAR] = READ_STRING;
readFunctionMap[TypeCode.NVARCHAR] = READ_STRING;
readFunctionMap[TypeCode.NSTRING] = READ_STRING;
readFunctionMap[TypeCode.SHORTTEXT] = READ_STRING;
readFunctionMap[TypeCode.ALPHANUM] = READ_STRING;
readFunctionMap[TypeCode.BINARY] = READ_BINARY;
readFunctionMap[TypeCode.VARBINARY] = READ_BINARY;
readFunctionMap[TypeCode.BSTRING] = READ_BINARY;
readFunctionMap[TypeCode.DATE] = READ_DATE;
readFunctionMap[TypeCode.TIME] = READ_TIME;
readFunctionMap[TypeCode.TIMESTAMP] = READ_TIMESTAMP;
readFunctionMap[TypeCode.DAYDATE] = READ_DAYDATE;
readFunctionMap[TypeCode.SECONDTIME] = READ_SECONDTIME;
readFunctionMap[TypeCode.LONGDATE] = READ_LONGDATE;
readFunctionMap[TypeCode.SECONDDATE] = READ_SECONDDATE;
readFunctionMap[TypeCode.BLOB] = READ_LOB;
readFunctionMap[TypeCode.LOCATOR] = READ_LOB;
readFunctionMap[TypeCode.CLOB] = READ_NCLOB;
readFunctionMap[TypeCode.NCLOB] = READ_NCLOB;
readFunctionMap[TypeCode.NLOCATOR] = READ_NCLOB;
readFunctionMap[TypeCode.TEXT] = READ_NCLOB;
readFunctionMap[TypeCode.DOUBLE] = READ_DOUBLE;
readFunctionMap[TypeCode.REAL] = READ_FLOAT;
readFunctionMap[TypeCode.DECIMAL] = READ_DECIMAL;

function createFunctionBody(metadata, nameProperty) {
  var functionBody = ['var obj = {};'];
  metadata.forEach(function (column, index) {
    var fn = readFunctionMap[column.dataType];
    if (column.dataType === TypeCode.DECIMAL) {
      fn = util.format(fn, column.fraction);
    }
    var key = (typeof nameProperty === 'string') ? column[nameProperty] :
      index;
    functionBody.push('obj["' + key + '"] = this.' + fn + ';');
  });
  functionBody.push('return obj;');
  return functionBody.join('\n');
}

module.exports = Parser;

Parser.DEFAULT_THRESHOLD = 128;

function Parser(metadata, options) {
  /*jshint evil:true */
  options = options || {};
  if (typeof options.nameProperty === 'undefined') {
    options.nameProperty = 'columnDisplayName';
  }
  this._parseRow = new Function(createFunctionBody(metadata, options.nameProperty));
  this._threshold = options.threshold || Parser.DEFAULT_THRESHOLD;
  this._queue = [];
  this.taskId = 0;
  if (typeof setImmediate !== 'undefined') {
    this._setImmediate = setImmediate;
  } else {
    this._setImmediate = process.nextTick;
  }
}

Parser.prototype.parse = function parse(buffer, target, done) {
  var task = new ParserTask(buffer, target, done);
  task.id = ++this.taskId;
  if (this._queue.push(task) === 1) {
    executeTask(this);
  }
};

Parser.prototype.parseParameters = function parseParameters(buffer) {
  return this._parseRow.call(new ParserState(buffer));
};

function executeTask(parser) {
  var task = parser._queue[0];
  if (task.active) return;
  task.active = true;
  var state = task.state;
  var target = task.target;
  var parseRow = parser._parseRow.bind(state);
  var bufferLength = state.buffer.length;

  function read() {
    for (var i = 0; i < parser._threshold && state.offset < bufferLength; i++) {
      target.push(parseRow());
    }
    return state.offset < bufferLength;
  }

  function done(err) {
    task.done(err);
    parser._queue.shift();
    if (err) return;
    if (parser._queue.length) {
      executeTask(parser);
    }
  }

  function next() {
    parser._setImmediate(function () {
      var bytesRemaining;
      try {
        bytesRemaining = read();
      } catch (err) {
        done(err);
        return;
      }
      if (bytesRemaining > 0) {
        next();
      } else {
        done(null);
      }
    });
  }

  next();
}

function ParserTask(buffer, target, callback) {
  this.state = new ParserState(buffer);
  this.active = false;
  var self = this;
  if (typeof target === 'function') {
    this.target = [];
    callback = target;
    this.done = function (err) {
      callback(err, self.target);
    };
  } else {
    this.target = target;
    this.done = function (err) {
      callback(err);
    };
  }
}

function ParserState(buffer) {
  this.buffer = buffer;
  this.offset = 0;
}

ParserState.prototype.readTinyInt = function () {
  if (this.buffer[this.offset++] === 0x00) {
    return null;
  }
  /*
  var uInt = this.buffer[this.offset++];
  if (!(uInt & 0x80))
    return uInt;
  return ((0xff - uInt + 1) * -1);
  */
  var value = this.buffer.readInt8(this.offset);
  this.offset += 1;
  return value;
};

ParserState.prototype.readSmallInt = function () {
  if (this.buffer[this.offset++] === 0x00) {
    return null;
  }
  var value = this.buffer.readInt16LE(this.offset);
  this.offset += 2;
  return value;
};

ParserState.prototype.readInt = function () {
  if (this.buffer[this.offset++] === 0x00) {
    return null;
  }
  var value = this.buffer.readInt32LE(this.offset);
  this.offset += 4;
  return value;
};

ParserState.prototype.readBigInt = function () {
  if (this.buffer[this.offset++] === 0x00) {
    return null;
  }
  var value = bignum.readInt64LE(this.buffer, this.offset);
  this.offset += 8;
  return value;
};

ParserState.prototype.readString = function () {
  this.readBytes('utf-8');
};

ParserState.prototype.readBinary = function () {
  this.readBytes();
};

ParserState.prototype.readBytes = function (encoding) {
  var length = this.buffer[this.offset++];
  switch (length) {
  case 0xff:
    return null;
  case 0xf6:
    length = this.buffer.readInt16LE(this.offset);
    this.offset += 2;
    break;
  case 0xf7:
    length = this.buffer.readInt32LE(this.offset);
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

ParserState.prototype.readDate = function () {
  if (!(this.buffer[this.offset + 1] & 0x80)) {
    this.offset += 4;
    return null;
  }
  var year = this.buffer.readInt16LE(this.offset);
  if (year & 0x8000) year = year & 0x7fff;
  if (year & 0x4000) year = year | 0x8000;
  var month = this.buffer.readInt8(this.offset + 2) + 1;
  var day = this.buffer.readInt8(this.offset + 3);
  this.offset += 4;
  return bignum.lpad4(year) + '-' + bignum.lpad2(month) + '-' + bignum.lpad2(
    day);
};

ParserState.prototype.readTime = function () {
  if (!(this.buffer[this.offset] & 0x80)) {
    this.offset += 4;
    return null;
  }
  var hour = this.buffer.readInt8(this.offset);
  if (hour & 0x80) hour = hour & 0x7f;
  var min = this.buffer.readInt8(this.offset + 1);
  var msec = this.buffer.readUInt16LE(this.offset + 2);
  this.offset += 4;
  return bignum.lpad2(hour) + ':' + bignum.lpad2(min) + ':' + bignum.lpad2(msec /
    1000);
};

ParserState.prototype.readTimestamp = function () {
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

ParserState.prototype.readDayDate = function () {
  var value = this.buffer.readInt32LE(this.offset);
  this.offset += 4;
  if (value === 3652062 || value === 0) {
    return null;
  }
  return value - 1;
};

ParserState.prototype.readSecondTime = function () {
  var value = this.buffer.readInt32LE(this.offset);
  this.offset += 4;
  if (value === 86402 || value === 0) {
    return null;
  }
  return value - 1;
};

ParserState.prototype.readSecondDate = function () {
  var value = bignum.readInt64LE(this.buffer, this.offset);
  this.offset += 8;
  if (value === 315538070401) {
    return null;
  }
  return value - 1;
};

ParserState.prototype.readLongDate = function () {
  var value = bignum.readInt64LE(this.buffer, this.offset);
  this.offset += 8;
  if (value === '3155380704000000001') {
    return null;
  }
  if (typeof value === 'string') {
    var index = value.length - 7;
    return value.substring(0, index) + lpad7(value.substring(index) - 1);
  } else {
    return value - 1;
  }
};

ParserState.prototype.readLob = function readLob(type) {
  // skip source type
  this.offset += 1;
  // offset 1
  var options = this.buffer[this.offset];
  this.offset += 1;
  // offset 2
  if ( !! (options & 0x01)) {
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
  var chunkLength = this.buffer.readInt32LE(this.offset);
  this.offset += 4;
  // offset 32
  var chunk = this.buffer.slice(this.offset, this.offset + chunkLength);
  this.offset += chunkLength;
  // is last
  var isLast = !! (options & 0x04);
  if (isLast) {
    return chunk;
  }
  return {
    type: type,
    locatorId: locatorId,
    charLength: charLength,
    byteLength: byteLength,
    isLast: isLast,
    chunk: chunk
  };
};

ParserState.prototype.readNCLob = function () {
  if (this.buffer[this.offset + 1] === 0x01) {
    this.offset += 2;
    return null;
  }
  var length = this.buffer.readInt32LE(this.offset + 28);
  this.offset += 32;
  var value = this.buffer.toString('utf-8', this.offset, this.offset + length);
  this.offset += length;
  return value;
};

ParserState.prototype.readDouble = function () {
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
  var value = this.buffer.readDoubleLE(this.offset);
  this.offset += 8;
  return value;
};

ParserState.prototype.readFloat = function () {
  if (this.buffer[this.offset] === 0xff && this.buffer[this.offset + 1] ===
    0xff && this.buffer[this.offset + 2] === 0xff && this.buffer[this.offset +
      3] === 0xff) {
    this.offset += 4;
    return null;
  }
  var value = this.buffer.readFloatLE(this.offset);
  this.offset += 4;
  return value;
};

ParserState.prototype.readDecimal = function (fraction) {
  var value;
  if (fraction > 34) {
    value = bignum.readDecFloat(this.buffer, this.offset);
  } else {
    value = bignum.readDecFixed(this.buffer, this.offset, fraction);
  }
  this.offset += 16;
  return value;
};