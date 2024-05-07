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
var NormalizedTypeCode = common.NormalizedTypeCode;
var bignum = util.bignum;
var WRITE_LOB_REQUEST_HEADER_LENGTH = 21;

exports = module.exports = Writer;

var REGEX = {
  DATE: /(\d{4})-(\d{2})-(\d{2})/,
  TIME: /(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/,
  TIMESTAMP: /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/,
  // DECIMAL will match "" and ".", both of which are invalid, requires an
  // additional check
  DECIMAL: /^([+-])?(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/
};

const maxDecimalMantissaLen = 34;

function Writer(types, useCesu8) {
  this._types = types.map(normalizeType);
  this.reset();
  this._useCesu8 = (useCesu8 === true);
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
    this.add(this._types[i], values[i]);
  }
  this._params = true;
};

exports.create = function createWriter(params, useCesu8) {
  var writer = new Writer(params.types, useCesu8);
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

Writer.prototype.add = function add(type, value) {
  if (typeof value === 'undefined' || value === null) {
    this.pushNull(type);
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
    if (chunk.length > bytesRemainingForLOBs) {
      cleanup();
      return cb(createReadStreamError());
    }
    // update lob length in header
    var length = header.readInt32LE(2);
    length += chunk.length;
    header.writeInt32LE(length, 2);
    // push chunk
    self.push(chunk);
    bytesRemainingForLOBs -= chunk.length;
    // stop appending if there is no remaining space
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
      cleanup();
      return cb(createReadStreamError());
    }
    // update lob length in buffer
    var length = header.readInt32LE(17);
    length += chunk.length;
    header.writeInt32LE(length, 17);
    // push chunk
    self.push(chunk);
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
  var buffer = new Buffer([NormalizedTypeCode[type] | 0x80]);
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
    stream = value;
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
  this.push(buffer);
};

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
    milliseconds = Math.round(time[3] * 1000);
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
    milliseconds = Math.round(ts[6] * 1000);
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

function stringToDecimal(str) {
  /* jshint bitwise:false */
  var dec = str.match(REGEX.DECIMAL);
  // REGEX.DECIMAL will match "." and "" despite these being invalid.
  if (!dec || str === "." || str === "") {
    throw createInputError('DECIMAL');
  }
  var sign = dec[1] === '-' ? -1 : 1;
  var mInt = dec[2] || '';
  var mFrac = dec[3] || '';
  var exp = ~~dec[4];

  mFrac = trimTrailingZeroes(mFrac);
  var mantissa = trimLeadingZeroes(mInt + mFrac);
  if(mantissa.length === 0) mantissa = "0";
  exp -= mFrac.length

  // round to maxDecimalMantissaLen digits and increment exp appropriately
  if(mantissa.length > maxDecimalMantissaLen) {
    var followDigit = mantissa[maxDecimalMantissaLen];
    exp += (mantissa.length - maxDecimalMantissaLen)
    mantissa = mantissa.substring(0, maxDecimalMantissaLen);
    if(followDigit > '4') {
      // round up
      var i = maxDecimalMantissaLen - 1;
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
    } else if(mantissa[maxDecimalMantissaLen - 1] === '0') {
      var trimmed = trimTrailingZeroes(mantissa);
      exp += (maxDecimalMantissaLen - trimmed.length);
      mantissa = trimmed;
    }
  }

  return {
    s: sign,
    m: mantissa,
    e: exp
  };
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

function createBinaryOutBuffer(type, value) {
  var length = value.length;
  var buffer;
  if (length <= common.DATA_LENGTH_MAX1BYTE_LENGTH) {
    buffer = new Buffer(2 + length);
    buffer[0] = type;
    buffer[1] = length;
    value.copy(buffer, 2);
  } else if (length <= common.DATA_LENGTH_MAX2BYTE_LENGTH) {
    buffer = new Buffer(4 + length);
    buffer[0] = type;
    buffer[1] = common.DATA_LENGTH_2BYTE_LENGTH_INDICATOR;
    buffer.writeInt16LE(length, 2);
    value.copy(buffer, 4);
  } else {
    buffer = new Buffer(6 + length);
    buffer[0] = type;
    buffer[1] = common.DATA_LENGTH_4BYTE_LENGTH_INDICATOR;
    buffer.writeInt32LE(length, 2);
    value.copy(buffer, 6);
  }
  return buffer;
}
