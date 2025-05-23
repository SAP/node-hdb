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
var Transform = util.stream.Transform;
var common = require('./common');
var TypeCode = common.TypeCode;
var LobOptions = common.LobOptions;
var NormalizedTypeCode = common.NormalizedTypeCode;
var bignum = util.bignum;
var calendar = util.calendar;
var zeropad = require('../util/zeropad');
var isValidDay = calendar.isValidDay;
var isValidTime = calendar.isValidTime;
var isZeroDay = calendar.isZeroDay;
var isZeroTime = calendar.isZeroTime;
var WRITE_LOB_REQUEST_HEADER_LENGTH = 21;

exports = module.exports = Writer;

var REGEX = {
  DATE: /(\d{4})-(\d{2})-(\d{2})/,
  TIME: /(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/,
  TIMESTAMP: /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/,
  // DECIMAL will match "" and ".", both of which are invalid, requires an
  // additional check
  DECIMAL: /^([+-])?(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/
};

const maxDecimalMantissaLen = 34;
const maxFixedMantissaLen = 38;

/**
 * Constructs a Writer to write input parameters into server readable representation
 * @param {Object} params - Metadata for input parameters to be written to the server
 * @param {number[]} params.types - Array of type codes for each parameter
 * @param {number[]} params.fractions - Array of the fraction / scale of each parameter
 * (fraction metadata is only necessary for FIXED / DECIMAL types)
 * @param {Object} options - Stores options to modify the way data types are written
 */
function Writer(params, options) {
  this._types = params.types.map(normalizeType);
  this._fractions = params.fractions;
  this._lengths = params.lengths;
  this.reset();
  this._useCesu8 = (options && options.useCesu8 === true);
  this._spatialTypes = ((options && options.spatialTypes === 1) ? 1 : 0);
}

function normalizeType(type) {
  return NormalizedTypeCode[type];
}

Writer.prototype.clear = function clear() {
  this._params = false;
  this._buffers = [];
  this._bytesWritten = 0;
  this._argumentCount = 0;
};

Writer.prototype.reset = function reset() {
  this._lobs = [];
  this.clear();
};

Writer.prototype.setValues = function setValues(values) {
  this.reset();
  for (var i = 0; i < values.length; i++) {
    this.add(this._types[i], values[i], this._fractions ? this._fractions[i] : undefined,
      this._lengths ? this._lengths[i] : undefined);
  }
  this._params = true;
};

exports.create = function createWriter(params, options) {
  var writer = new Writer(params, options);
  writer.setValues(params.values);
  return writer;
};

Object.defineProperties(Writer.prototype, {
  hasParameters: {
    get: function hasParameters() {
      return this._params;
    }
  },
  finished: {
    get: function isFinished() {
      return !this._lobs.length && !this._buffers.length;
    }
  },
  length: {
    get: function getLength() {
      return this._bytesWritten;
    }
  }
});

Writer.prototype.add = function add(type, value, fraction, length) {
  if (typeof value === 'undefined' || value === null) {
    this.pushNull(type);
  } else if (type === TypeCode.DECIMAL || type === TypeCode.FIXED8
    || type === TypeCode.FIXED12 || type === TypeCode.FIXED16) {
    this[type](value, fraction);
  } else if (type === TypeCode.REAL_VECTOR) {
    this[type](value, length);
  } else {
    this[type](value);
  }
};

function storeErrorOnStream (err) {
  this._errored = err;
}

Writer.prototype.finializeParameters = function finializeParameters(
  bytesRemainingForLOBs, cb) {
  var self = this;
  var stream, header;
  this._streamErrorListeners = [];

  this._lobs.forEach((stream) => {
    if (stream._readableState.errored) {
      cb(stream._readableState.errored);
      return;
    }
    var errorListener = storeErrorOnStream.bind(stream);
    self._streamErrorListeners.push(errorListener); // keep track so it can
                                                    // be removed later
    stream.once('error', errorListener);
  });

  function finalize() {
    /* jshint bitwise:false */
    // update lob options in header
    header[1] |= LobOptions.LAST_DATA;
    // remove current lob from stack
    if(self._streamErrorListeners && self._streamErrorListeners.length) {
      stream.removeListener('error', self._streamErrorListeners[0]);
      self._streamErrorListeners.shift();
    }
    if (stream instanceof LobTransform) {
      // Destory wrapping stream
      stream.destroy();
    }
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
    var chunk = this.read(bytesRemainingForLOBs);
    if (chunk === null) {
      chunk = this.read();
    }
    if (chunk === null) {
      return;
    }
    // store lob length in header
    var length = header.readInt32LE(2);
    // readable events might not emit for every chunk so we handle all
    // avaliable chunks immediately
    while (chunk !== null) {
      if (chunk.length > bytesRemainingForLOBs) {
        cleanup();
        return cb(createReadStreamError());
      }
      // increase lob length
      length += chunk.length;
      // push chunk
      self.push(chunk);
      bytesRemainingForLOBs -= chunk.length;
      // stop appending if there is no remaining space
      if (bytesRemainingForLOBs === 0) {
        break;
      }
      
      chunk = this.read(bytesRemainingForLOBs);
      if (chunk === null) {
        chunk = this.read();
      }
    }
    // update lob length in header
    header.writeInt32LE(length, 2);

    if (bytesRemainingForLOBs === 0) {
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
    if (!self._lobs.length || bytesRemainingForLOBs <= 0) {
      return cb(null);
    }
    // set readable stream
    stream = self._lobs[0];
    // set lob header
    header = stream._header;
    // update lob options in header
    header[1] = LobOptions.DATA_INCLUDED;
    // update lob position in header
    var position = self._bytesWritten + 1;
    header.writeInt32LE(position, 6);
    // register event handlers
    stream.on('error', onerror);
    stream.on('end', onend);
    stream.on('readable', onreadable);
    onreadable.call(stream);
  }

  next();
};

Writer.prototype.getParameters = function getParameters(bytesAvailableForLOBs, cb) {
  var self = this;

  function done(err) {
    util.setImmediate(function () {
      if (err) {
        return cb(err);
      }
      var buffer = Buffer.concat(self._buffers, self._bytesWritten);
      self.clear();
      cb(null, buffer);
    });
  }
  var bytesRemainingForLOBs = bytesAvailableForLOBs - this._bytesWritten;
  this.finializeParameters(bytesRemainingForLOBs, done);
};

Writer.prototype.finalizeWriteLobRequest = function finalizeWriteLobRequest(
  bytesRemaining, cb) {
  var self = this;
  var stream, header;

  this._lobs.forEach((stream) => {
    if (stream._errored) {
      cb(stream._errored);
      return;
    }
  });

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
    // update lob options in header
    header[8] |= LobOptions.LAST_DATA;
    // remove current lob from stack
    if(self._streamErrorListeners && self._streamErrorListeners.length) {
      stream.removeListener('error', self._streamErrorListeners[0]);
      self._streamErrorListeners.shift();
    }
    if (stream instanceof LobTransform) {
      // Destory wrapping stream
      stream.destroy();
    }
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
    // store lob length in header
    var length = header.readInt32LE(17);
    // readable events might not emit for every chunk so we handle all
    // avaliable chunks immediately
    while (chunk !== null) {
      if (chunk.length > bytesRemaining) {
        cleanup();
        return cb(createReadStreamError());
      }
      // increase lob length
      length += chunk.length;
      // push chunk
      self.push(chunk);
      bytesRemaining -= chunk.length;
      // stop appending if there is no remaining space
      if (bytesRemaining === 0) {
        break;
      }
      
      chunk = this.read(bytesRemaining);
      if (chunk === null) {
        chunk = this.read();
      }
    }
    // update lob length in header
    header.writeInt32LE(length, 17);

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
    // no more lobs to write or not enough bytes remaining for next lob
    if (!self._lobs.length || bytesRemaining <= WRITE_LOB_REQUEST_HEADER_LENGTH) {
      return cb(null);
    }
    // set reabable stream
    stream = self._lobs[0];
    // set lob header
    header = new Buffer(WRITE_LOB_REQUEST_HEADER_LENGTH);
    // set locatorId
    stream._locatorId.copy(header, 0);
    // update lob options in header
    header[8] = LobOptions.DATA_INCLUDED;
    // offset 0 means append
    header.fill(0x00, 9, 17);
    // length
    header.writeInt32LE(0, 17);
    // push header
    self.push(header);
    bytesRemaining -= header.length;
    // increase count
    self._argumentCount += 1;
    // register event handlers
    stream.on('error', onerror);
    stream.on('end', onend);
    stream.on('readable', onreadable);
    onreadable.call(stream);
  }

  next();
};

Writer.prototype.getWriteLobRequest = function getWriteLobRequest(
  bytesRemaining, cb) {
  var self = this;

  function done(err) {
    util.setImmediate(function () {
      if (err) {
        return cb(err);
      }
      var part = {
        argumentCount: self._argumentCount,
        buffer: Buffer.concat(self._buffers, self._bytesWritten)
      };
      self.clear();
      cb(null, part);
    });
  }
  this.clear();
  this.finalizeWriteLobRequest(bytesRemaining, done);
};

Writer.prototype.update = function update(writeLobReply) {
  var stream, locatorId;
  for (var i = 0; i < this._lobs.length; i++) {
    locatorId = writeLobReply[i];
    stream = this._lobs[i];
    if (Buffer.isBuffer(locatorId) && util.isObject(stream)) {
      stream._header = undefined;
      stream._locatorId = locatorId;
    }
  }
};

Writer.prototype.push = function push(buffer) {
  this._bytesWritten += buffer.length;
  this._buffers.push(buffer);
};

Writer.prototype.pushNull = function pushNull(type) {
  /* jshint bitwise:false */
  var nullTypeCode;
  switch(type) {
    case TypeCode.LONGDATE:
    case TypeCode.SECONDDATE:
      nullTypeCode = TypeCode.TIMESTAMP | 0x80;
      break;
    case TypeCode.DAYDATE:
      nullTypeCode = TypeCode.DATE | 0x80;
      break;
    case TypeCode.SECONDTIME:
      nullTypeCode = TypeCode.TIME | 0x80;
      break;
    case TypeCode.ST_GEOMETRY:
    case TypeCode.REAL_VECTOR:
      nullTypeCode = TypeCode.BINARY | 0x80;
      break;
    default:
      nullTypeCode = NormalizedTypeCode[type] | 0x80;
  }
  var buffer = new Buffer([nullTypeCode]);
  this.push(buffer);
};

Writer.prototype.pushLob = function pushLob(buffer, value) {
  this.push(buffer);
  var stream;
  if (Buffer.isBuffer(value)) {
    stream = new Readable();
    stream.push(value);
    stream.push(null);
  } else if (value instanceof Readable) {
    if (value.readableObjectMode) {
      // Wrap the stream with another stream with objectMode false, so that a given 
      // number of bytes can be read at a time not each object
      stream = new LobTransform(value, ['error'], { objectMode: false });
    } else {
      stream = value;
    }
  } else if (value.readable === true) {
    stream = new Readable().wrap(value);
  } else {
    throw createInputError('LOB');
  }
  if (stream) {
    stream._header = buffer;
    this._lobs.push(stream);
  }
};

Writer.prototype[TypeCode.TINYINT] = function writeTinyInt(value) {
  if (isNaN(value)) {
    throw createInputError('TINYINT');
  }
  var buffer = new Buffer(2);
  buffer[0] = TypeCode.TINYINT;
  buffer.writeUInt8(value, 1);
  this.push(buffer);
};

Writer.prototype[TypeCode.SMALLINT] = function writeSmallInt(value) {
  if (isNaN(value)) {
    throw createInputError('SMALLINT');
  }
  var buffer = new Buffer(3);
  buffer[0] = TypeCode.SMALLINT;
  buffer.writeInt16LE(value, 1);
  this.push(buffer);
};

Writer.prototype[TypeCode.INT] = function writeInt(value) {
  if (isNaN(value)) {
    throw createInputError('INT');
  }
  var buffer = new Buffer(5);
  buffer[0] = TypeCode.INT;
  buffer.writeInt32LE(value, 1);
  this.push(buffer);
};

Writer.prototype[TypeCode.BIGINT] = function writeBigInt(value) {
  if (isNaN(value)) {
    throw createInputError('BIGINT');
  }
  var buffer = new Buffer(9);
  buffer[0] = TypeCode.BIGINT;
  bignum.writeInt64LE(buffer, value, 1);
  this.push(buffer);
};

Writer.prototype[TypeCode.REAL] = function writeReal(value) {
  if (isNaN(value)) {
    throw createInputError('REAL');
  }
  var buffer = new Buffer(5);
  buffer[0] = TypeCode.REAL;
  buffer.writeFloatLE(value, 1);
  this.push(buffer);
};

Writer.prototype[TypeCode.DOUBLE] = function writeDouble(value) {
  if (isNaN(value)) {
    throw createInputError('DOUBLE');
  }
  var buffer = new Buffer(9);
  buffer[0] = TypeCode.DOUBLE;
  buffer.writeDoubleLE(value, 1);
  this.push(buffer);
};

Writer.prototype[TypeCode.DECIMAL] = function writeDecimal(value, fraction) {
  var decimal;
  if (util.isString(value)) {
    decimal = stringToDecimal(value, maxDecimalMantissaLen, fraction);
  } else if (util.isNumber(value)) {
    decimal = stringToDecimal(value.toExponential(), maxDecimalMantissaLen, fraction);
  } else {
    throw createInputError('DECIMAL');
  }
  var buffer = new Buffer(17);
  buffer[0] = TypeCode.DECIMAL;
  bignum.writeDec128(buffer, decimal, 1);
  this.push(buffer);
};

function toFixedDecimal(value, fraction, typeStr) {
  var decimal;
  // Convert to decimal object with maximum number of digits 38
  if (util.isString(value)) {
    decimal = stringToDecimal(value, maxFixedMantissaLen, fraction, typeStr);
  } else if (util.isNumber(value)) {
    decimal = stringToDecimal(value.toExponential(), maxFixedMantissaLen, fraction, typeStr);
  } else {
    throw createInputError(typeStr);
  }
  // Truncate decimal with the minimum exponent being -fraction, so there are at most
  // 'fraction' digits after the decimal
  decimal = truncateDecimalToExp(decimal, -fraction);

  if (decimal.m.length + decimal.e + fraction > maxFixedMantissaLen) {
    throw createInputError(typeStr); // Numeric overflow, greater than maximum precision 
  }

  if ((-decimal.e) < fraction) {
    decimal.m += zeropad.ZEROS[fraction + decimal.e];
  }
  return decimal;
}

function writeFixed16Buffer(decimal, buffer, offset) {
  bignum.writeUInt128LE(buffer, decimal.m, offset);
  if (decimal.s === -1) {
    // Apply two's complement conversion
    var extraOne = true;
    for (var i = offset; i < offset + 16; i++) {
      if (extraOne) {
        if (buffer[i] !== 0) {
          buffer[i] = 0xff - buffer[i] + 1;
          extraOne = false;
        } else {
          buffer[i] = 0;
        }
      } else {
        buffer[i] = 0xff - buffer[i];
      }
    }
  }
}

function checkFixedOverflow(decimal, extBuffer, byteLimit, typeStr) {
  if (decimal.s === -1) {
    for (var i = byteLimit; i < 16; ++i) {
      if (extBuffer[i] != 0xff) {
        throw createInputError(typeStr);
      }
    }
    if ((extBuffer[byteLimit - 1] & 0x80) == 0) {
      throw createInputError(typeStr);
    }
  } else {
    for (var i = byteLimit; i < 16; ++i) {
      if (extBuffer[i] != 0) {
        throw createInputError(typeStr);
      }
    }
    if (extBuffer[byteLimit - 1] & 0x80) {
      throw createInputError(typeStr);
    }
  }
}

Writer.prototype[TypeCode.FIXED8] = function writeFixed8(value, fraction) {
  var extBuffer = new Buffer(16);
  var decimal = toFixedDecimal(value, fraction, 'FIXED8');
  writeFixed16Buffer(decimal, extBuffer, 0);
  // Check that the representation does not exceed 8 bytes
  checkFixedOverflow(decimal, extBuffer, 8, 'FIXED8');
  var buffer = new Buffer(9);
  buffer[0] = TypeCode.FIXED8;
  extBuffer.copy(buffer, 1, 0, 8);
  this.push(buffer);
}

Writer.prototype[TypeCode.FIXED12] = function writeFixed12(value, fraction) {
  var extBuffer = new Buffer(16);
  var decimal = toFixedDecimal(value, fraction, 'FIXED12');
  writeFixed16Buffer(decimal, extBuffer, 0);
  // Check that the representation does not exceed 12 bytes
  checkFixedOverflow(decimal, extBuffer, 12, 'FIXED12');
  var buffer = new Buffer(13);
  buffer[0] = TypeCode.FIXED12;
  extBuffer.copy(buffer, 1, 0, 12);
  this.push(buffer);
}

Writer.prototype[TypeCode.FIXED16] = function writeFixed16(value, fraction) {
  var buffer = new Buffer(17);
  buffer[0] = TypeCode.FIXED16;
  writeFixed16Buffer(toFixedDecimal(value, fraction, 'FIXED16'), buffer, 1);
  this.push(buffer);
}

Writer.prototype[TypeCode.NSTRING] = function writeNString(value) {
  this.writeCharacters(TypeCode.NSTRING, value);
};

Writer.prototype[TypeCode.STRING] = function writeString(value) {
  this.writeCharacters(TypeCode.STRING, value);
};

Writer.prototype.writeCharacters = function writeCharacters(type, value) {
  if (typeof value !== 'string') {
    throw new TypeError('Argument must be a string');
  }

  var encoded = util.convert.encode(value, this._useCesu8);
  this.push(createBinaryOutBuffer(type, encoded));
};

Writer.prototype[TypeCode.BINARY] = function writeBinary(value) {
  if (!Buffer.isBuffer(value)) {
    throw createInputError('BINARY');
  }
  this.push(createBinaryOutBuffer(TypeCode.BINARY, value));
};

Writer.prototype[TypeCode.BLOB] = function writeBLob(value) {
  var buffer = new Buffer(10);
  buffer.fill(0x00);
  buffer[0] = TypeCode.BLOB;
  if (util.isString(value)) {
    value = util.convert.encode(value, this._useCesu8);
  }
  this.pushLob(buffer, value);
};

Writer.prototype[TypeCode.CLOB] = function writeCLob(value) {
  var buffer = new Buffer(10);
  buffer.fill(0x00);
  buffer[0] = TypeCode.CLOB;
  if (util.isString(value)) {
    value = new Buffer(value, 'ascii');
  }
  this.pushLob(buffer, value);
};

Writer.prototype[TypeCode.NCLOB] = function writeNCLob(value) {
  var buffer = new Buffer(10);
  buffer.fill(0x00);
  buffer[0] = TypeCode.NCLOB;
  if (util.isString(value)) {
    value = util.convert.encode(value, this._useCesu8);
  }
  this.pushLob(buffer, value);
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
    var decMilli = strToNumLen(time[4], 3);
    milliseconds = time[3] * 1000 + decMilli;
  } else {
    throw createInputError('TIME');
  }
  var buffer = new Buffer(5);
  buffer[0] = TypeCode.TIME;
  buffer[1] = hours | 0x80;
  buffer[2] = minutes;
  buffer.writeUInt16LE(milliseconds, 3);
  this.push(buffer);
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
  this.push(buffer);
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
    var decMilli = strToNumLen(ts[7], 3);
    milliseconds = ts[6] * 1000 + decMilli;
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
  this.push(buffer);
};

Writer.prototype[TypeCode.DAYDATE] = function writeDayDate(value) {
  /* jshint unused:false */
  var year, month, day;
  if (util.isString(value)) {
    var date = value.match(REGEX.DATE);
    if (!date) {
      throw createInputError('DATE');
    }
    year = ~~date[1];
    month = ~~date[2];
    day = ~~date[3];
  } else {
    throw createInputError('DATE');
  }
  if(isZeroDay(day, month, year)) {
    var buffer = new Buffer(5);
    buffer[0] = TypeCode.DAYDATE;
    buffer.writeUInt32LE(0, 1);
    this.push(buffer);
    return;
  }
  if(!isValidDay(day, month, year)) {
    throw createInputError('DAYDATE');
  }
  const dayDate = calendar.DAYDATE(year, month, day);
  var buffer = new Buffer(5);
  buffer[0] = TypeCode.DAYDATE;
  buffer.writeUInt32LE(dayDate, 1);
  this.push(buffer);
};

Writer.prototype[TypeCode.SECONDTIME] = function writeSecondTime(value) {
  /* jshint unused:false */
  var hours, minutes, seconds;
  if (util.isString(value)) {
    var ts = value.match(REGEX.TIME);
    if(!ts) {
      throw createInputError('SECONDTIME');
    }
    hours = ~~ts[1];
    minutes = ~~ts[2];
    seconds = ~~ts[3];
  } else {
    throw createInputError('SECONDTIME');
  }
  if(!isValidTime(seconds, minutes, hours)) {
    throw createInputError('SECONDTIME');
  }
  const timeValue = ((hours * 60) + minutes) * 60 + seconds;
  var buffer = new Buffer(5);
  buffer[0] = TypeCode.SECONDTIME;
  buffer.writeUInt32LE(timeValue + 1, 1);
  this.push(buffer);
};

Writer.prototype[TypeCode.LONGDATE] = function writeLongDate(value) {
  /* jshint unused:false */
  var year, month, day, hours, minutes, seconds, nanoseconds;
  if (util.isString(value)) {
    var ts = value.match(REGEX.TIMESTAMP);
    if (!ts) {
      throw createInputError('LONGDATE');
    }
    year = ~~ts[1];
    month = ~~ts[2];
    day = ~~ts[3];
    hours = ~~ts[4];
    minutes = ~~ts[5];
    seconds = ~~ts[6];
    nanoseconds = strToNumLen(ts[7], 9);
  } else {
    throw createInputError('LONGDATE');
  }
  if(isZeroDay(day, month, year) && isZeroTime(seconds, minutes, hours) && nanoseconds === 0) {
    var buffer = new Buffer(9);
    buffer[0] = TypeCode.LONGDATE;
    bignum.writeUInt64LE(buffer, 0, 1);
    this.push(buffer);
    return;
  }
  if(!isValidDay(day, month, year) || !isValidTime(seconds, minutes, hours)) {
    throw createInputError('LONGDATE');
  }
  const dayDate = calendar.DAYDATE(year, month, day);
  const dayFactor = BigInt(10000000) * BigInt(60 * 60 * 24);
  const timeValue = BigInt(((hours * 60) + minutes) * 60 + seconds) * BigInt(10000000) + BigInt(~~(nanoseconds / 100));
  const longDate = BigInt(dayDate - 1) * dayFactor + timeValue + BigInt(1);
  var buffer = new Buffer(9);
  buffer[0] = TypeCode.LONGDATE;
  bignum.writeUInt64LE(buffer, String(longDate), 1);
  this.push(buffer);
};

Writer.prototype[TypeCode.SECONDDATE] = function writeSecondDate(value) {
  /* jshint unused:false */
  var year, month, day, hours, minutes, seconds;
  if (util.isString(value)) {
    var ts = value.match(REGEX.TIMESTAMP);
    if (!ts) {
      throw createInputError('SECONDDATE');
    }
    year = ~~ts[1];
    month = ~~ts[2];
    day = ~~ts[3];
    hours = ~~ts[4];
    minutes = ~~ts[5];
    seconds = ~~ts[6];
  } else {
    throw createInputError('SECONDDATE');
  }
  if(isZeroDay(day, month, year) && isZeroTime(seconds, minutes, hours)) {
    var buffer = new Buffer(9);
    buffer[0] = TypeCode.SECONDDATE;
    bignum.writeUInt64LE(buffer, 0, 1);
    this.push(buffer);
    return;
  }
  if(!isValidDay(day, month, year) || !isValidTime(seconds, minutes, hours)) {
    throw createInputError('SECONDDATE');
  }
  const dayDate = calendar.DAYDATE(year, month, day);
  const dayFactor = 60 * 60 * 24;
  const timeValue = ((hours * 60) + minutes) * 60 + seconds;
  const seconddate = BigInt(dayDate - 1) * BigInt(dayFactor) + BigInt(timeValue + 1);
  var buffer = new Buffer(9);
  buffer[0] = TypeCode.SECONDDATE;
  bignum.writeUInt64LE(buffer, String(seconddate), 1)
  this.push(buffer);
};

Writer.prototype[TypeCode.ST_GEOMETRY] = function writeST_GEOMETRY(value) {
  if (Buffer.isBuffer(value)) {
    this.push(createBinaryOutBuffer(TypeCode.BINARY, value));
  } else if (util.isString(value)) {
    if (this._spatialTypes === 1) {
      this.writeCharacters(TypeCode.STRING, value);
    } else {
      this.push(createBinaryOutBuffer(TypeCode.BINARY, Buffer.from(value, 'hex')));
    }
  } else {
    throw new TypeError('Argument must be a string or Buffer');
  }
}

Writer.prototype[TypeCode.BOOLEAN] = function writeBoolean(value) {
  var buffer = new Buffer(2);
  buffer[0] = TypeCode.BOOLEAN;
  // 0x02 - True, 0x01 - Null, 0x00 - False
  if (value === null) {
    buffer[1] = 0x01;
  } else if (util.isString(value)) {
    if (value.toUpperCase() === 'TRUE' || value === '1') {
      buffer[1] = 0x02;
    } else if (value.toUpperCase() === 'FALSE' || value === '0') {
      buffer[1] = 0x00;
    } else if (value.toUpperCase() === 'UNKNOWN' || value.length === 0) {
      buffer[1] = 0x01;
    } else {
      throw createInputError('BOOLEAN');
    }
  } else if (util.isNumber(value)) {
    buffer[1] = value == 0 ? 0x00 : 0x02;
  } else if (value === true) {
    buffer[1] = 0x02;
  } else if (value === false) {
    buffer[1] = 0x00;
  } else {
    throw createInputError('BOOLEAN');
  }

  this.push(buffer);
}

Writer.prototype.writeVector = function writeVector(value, length, elemSize, writeElemFunc, type) {
  if (Array.isArray(value)) {
    // Validate length
    if (value.length === 0) {
      throw createInvalidLengthError(type);
    } else if (length !== 0 && value.length !== length) {
      throw createMismatchTargetLengthError(type);
    }
    this.push(createVectorOutBuffer(value, elemSize, writeElemFunc));
  } else if (Buffer.isBuffer(value)) {
    // Validate length
    if (value.length < 4 || (value.length - 4) % elemSize !== 0) {
      throw createInvalidLengthError(type);
    } else {
      var fvecsLength = value.readInt32LE(0);
      if (fvecsLength === 0 || fvecsLength !== (value.length - 4) / elemSize) {
        throw createInvalidLengthError(type);
      } else if (length !== 0 && fvecsLength !== length) { // Fixed length
        throw createMismatchTargetLengthError(type);
      }
    }
    this.push(createBinaryOutBuffer(TypeCode.BINARY, value));
  } else {
    throw createInputError(type);
  }
}

Writer.prototype[TypeCode.REAL_VECTOR] = function writeRealVector(value, length) {
  function writeRealElem (value, buffer, offset) {
    if (!util.isNumber(value)) {
      throw createInputError('REAL_VECTOR');
    }
    buffer.writeFloatLE(value, offset);
  }
  this.writeVector(value, length, 4, writeRealElem, 'REAL_VECTOR');
}

function setChar(str, i, c) {
    if(i >= str.length) return str;
    return str.substring(0, i) + c + str.substring(i + 1);
}

function trimLeadingZeroes(str) {
  var i = 0;
  while(i < str.length && str[i] === '0') {
    ++i;
  }
  return str.substring(i);
}

function trimTrailingZeroes(str) {
  var i = str.length - 1;
  while(i >= 0 && str[i] === '0') {
    --i;
  }
  return str.substring(0, i + 1);
}

function stringToDecimal(str, maxMantissaLen, fraction, typeStr) {
  /* jshint bitwise:false */
  var dec = str.match(REGEX.DECIMAL);
  // REGEX.DECIMAL will match "." and "" despite these being invalid.
  if (!dec || str === "." || str === "") {
    throw createInputError(typeStr === undefined ? 'DECIMAL' : typeStr);
  }
  var sign = dec[1] === '-' ? -1 : 1;
  var mInt = dec[2] || '';
  var mFrac = dec[3] || '';
  var exp = ~~dec[4];

  mFrac = trimTrailingZeroes(mFrac);
  var mantissa = trimLeadingZeroes(mInt + mFrac);
  if(mantissa.length === 0) mantissa = "0";
  exp -= mFrac.length

  // Fit to maxMantissaLen digits and increment exp appropriately
  if(mantissa.length > maxMantissaLen) {
    var followDigit = mantissa[maxMantissaLen];
    exp += (mantissa.length - maxMantissaLen)
    mantissa = mantissa.substring(0, maxMantissaLen);
    // When writing a floating point decimal (fraction > maxMantissaLen or
    // fraction === undefined), we round to the max mantissa size, but with
    // fixed we truncate to the max mantissa size
    if((fraction === undefined || fraction > maxMantissaLen) && followDigit > '4') {
      // round up
      var i = maxMantissaLen - 1;
      while(i >= 0 && mantissa[i] === '9') {
        i -= 1;
      }
      // i = index of first non-9 digit from back
      if(i === -1) {
        exp += mantissa.length;
        mantissa = "1";
      } else {
        exp += mantissa.length - 1 - i;
        mantissa = mantissa.substring(0, i + 1);
        mantissa = setChar(mantissa, i, String.fromCharCode(mantissa.charCodeAt(i) + 1));
      }
    } else if(mantissa[maxMantissaLen - 1] === '0') {
      var trimmed = trimTrailingZeroes(mantissa);
      exp += (maxMantissaLen - trimmed.length);
      mantissa = trimmed;
    }
  }

  return {
    s: sign,
    m: mantissa,
    e: exp
  };
}

function truncateDecimalToExp(decimal, minExp) {
  var mantissa = decimal.m;
  var exp = decimal.e;
  var calcMaxMantissaLength;
  if (exp < minExp) {
    // Shift the max mantissa length such that the exponent is minExp
    calcMaxMantissaLength = exp + mantissa.length - minExp;
    if (calcMaxMantissaLength <= 0) {
      // All digits are truncated away
      return {s: 1, m: "0", e: minExp};
    }
  }

  // truncate to calcMaxMantissaLen digits and increment exp appropriately
  if(calcMaxMantissaLength && mantissa.length > calcMaxMantissaLength) {
    exp += (mantissa.length - calcMaxMantissaLength);
    mantissa = mantissa.substring(0, calcMaxMantissaLength);
    // No need to trim trailing zeros since FIXED types will add zeros to
    // match minExp
  }

  return {
    s: decimal.s,
    m: mantissa,
    e: exp
  };
}

// Truncates / pads a decimal string to get a fixed number of decimal places as an integer
function strToNumLen(str, len) {
  if (str === undefined) {
    return 0;
  }
  return Number(str.length > len ? str.substring(0, len) : str + util.ZEROS[len - str.length]);
}

function createInputError(type) {
  return new Error(util.format('Wrong input for %s type', type));
}

function createNotImplementedError() {
  return new Error('Not implemented yet');
}

function createReadStreamError() {
  return new Error('Chunk length larger than remaining bytes');
}

function createInvalidLengthError(type) {
  return new Error(util.format('Invalid length or indicator value for %s type', type));
}

function createMismatchTargetLengthError(type) {
  return new Error(util.format('The source dimension is different from the target dimension for %s type', type));
}

function createBinaryBufferHeader(type, length) {
  var buffer, offset;
  if (length <= common.DATA_LENGTH_MAX1BYTE_LENGTH) {
    buffer = new Buffer(2 + length);
    buffer[0] = type;
    buffer[1] = length;
    offset = 2;
  } else if (length <= common.DATA_LENGTH_MAX2BYTE_LENGTH) {
    buffer = new Buffer(4 + length);
    buffer[0] = type;
    buffer[1] = common.DATA_LENGTH_2BYTE_LENGTH_INDICATOR;
    buffer.writeInt16LE(length, 2);
    offset = 4;
  } else {
    buffer = new Buffer(6 + length);
    buffer[0] = type;
    buffer[1] = common.DATA_LENGTH_4BYTE_LENGTH_INDICATOR;
    buffer.writeInt32LE(length, 2);
    offset = 6;
  }
  return { buffer, offset };
}

function createBinaryOutBuffer(type, value) {
  var { buffer, offset } = createBinaryBufferHeader(type, value.length);
  value.copy(buffer, offset);
  return buffer;
}

function createVectorOutBuffer(value, elemSize, writeElemFunc) {
  var fvecsLength = 4 + value.length * elemSize;
  var { buffer, offset } = createBinaryBufferHeader(TypeCode.BINARY, fvecsLength);
  buffer.writeInt32LE(value.length, offset);
  offset += 4;
  for (var i = 0; i < value.length; i++) {
    writeElemFunc(value[i], buffer, offset + (i * elemSize));
  }
  return buffer;
}

util.inherits(LobTransform, Transform);

// Wraps a Readable stream with a stream that is not in object mode
function LobTransform(source, events, options) {
  this._source = source;
  Transform.call(this, options);
  // Forward all events indicated to the LobTransform wrapper
  this._proxiedEvents = [];
  for (var event of events) {
    var listener = this.emit.bind(this, event);
    source.on(event, listener);
    this._proxiedEvents.push({eventName: event, listener: listener});
  }
  source.pipe(this);
}

LobTransform.prototype._transform = function _transform(chunk, encoding, cb) {
  this.push(chunk);
  cb();
}

LobTransform.prototype._destroy = function _destroy() {
  var self = this;
  this._proxiedEvents.forEach(function (value) {
    self._source.removeListener(value.eventName, value.listener);
  });
  this._source.unpipe(this);
}
