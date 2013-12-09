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
var common = require('../common');
var TypeCode = common.TypeCode;
var LobOptions = common.LobOptions;
var bignum = util.bignum;

exports.write = write;
exports.getArgumentCount = getArgumentCount;

function write(part, params) {
  /* jshint validthis:true, bitwise:false */

  part = part || {};
  params = params || this;

  var offset = 0;
  var lobs = [];
  var data = [];
  var dataType, value, buffer, i;
  for (i = 0; i < params.length; i++) {
    dataType = DataType[params[i].type];
    value = params[i].value;
    if (typeof value === 'undefined' || value === null) {
      buffer = writeNull(dataType);
    } else {
      buffer = dataType.write(value);
      if (dataType === BLOB || dataType === NCLOB) {
        lobs.push({
          index: i,
          buffer: value
        });
      }
    }
    offset += buffer.length;
    data.push(buffer);
  }
  for (i = 0; i < lobs.length; i++) {
    // update position of lob in part
    data[lobs[i].index].writeInt32LE(offset + 1, 6);
    // append lob to part data
    buffer = lobs[i].buffer;
    offset += buffer.length;
    data.push(buffer);
  }
  part.argumentCount = getArgumentCount(params);
  part.buffer = Buffer.concat(data, offset);
  return part;
}

function getArgumentCount(params) {
  /* jshint unused:false */
  return 1;
}

var REGEX = {
  DATE: /(\d{4})-(\d{2})-(\d{2})/,
  TIME: /(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/,
  TIMESTAMP: /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/,
  DECIMAL: /^([+-])?(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/
};

function writeNull(dataType) {
  /* jshint bitwise:false */
  return new Buffer([dataType.type | 0x80]);
}

function writeTinyInt(value) {
  /* jshint validthis:true */
  var buffer = new Buffer(2);
  buffer[0] = this.type;
  buffer.writeInt8(value, 1);
  return buffer;
}

function writeSmallInt(value) {
  /* jshint validthis:true */
  var buffer = new Buffer(3);
  buffer[0] = this.type;
  buffer.writeInt16LE(value, 1);
  return buffer;
}

function writeInt(value) {
  /* jshint validthis:true */
  var buffer = new Buffer(5);
  buffer[0] = this.type;
  buffer.writeInt32LE(value, 1);
  return buffer;
}

function writeBigInt(value) {
  /* jshint validthis:true */
  var buffer = new Buffer(9);
  buffer[0] = this.type;
  bignum.writeInt64LE(buffer, value, 1);
  return buffer;
}

function writeReal(value) {
  /* jshint validthis:true */
  var buffer = new Buffer(5);
  buffer[0] = this.type;
  buffer.writeFloatLE(value, 1);
  return buffer;
}

function writeDouble(value) {
  /* jshint validthis:true */
  var buffer = new Buffer(9);
  buffer[0] = this.type;
  buffer.writeDoubleLE(value, 1);
  return buffer;
}

function writeDecimal(value) {
  /* jshint validthis:true */
  var decimal;
  if (util.isString(value)) {
    decimal = stringToDecimal(value);
  } else if (util.isNumber(value)) {
    decimal = stringToDecimal(value.toExponential());
  } else {
    throw createInputError('DECIMAL');
  }
  var buffer = new Buffer(17);
  buffer[0] = this.type;
  bignum.writeDec128(buffer, decimal, 1);
  return buffer;
}

function writeString(value) {
  /* jshint validthis:true */
  var length = Buffer.byteLength(value, 'utf8');
  var buffer;
  if (length <= 245) {
    buffer = new Buffer(2 + length);
    buffer[0] = this.type;
    buffer[1] = length;
    buffer.write(value, 2, length, 'utf8');
  } else if (length <= 32767) {
    buffer = new Buffer(4 + length);
    buffer[0] = this.type;
    buffer[1] = 246;
    buffer.writeInt16LE(length, 2);
    buffer.write(value, 4, length, 'utf8');
  } else {
    buffer = new Buffer(6 + length);
    buffer[0] = this.type;
    buffer[1] = 247;
    buffer.writeInt32LE(length, 2);
    buffer.write(value, 6, length, 'utf8');
  }
  return buffer;
}

function writeBinary(value) {
  /* jshint validthis:true */
  var length = value.length;
  var buffer;
  if (length <= 245) {
    buffer = new Buffer(2 + length);
    buffer[0] = this.type;
    buffer[1] = length;
    value.copy(buffer, 2);
  } else if (length <= 32767) {
    buffer = new Buffer(4 + length);
    buffer[0] = this.type;
    buffer[1] = 246;
    buffer.writeInt16LE(length, 2);
    value.copy(buffer, 4);
  } else {
    buffer = new Buffer(6 + length);
    buffer[0] = this.type;
    buffer[1] = 247;
    buffer.writeInt32LE(length, 2);
    value.copy(buffer, 6);
  }
  return buffer;
}

function writeLob(value) {
  /* jshint validthis:true, bitwise:false */
  var buffer = new Buffer(10);
  buffer[0] = this.type;
  buffer[1] = LobOptions.DATA_INCLUDED | LobOptions.LAST_DATA;
  buffer.writeInt32LE(value.length, 2);
  return buffer;
}

function writeTime(value) {
  /* jshint validthis:true, bitwise:false */
  var hours, minutes, milliseconds;
  if (util.isString(value)) {
    var time = value.match(REGEX.TIME);
    if (!time) {
      throw createInputError('TIME');
    }
    hours = ~~time[1];
    minutes = ~~time[2];
    milliseconds = Math.floor(time[3] * 1000);
  } else {
    throw createInputError('TIME');
  }
  var buffer = new Buffer(5);
  buffer[0] = this.type;
  buffer[1] = hours | 0x80;
  buffer[2] = minutes;
  buffer.writeUInt16LE(milliseconds, 3);
  return buffer;
}

function writeDate(value) {
  /* jshint validthis:true, bitwise:false */
  var year, month, day;
  if (util.isString(value)) {
    var date = value.match(REGEX.DATE);
    if (!date) {
      throw createInputError('DATE');
    }
    year = ~~date[1];
    month = ~~date[2] - 1;
    day = ~~date[3];
  } else {
    throw createInputError('DATE');
  }
  var buffer = new Buffer(5);
  buffer[0] = this.type;
  buffer.writeUInt16LE(year, 1);
  buffer[2] |= 0x80;
  buffer[3] = month;
  buffer[4] = day;
  return buffer;
}

function writeTimestamp(value) {
  /* jshint validthis:true, bitwise:false */
  var year, month, day, hours, minutes, milliseconds;
  if (util.isString(value)) {
    var ts = value.match(REGEX.TIMESTAMP);
    if (!ts) {
      throw createInputError('TIMESTAMP');
    }
    year = ~~ts[1];
    month = ~~ts[2] - 1;
    day = ~~ts[3];
    hours = ~~ts[4];
    minutes = ~~ts[5];
    milliseconds = Math.floor(ts[6] * 1000);
  } else {
    throw createInputError('TIMESTAMP');
  }
  var buffer = new Buffer(9);
  buffer[0] = this.type;
  buffer.writeUInt16LE(year, 1);
  buffer[2] |= 0x80;
  buffer[3] = month;
  buffer[4] = day;
  buffer[5] = hours | 0x80;
  buffer[6] = minutes;
  buffer.writeUInt16LE(milliseconds, 7);
  return buffer;
}

function writeDayDate(value) {
  /* jshint validthis:true, unused:false */
  throw createNotImplementedError();
}

function writeSecondTime(value) {
  /* jshint validthis:true, unused:false */
  throw createNotImplementedError();
}

function writeLongDate(value) {
  /* jshint validthis:true, unused:false */
  throw createNotImplementedError();
}

function writeSecondDate(value) {
  /* jshint validthis:true, unused:false */
  throw createNotImplementedError();
}

var TINYINT = {
  type: TypeCode.TINYINT,
  write: writeTinyInt
};

var SMALLINT = {
  type: TypeCode.SMALLINT,
  write: writeSmallInt
};

var INT = {
  type: TypeCode.INT,
  write: writeInt
};

var BIGINT = {
  type: TypeCode.BIGINT,
  write: writeBigInt
};

var STRING = {
  type: TypeCode.STRING,
  write: writeString
};

var NSTRING = {
  type: TypeCode.NSTRING,
  write: writeString
};

var BINARY = {
  type: TypeCode.BINARY,
  write: writeBinary
};

var TIME = {
  type: TypeCode.TIME,
  write: writeTime
};

var DATE = {
  type: TypeCode.DATE,
  write: writeDate
};

var TIMESTAMP = {
  type: TypeCode.TIMESTAMP,
  write: writeTimestamp
};

var BLOB = {
  type: TypeCode.BLOB,
  write: writeLob
};

var NCLOB = {
  type: TypeCode.NCLOB,
  write: writeLob
};

var DOUBLE = {
  type: TypeCode.DOUBLE,
  write: writeDouble
};

var REAL = {
  type: TypeCode.REAL,
  write: writeReal
};

var DECIMAL = {
  type: TypeCode.DECIMAL,
  write: writeDecimal
};

var DAYDATE = {
  type: TypeCode.DAYDATE,
  write: writeDayDate
};

var SECONDTIME = {
  type: TypeCode.SECONDTIME,
  write: writeSecondTime
};

var LONGDATE = {
  type: TypeCode.LONGDATE,
  write: writeLongDate
};

var SECONDDATE = {
  type: TypeCode.SECONDDATE,
  write: writeSecondDate
};

var DataType = {};
// TinyInt
DataType[TypeCode.TINYINT] = TINYINT;
// SmallInt
DataType[TypeCode.SMALLINT] = SMALLINT;
// Int
DataType[TypeCode.INT] = INT;
// BigInt
DataType[TypeCode.BIGINT] = BIGINT;
// Double
DataType[TypeCode.DOUBLE] = DOUBLE;
// Real
DataType[TypeCode.REAL] = REAL;
// Decimal
DataType[TypeCode.DECIMAL] = DECIMAL;
// String
DataType[TypeCode.STRING] = STRING;
DataType[TypeCode.VARCHAR1] = STRING;
DataType[TypeCode.VARCHAR2] = STRING;
DataType[TypeCode.CHAR] = STRING;
DataType[TypeCode.SHORTTEXT] = STRING;
DataType[TypeCode.ALPHANUM] = STRING;
// NString
DataType[TypeCode.NCHAR] = NSTRING;
DataType[TypeCode.NVARCHAR] = NSTRING;
DataType[TypeCode.NSTRING] = NSTRING;
// Binary
DataType[TypeCode.BINARY] = BINARY;
DataType[TypeCode.VARBINARY] = BINARY;
DataType[TypeCode.BSTRING] = BINARY;
// BLob
DataType[TypeCode.BLOB] = BLOB;
DataType[TypeCode.LOCATOR] = BLOB;
// NCLob
DataType[TypeCode.CLOB] = NCLOB;
DataType[TypeCode.NCLOB] = NCLOB;
DataType[TypeCode.NLOCATOR] = NCLOB;
DataType[TypeCode.TEXT] = NCLOB;
// Date
DataType[TypeCode.DATE] = DATE;
// Time
DataType[TypeCode.TIME] = TIME;
// Timestamp
DataType[TypeCode.TIMESTAMP] = TIMESTAMP;
// DayDate
DataType[TypeCode.DAYDATE] = DAYDATE;
// SecondTime
DataType[TypeCode.SECONDTIME] = SECONDTIME;
// LongDate
DataType[TypeCode.LONGDATE] = LONGDATE;
// SecondDate
DataType[TypeCode.SECONDDATE] = SECONDDATE;

function stringToDecimal(str) {
  /* jshint bitwise:false */
  var dec = str.match(REGEX.DECIMAL);
  if (!dec) {
    throw createInputError('DECIMAL');
  }
  var sign = dec[1] === '-' ? -1 : 1;
  var mInt = dec[2] || '0';
  var mFrac = dec[3] || '';
  var exp = ~~dec[4];
  return {
    s: sign,
    m: mInt + mFrac,
    e: exp - mFrac.length
  };
}

function createInputError(type) {
  return new Error(util.format('Wrong input for %s type', type));
}

function createNotImplementedError() {
  return new Error('Not implemented yet');
}