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
var lpad2 = util.lpad2;
var lpad4 = util.lpad4;
var lrpad9 = util.lrpad9;
var common = require('./common');
var LobOptions = common.LobOptions;
var calendar = util.calendar;

module.exports = Reader;

function Reader(buffer, lobFactory, options) {
  this.buffer = buffer;
  this.offset = 0;
  this.lobFactory = lobFactory;
  this.strictEncoding = (options && options.useCesu8 === true);
  this._vectorOutputType = ((options && options.vectorOutputType === 'Array') ? 'Array' : 'Buffer');
}

Reader.prototype.hasMore = function hasMore() {
  return this.offset < this.buffer.length;
};

Reader.prototype.readTinyInt = function readTinyInt() {
  if (this.buffer[this.offset++] === 0x00) {
    return null;
  }
  var value = this.buffer.readUInt8(this.offset);
  this.offset += 1;
  return value;
};

Reader.prototype.readSmallInt = function readSmallInt() {
  if (this.buffer[this.offset++] === 0x00) {
    return null;
  }
  var value = this.buffer.readInt16LE(this.offset);
  this.offset += 2;
  return value;
};

Reader.prototype.readInt = function readInt() {
  if (this.buffer[this.offset++] === 0x00) {
    return null;
  }
  var value = this.buffer.readInt32LE(this.offset);
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
  return this.readBytes(true);
};

Reader.prototype.readBinary = function readBinary() {
  return this.readBytes();
};

Reader.prototype.readLengthIndicator = function readLengthIndicator() {
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
    default:
    // do nothing
  }
  return length;
}

Reader.prototype.readBytes = function readBytes(isString, isAlphanum) {
  const ALPHANUM_LENGTH_MASK = 0x7f;
  const ALPHANUM_NUMERIC_VALUE = 0x80;
  var length = this.readLengthIndicator();
  if (length === null) {
    return null;
  }

  var value;
  if (isString) {
    value = util.convert.decode(
      this.buffer.slice(this.offset, this.offset + length),
      this.strictEncoding);
  } else if (isAlphanum) {
    var ind = this.buffer[this.offset];
    var newOffset = this.offset + 1;
    var definitionLen = ind & ALPHANUM_LENGTH_MASK;
    value = util.convert.decode(
      this.buffer.slice(newOffset, newOffset + length - 1),
      this.strictEncoding);
    if (ind & ALPHANUM_NUMERIC_VALUE) {
      // the value is purely numeric
      if (definitionLen >= length) {
        // zero-pad the value
        value = "0".repeat(definitionLen - length + 1) + value;
      }
    }
  } else {
    value = new Buffer(length);
    this.buffer.copy(value, 0, this.offset, this.offset + length);
  }
  this.offset += length;
  return value;
};

Reader.prototype.readDate = function readDate() {
  /* jshint bitwise:false */
  var high = this.buffer[this.offset + 1];
  // msb not set ==> null
  if (!(high & 0x80)) {
    this.offset += 4;
    return null;
  }
  var year = this.buffer[this.offset];
  this.offset += 2;
  var month = this.buffer[this.offset] + 1;
  this.offset += 1;
  var day = this.buffer[this.offset];
  this.offset += 1;
  // msb set ==> not null
  // unset msb and second most sb
  high &= 0x3f;
  year |= high << 8;
  return util.lpad4(year) + '-' +
    lpad2(month) + '-' +
    lpad2(day);
};

Reader.prototype.readTime = function readTime() {
  /* jshint bitwise:false */
  var hour = this.buffer[this.offset];
  // msb not set ==> null
  if (!(hour & 0x80)) {
    this.offset += 4;
    return null;
  }
  var min = this.buffer[this.offset + 1];
  this.offset += 2;
  var msec = this.buffer.readUInt16LE(this.offset);
  this.offset += 2;
  // msb set ==> not null
  // unset msb
  hour &= 0x7f;
  return lpad2(hour) + ':' +
    lpad2(min) + ':' +
    lpad2(msec / 1000);
};

Reader.prototype.readTimestamp = function readTimestamp() {
  var date = this.readDate();
  var time = this.readTime();
  if (date) {
    if (time) {
      return date + 'T' + time;
    }
    return date + 'T00:00:00';
  }
  if (time) {
    return '0001-01-01T' + time;
  }
  return null;
};

Reader.prototype.readDayDate = function readDayDate() {
  var value = this.buffer.readUInt32LE(this.offset);
  this.offset += 4;
  if (value === 3652062 || value === 0) {
    return null;
  }
  var date = calendar.DATE(value);
  return lpad4(date.y) + "-" + lpad2(date.m) + "-" + lpad2(date.d);
};

Reader.prototype.readSecondTime = function readSecondTime() {
  var value = this.buffer.readInt32LE(this.offset);
  this.offset += 4;
  if (value === 86402 || value === 0) {
    return null;
  }
  value -= 1;
  const seconds = value % 60;
  value = ~~(value / 60);
  const minutes = value % 60;
  value = ~~(value / 60);
  const hours = value;
  return lpad2(hours) + ':' + lpad2(minutes) + ':' + lpad2(seconds);
};

Reader.prototype.readSecondDate = function readSecondDate() {
  var value = bignum.readInt64LE(this.buffer, this.offset);
  this.offset += 8;
  if (value === 315538070401 || value === 0) {
    return null;
  }
  const dayFactor = 60 * 60 * 24;
  var seconds, minutes, hours, day, month, year;
  value -= 1;
  var timeValue = value % dayFactor;
  var dayDate = ~~(value / dayFactor) + 1;
  var date = calendar.DATE(dayDate);
  year = date.y;
  month = date.m;
  day = date.d;
  seconds = timeValue % 60;
  timeValue = ~~(timeValue / 60);
  minutes = timeValue % 60;
  hours = ~~(timeValue / 60);
  var dateString = lpad4(year) + '-' + lpad2(month) + '-' + lpad2(day)
  var timeString = lpad2(hours) + ':' + lpad2(minutes) + ':' + lpad2(seconds);
  return dateString + ' ' + timeString;
};

Reader.prototype.readLongDate = function readLongDate() {
  var value = bignum.readInt64LE(this.buffer, this.offset);
  var seconds, minutes, hours, day, month, year;
  const dayFactor = 60 * 60 * 24;
  this.offset += 8;
  if (value === '3155380704000000001' || value === 0) {
    return null;
  }
  var fractionalSeconds, secondDate;

  if (typeof value === 'string') {
    var index = value.length - 7;
    secondDate = parseInt(value.substring(0, index), 10);
    fractionalSeconds = parseInt(value.substring(index), 10);
  } else {
    secondDate = ~~(value / 10000000);
    fractionalSeconds = value % 10000000;
  }

  if (fractionalSeconds == 0) {
    fractionalSeconds = 9999999;
    secondDate -= 1;
  } else {
    fractionalSeconds -= 1;
  }
  var timeValue = secondDate % dayFactor;
  var dayDate = ~~(secondDate / dayFactor) + 1;
  seconds = timeValue % 60;
  timeValue = ~~(timeValue / 60);
  minutes = timeValue % 60;
  timeValue = ~~(timeValue / 60);
  hours = timeValue;

  var date = calendar.DATE(dayDate);
  day = date.d;
  month = date.m;
  year = date.y;
  var dateString = lpad4(year) + '-' + lpad2(month) + '-' + lpad2(day)
  var timeString = lpad2(hours) + ':' + lpad2(minutes) + ':' + lpad2(seconds) + '.' + lrpad9(fractionalSeconds);
  return dateString + ' ' + timeString;
};

Reader.prototype.readBLob = function readBLob() {
  return this.readLob(1);
};

Reader.prototype.readCLob = function readCLob() {
  return this.readLob(2);
};

Reader.prototype.readNCLob = function readNCLob() {
  return this.readLob(3);
};

Reader.prototype.readLob = function readLob(defaultType) {
  /* jshint bitwise:false, unused:false */
  // offset 0
  var type = this.buffer[this.offset] || defaultType;
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
  var chunkLength = this.buffer.readInt32LE(this.offset);
  this.offset += 4;
  // offset 32
  var chunk = null;
  if (chunkLength > 0) {
    chunk = this.buffer.slice(this.offset, this.offset + chunkLength);
    this.offset += chunkLength;
  } else {
    chunk = new Buffer(0);
  }
  // if (!byteLength && !charLength) { return null; }
  var ld = new LobDescriptor(type, options, charLength, byteLength, locatorId, chunk, defaultType);
  return this.lobFactory.createLob(ld);
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
  var value = this.buffer.readDoubleLE(this.offset);
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
  var value = this.buffer.readFloatLE(this.offset);
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

Reader.prototype.readFixed8 = function readFixed8(fraction) {
  if (this.buffer[this.offset++] === 0x00) {
    return null;
  }
  var value = bignum.readFIXED(this.buffer, 8, this.offset, fraction);
  this.offset += 8;
  return value;
}

Reader.prototype.readFixed12 = function readFixed12(fraction) {
  if (this.buffer[this.offset++] === 0x00) {
    return null;
  }
  var value = bignum.readFIXED(this.buffer, 12, this.offset, fraction);
  this.offset += 12;
  return value;
}

Reader.prototype.readFixed16 = function readFixed16(fraction) {
  if (this.buffer[this.offset++] === 0x00) {
    return null;
  }
  var value = bignum.readFIXED(this.buffer, 16, this.offset, fraction);
  this.offset += 16;
  return value;
}

Reader.prototype.readAlphanum = function readAlphanum() {
  return this.readBytes(false, true);
}

Reader.prototype.readBoolean = function readBoolean() {
  var value = this.buffer[this.offset++];
  switch (value) {
    case 0x02:
      return true;
    case 0x01:
      return null;
    default:
      return false;
  }
}

Reader.prototype.readVector = function readVector(elemSize, readElemFunc) {
  var binaryLength = this.readLengthIndicator();
  if (binaryLength === null) {
    return null;
  }

  var length = this.buffer.readInt32LE(this.offset);
  if (this._vectorOutputType === 'Array') {
    this.offset += 4;
    var value = [];
    for (var i = 0; i < length; i++) {
      value.push(readElemFunc(this.buffer, this.offset));
      this.offset += elemSize;
    }
    return value;
  } else {
    var bufferLength = length * elemSize + 4;
    var value = Buffer.alloc(bufferLength);
    this.buffer.copy(value, 0, this.offset, this.offset + bufferLength);
    this.offset += bufferLength;
    return value;
  }
}

Reader.prototype.readRealVector = function readRealVector() {
  return this.readVector(4, function (buffer, offset) {
    return buffer.readFloatLE(offset);
  });
}

Reader.LobDescriptor = LobDescriptor;

function LobDescriptor(type, options, charLength, byteLength, locatorId, chunk, defaultType) {
  this.type = type;
  this.options = options;
  this.charLength = charLength;
  this.byteLength = byteLength;
  this.locatorId = locatorId;
  this.chunk = chunk;
  this.defaultType = defaultType || type;
}

Object.defineProperties(LobDescriptor.prototype, {
  isLast: {
    get: function isLast() {
      /* jshint bitwise:false */
      return !!(this.options & LobOptions.LAST_DATA);
    }
  }
});
