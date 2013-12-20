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
var Readable = util.stream.Readable;
var common = require('./common');
var TypeCode = common.TypeCode;
var LobOptions = common.LobOptions;
var bignum = util.bignum;

module.exports = Writer;

var NormalizedTypeCode = {};
// TinyInt
NormalizedTypeCode[TypeCode.TINYINT] = TypeCode.TINYINT;
// SmallInt
NormalizedTypeCode[TypeCode.SMALLINT] = TypeCode.SMALLINT;
// Int
NormalizedTypeCode[TypeCode.INT] = TypeCode.INT;
// BigInt
NormalizedTypeCode[TypeCode.BIGINT] = TypeCode.BIGINT;
// Double
NormalizedTypeCode[TypeCode.DOUBLE] = TypeCode.DOUBLE;
// Real
NormalizedTypeCode[TypeCode.REAL] = TypeCode.REAL;
// Decimal
NormalizedTypeCode[TypeCode.DECIMAL] = TypeCode.DECIMAL;
// String
NormalizedTypeCode[TypeCode.STRING] = TypeCode.STRING;
NormalizedTypeCode[TypeCode.VARCHAR1] = TypeCode.STRING;
NormalizedTypeCode[TypeCode.VARCHAR2] = TypeCode.STRING;
NormalizedTypeCode[TypeCode.CHAR] = TypeCode.STRING;
NormalizedTypeCode[TypeCode.SHORTTEXT] = TypeCode.STRING;
NormalizedTypeCode[TypeCode.ALPHANUM] = TypeCode.STRING;
// NString
NormalizedTypeCode[TypeCode.NCHAR] = TypeCode.NSTRING;
NormalizedTypeCode[TypeCode.NVARCHAR] = TypeCode.NSTRING;
NormalizedTypeCode[TypeCode.NSTRING] = TypeCode.NSTRING;
// Binary
NormalizedTypeCode[TypeCode.BINARY] = TypeCode.BINARY;
NormalizedTypeCode[TypeCode.VARBINARY] = TypeCode.BINARY;
NormalizedTypeCode[TypeCode.BSTRING] = TypeCode.BINARY;
// BLob
NormalizedTypeCode[TypeCode.BLOB] = TypeCode.BLOB;
NormalizedTypeCode[TypeCode.LOCATOR] = TypeCode.BLOB;
// NCLob
NormalizedTypeCode[TypeCode.CLOB] = TypeCode.NCLOB;
NormalizedTypeCode[TypeCode.NCLOB] = TypeCode.NCLOB;
NormalizedTypeCode[TypeCode.NLOCATOR] = TypeCode.NCLOB;
NormalizedTypeCode[TypeCode.TEXT] = TypeCode.NCLOB;
// Date
NormalizedTypeCode[TypeCode.DATE] = TypeCode.DATE;
// Time
NormalizedTypeCode[TypeCode.TIME] = TypeCode.TIME;
// Timestamp
NormalizedTypeCode[TypeCode.TIMESTAMP] = TypeCode.TIMESTAMP;
// DayDate
NormalizedTypeCode[TypeCode.DAYDATE] = TypeCode.DAYDATE;
// SecondTime
NormalizedTypeCode[TypeCode.SECONDTIME] = TypeCode.SECONDTIME;
// LongDate
NormalizedTypeCode[TypeCode.LONGDATE] = TypeCode.LONGDATE;
// SecondDate
NormalizedTypeCode[TypeCode.SECONDDATE] = TypeCode.SECONDDATE;

var REGEX = {
  DATE: /(\d{4})-(\d{2})-(\d{2})/,
  TIME: /(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/,
  TIMESTAMP: /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/,
  DECIMAL: /^([+-])?(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/
};

function Writer() {
  this._buffers = [];
  this._bytesWritten = 0;
  this._lobs = [];
  this._count = 0;
}

Writer.create = function createWriter(params) {
  var writer = new Writer(params);
  if (util.isArray(params)) {
    for (var i = 0; i < params.length; i++) {
      writer.add(params[i]);
    }
  }
  return writer;
};

Object.defineProperties(Writer.prototype, {
  truncated: {
    get: function isTruncated() {
      return !!this._lobs.length;
    }
  },
  finished: {
    get: function isFinished() {
      return !this._lobs.length;
    }
  },
});

Writer.prototype.add = function add(p) {
  var type = NormalizedTypeCode[p.type];
  var value = p.value;
  if (typeof value === 'undefined' || value === null) {
    this.writeNull(type);
  } else {
    this[type](value);
  }
};

Writer.prototype.write = function write(buffer, value) {
  this._bytesWritten += buffer.length;
  var index = this._buffers.push(buffer) - 1;
  if (util.isObject(value)) {
    var stream;
    if (Buffer.isBuffer(value)) {
      stream = new Readable();
      stream.push(value);
      stream.push(null);
    } else if (value instanceof Readable) {
      stream = value;
    } else if (value.readable === true) {
      stream = new Readable().wrap(value);
    } else {
      throw new Error('Invalid lob value');
    }
    if (stream) {
      this._lobs.push({
        index: index,
        stream: stream
      });
    }
  }
};

Writer.prototype.finializeParameters = function finializeParameters(
  bytesRemaining, cb) {
  var self = this;
  var stream, buffer;

  function finalize() {
    /* jshint bitwise:false */
    // update lob options in buffer
    buffer[1] |= LobOptions.LAST_DATA;
    // remove current lob from stack
    self._lobs.shift();
  }

  function cleanup() {
    // remove event listeners
    stream.removeListener('error', onerror);
    stream.removeListener('end', onend);
    stream.removeListener('readable', onreadable);
  }

  function onerror(err) {
    /* jshint validthis:true */
    cleanup();
    // stop appending on error
    cb(err);
  }

  function onend() {
    /* jshint validthis:true */
    cleanup();
    // finalize lob
    finalize();
    // process next lob in stack
    util.setImmediate(next);
  }

  function onreadable() {
    /* jshint validthis:true */
    var chunk = this.read(bytesRemaining);
    if (chunk === null) {
      chunk = this.read();
    }
    if (chunk === null) {
      return;
    }
    if (chunk.length > bytesRemaining) {
      throw new Error('Chunk length larger than remaining bytes');
    }
    // update lob length in buffer
    var length = buffer.readInt32LE(2);
    length += chunk.length;
    buffer.writeInt32LE(length, 2);
    // write chunk
    self.write(chunk);
    bytesRemaining -= chunk.length;
    // stop appending if there is no remaining space
    if (bytesRemaining === 0) {
      cleanup();
      // finalize lob if the stream has already ended
      // because of cleanup we don't get end event in this case
      var state = this._readableState;
      if (state.ended && !state.length) {
        finalize();
      }
      // we are done
      cb(null);
    }
  }

  function next() {
    if (!self._lobs.length || !bytesRemaining) {
      return cb(null);
    }
    var lob = self._lobs[0];
    // set reabable stream
    stream = lob.stream;
    // set lob buffer
    buffer = self._buffers[lob.index];
    // update lob options in buffer
    buffer[1] = LobOptions.DATA_INCLUDED;
    // update lob position in buffer
    var position = self._bytesWritten + 1;
    buffer.writeInt32LE(position, 6);
    // register event handlers
    stream.on('error', onerror);
    stream.on('end', onend);
    stream.on('readable', onreadable);
    onreadable.call(stream);
  }

  util.setImmediate(next);
};

Writer.prototype.getParameters = function getParameters(bytesAvailable, cb) {
  var self = this;

  function convertLob(lob) {
    return {
      locatorId: undefined,
      stream: lob.stream
    };
  }

  function done(err) {
    if (err) {
      return cb(err);
    }
    var buffer = Buffer.concat(self._buffers, self._bytesWritten);
    self._buffers = [];
    self._bytesWritten = 0;
    self._lobs = self._lobs.map(convertLob);
    cb(null, buffer);
  }
  var bytesRemaining = bytesAvailable - this._bytesWritten;
  this.finializeParameters(bytesRemaining, done);
};


Writer.prototype.finalizeWriteLobRequest = function finalizeWriteLobRequest(
  bytesRemaining, cb) {
  var self = this;
  var stream, buffer;

  function cleanup() {
    // remove event listeners
    stream.removeListener('error', onerror);
    stream.removeListener('end', onend);
    stream.removeListener('readable', onreadable);
  }

  function onerror(err) {
    /* jshint validthis:true */
    cleanup();
    // stop appending on error
    cb(err);
  }

  function finalize() {
    /* jshint bitwise:false */
    // update lob options in buffer
    buffer[8] |= LobOptions.LAST_DATA;
    // remove current lob from stack
    self._lobs.shift();
  }

  function onend() {
    /* jshint validthis:true */
    cleanup();
    // finalize lob
    finalize();
    // process next lob in stack
    util.setImmediate(next);
  }

  function onreadable() {
    /* jshint validthis:true */
    var chunk = this.read(bytesRemaining);
    if (chunk === null) {
      chunk = this.read();
    }
    if (chunk === null) {
      return;
    }
    if (chunk.length > bytesRemaining) {
      throw new Error('Chunk length large than remaining bytes');
    }
    // update lob length in buffer
    var length = buffer.readInt32LE(17);
    length += chunk.length;
    buffer.writeInt32LE(length, 17);
    // write chunk
    self.write(chunk);
    bytesRemaining -= chunk.length;
    // stop appending if there is no remaining space
    if (bytesRemaining === 0) {
      cleanup();
      // finalize lob if the stream has already ended
      // because of cleanup we don't get end event in this case
      var state = this._readableState;
      if (state.ended && !state.length) {
        finalize();
      }
      // we are done
      cb(null);
    }
  }

  function next() {
    if (!self._lobs.length || !bytesRemaining) {
      return cb(null);
    }
    var lob = self._lobs[0];
    // set reabable stream
    stream = lob.stream;
    // set lob buffer
    buffer = new Buffer(21);
    // set locatorId
    lob.locatorId.copy(buffer, 0);
    // update lob options in buffer
    buffer[8] = LobOptions.DATA_INCLUDED;
    // offset 0 means append
    buffer.fill(0x00, 9, 17);
    // length
    buffer.writeInt32LE(0, 17);
    // write header
    self.write(buffer);
    bytesRemaining -= buffer.length;
    // increase count
    self._count += 1;
    // register event handlers
    stream.on('error', onerror);
    stream.on('end', onend);
    stream.on('readable', onreadable);
    onreadable.call(stream);
  }

  util.setImmediate(next);
};

Writer.prototype.getWriteLobRequest = function getWriteLobRequest(
  bytesRemaining, cb) {
  var self = this;

  function done(err) {
    if (err) {
      return cb(err);
    }
    var part = {
      argumentCount: self._count,
      buffer: Buffer.concat(self._buffers, self._bytesWritten)
    };
    cb(null, part);
  }
  this._buffers = [];
  this._bytesWritten = 0;
  this._count = 0;
  this.finalizeWriteLobRequest(bytesRemaining, done);
};

Writer.prototype.update = function update(writeLobReply) {
  var locatorId;
  for (var i = 0; i < this._lobs.length; i++) {
    locatorId = writeLobReply[i];
    if (Buffer.isBuffer(locatorId)) {
      this._lobs[i].locatorId = locatorId;
    }
  }
};

Writer.prototype.writeNull = function writeNull(type) {
  /* jshint bitwise:false */
  var buffer = new Buffer([NormalizedTypeCode[type] | 0x80]);
  this.write(buffer);
};

Writer.prototype[TypeCode.TINYINT] = function writeTinyInt(value) {
  var buffer = new Buffer(2);
  buffer[0] = TypeCode.TINYINT;
  buffer.writeUInt8(value, 1);
  this.write(buffer);
};

Writer.prototype[TypeCode.SMALLINT] = function writeSmallInt(value) {
  var buffer = new Buffer(3);
  buffer[0] = TypeCode.SMALLINT;
  buffer.writeInt16LE(value, 1);
  this.write(buffer);
};

Writer.prototype[TypeCode.INT] = function writeInt(value) {
  var buffer = new Buffer(5);
  buffer[0] = TypeCode.INT;
  buffer.writeInt32LE(value, 1);
  this.write(buffer);
};

Writer.prototype[TypeCode.BIGINT] = function writeBigInt(value) {
  var buffer = new Buffer(9);
  buffer[0] = TypeCode.BIGINT;
  bignum.writeInt64LE(buffer, value, 1);
  this.write(buffer);
};

Writer.prototype[TypeCode.REAL] = function writeReal(value) {
  var buffer = new Buffer(5);
  buffer[0] = TypeCode.REAL;
  buffer.writeFloatLE(value, 1);
  this.write(buffer);
};

Writer.prototype[TypeCode.DOUBLE] = function writeDouble(value) {
  var buffer = new Buffer(9);
  buffer[0] = TypeCode.DOUBLE;
  buffer.writeDoubleLE(value, 1);
  this.write(buffer);
};

Writer.prototype[TypeCode.DECIMAL] = function writeDecimal(value) {
  var decimal;
  if (util.isString(value)) {
    decimal = stringToDecimal(value);
  } else if (util.isNumber(value)) {
    decimal = stringToDecimal(value.toExponential());
  } else {
    throw createInputError('DECIMAL');
  }
  var buffer = new Buffer(17);
  buffer[0] = TypeCode.DECIMAL;
  bignum.writeDec128(buffer, decimal, 1);
  this.write(buffer);
};

Writer.prototype[TypeCode.NSTRING] = function writeNString(value) {
  this.writeCharacters(value, 'utf8');
};

Writer.prototype[TypeCode.STRING] = function writeString(value) {
  this.writeCharacters(value, 'ascii');
};

Writer.prototype.writeCharacters = function writeCharacters(value, encoding) {
  var type = encoding === 'ascii' ? TypeCode.STRING : TypeCode.NSTRING;
  var length = Buffer.byteLength(value, encoding);
  var buffer;
  if (length <= 245) {
    buffer = new Buffer(2 + length);
    buffer[0] = type;
    buffer[1] = length;
    buffer.write(value, 2, length, encoding);
  } else if (length <= 32767) {
    buffer = new Buffer(4 + length);
    buffer[0] = type;
    buffer[1] = 246;
    buffer.writeInt16LE(length, 2);
    buffer.write(value, 4, length, encoding);
  } else {
    buffer = new Buffer(6 + length);
    buffer[0] = type;
    buffer[1] = 247;
    buffer.writeInt32LE(length, 2);
    buffer.write(value, 6, length, encoding);
  }
  this.write(buffer);
};

Writer.prototype[TypeCode.BINARY] = function writeBinary(value) {
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
  this.write(buffer);
};

Writer.prototype[TypeCode.BLOB] = function writeBLob(value) {
  var buffer = new Buffer(10);
  buffer.fill(0x00);
  buffer[0] = TypeCode.BLOB;
  this.write(buffer, value);
};

Writer.prototype[TypeCode.NCLOB] = function writeNCLob(value) {
  var buffer = new Buffer(10);
  buffer.fill(0x00);
  buffer[0] = TypeCode.NCLOB;
  this.write(buffer, value);
};

Writer.prototype[TypeCode.TIME] = function writeTime(value) {
  /* jshint bitwise:false */
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
  buffer[0] = TypeCode.TIME;
  buffer[1] = hours | 0x80;
  buffer[2] = minutes;
  buffer.writeUInt16LE(milliseconds, 3);
  this.write(buffer);
};

Writer.prototype[TypeCode.DATE] = function writeDate(value) {
  /* jshint bitwise:false */
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
  buffer[0] = TypeCode.DATE;
  buffer.writeUInt16LE(year, 1);
  buffer[2] |= 0x80;
  buffer[3] = month;
  buffer[4] = day;
  this.write(buffer);
};

Writer.prototype[TypeCode.TIMESTAMP] = function writeTimestamp(value) {
  /* jshint bitwise:false */
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
  buffer[0] = TypeCode.TIMESTAMP;
  buffer.writeUInt16LE(year, 1);
  buffer[2] |= 0x80;
  buffer[3] = month;
  buffer[4] = day;
  buffer[5] = hours | 0x80;
  buffer[6] = minutes;
  buffer.writeUInt16LE(milliseconds, 7);
  this.write(buffer);
};

Writer.prototype[TypeCode.DAYDATE] = function writeDayDate(value) {
  /* jshint unused:false */
  throw createNotImplementedError();
};

Writer.prototype[TypeCode.SECONDTIME] = function writeSecondTime(value) {
  /* jshint unused:false */
  throw createNotImplementedError();
};

Writer.prototype[TypeCode.LONGDATE] = function writeLongDate(value) {
  /* jshint unused:false */
  throw createNotImplementedError();
};

Writer.prototype[TypeCode.SECONDDATE] = function writeSecondDate(value) {
  /* jshint unused:false */
  throw createNotImplementedError();
};

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