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
/* jshint bitwise:false */

var INT_10_1 = Math.pow(10, 1);
var INT_10_2 = Math.pow(10, 2);

var INT_10_3 = Math.pow(10, 3);
var INT_10_4 = Math.pow(10, 4);
var INT_10_5 = Math.pow(10, 5);
var INT_10_6 = Math.pow(10, 6);
var INT_10_7 = Math.pow(10, 7);
var INT_10_8 = Math.pow(10, 8);
var INT_10_9 = Math.pow(10, 9);
var INT_10_10 = Math.pow(10, 10);
var INT_10_11 = Math.pow(10, 11);
var INT_10_12 = Math.pow(10, 12);
var INT_10_13 = Math.pow(10, 13);
var INT_10_14 = Math.pow(10, 14);

var ZERO_1 = '0';
var ZERO_2 = '00';
var ZERO_3 = '000';
var ZERO_4 = '0000';
var ZERO_5 = '00000';
var ZERO_6 = '000000';
var ZERO_7 = '0000000';
var ZERO_8 = '00000000';
var ZERO_9 = '000000000';
var ZERO_10 = '0000000000';
var ZERO_11 = '00000000000';
var ZERO_12 = '000000000000';
var ZERO_13 = '0000000000000';

var BASE = INT_10_7;

var EXP_BIAS = 6176;

var INT_2_16 = Math.pow(2, 16);
var INT_2_21 = Math.pow(2, 21);
var INT_2_32 = Math.pow(2, 32);

/* 2^32 = 429 4967296 */
var INT_2_32_0 = 4967296;
var INT_2_32_1 = 429;

/* 2^53 = 90 0719925 4740992 */
var INT_2_53_0 = 4740992;
var INT_2_53_1 = 719925;
var INT_2_53_2 = 90;

/* 2^64 = 184467 4407370 9551616 */
var INT_2_64_0 = 9551616;
var INT_2_64_1 = 4407370;
var INT_2_64_2 = 184467;

/* 10^7 for base 2^16 */
var BIN_10_7_0 = INT_10_7 % INT_2_16;
var BIN_10_7_1 = Math.floor(INT_10_7 / INT_2_16);

/* 10^14 for base 2^16 */
var BIN_10_14_0 = INT_10_14 % INT_2_16;
var BIN_10_14_1 = Math.floor(INT_10_14 / INT_2_16) % INT_2_16;
var BIN_10_14_2 = Math.floor(Math.floor(INT_10_14 / INT_2_16) / INT_2_16);

/* Decimal zero padding */
var MAX_DECIMAL_LENGTH = 34;
var ZEROS = [''];
for (var i = 1; i < MAX_DECIMAL_LENGTH; i++) {
  ZEROS.push(ZEROS[i - 1] + '0');
}

function lpad14(number) {
  /* jshint curly: false */
  if (number >= INT_10_13) return number;
  if (number >= INT_10_12) return ZERO_1 + number;
  if (number >= INT_10_11) return ZERO_2 + number;
  if (number >= INT_10_10) return ZERO_3 + number;
  if (number >= INT_10_9) return ZERO_4 + number;
  if (number >= INT_10_8) return ZERO_5 + number;
  if (number >= INT_10_7) return ZERO_6 + number;
  if (number >= INT_10_6) return ZERO_7 + number;
  if (number >= INT_10_5) return ZERO_8 + number;
  if (number >= INT_10_4) return ZERO_9 + number;
  if (number >= INT_10_3) return ZERO_10 + number;
  if (number >= INT_10_2) return ZERO_11 + number;
  if (number >= INT_10_1) return ZERO_12 + number;
  return ZERO_13 + number;
}

function lpad7(number) {
  /* jshint curly: false */
  if (number >= INT_10_6) return number;
  if (number >= INT_10_5) return ZERO_1 + number;
  if (number >= INT_10_4) return ZERO_2 + number;
  if (number >= INT_10_3) return ZERO_3 + number;
  if (number >= INT_10_2) return ZERO_4 + number;
  if (number >= INT_10_1) return ZERO_5 + number;
  return ZERO_6 + number;
}

function lpad4(number) {
  /* jshint curly: false */
  if (number >= INT_10_3) return number;
  if (number >= INT_10_2) return ZERO_1 + number;
  if (number >= INT_10_1) return ZERO_2 + number;
  return ZERO_3 + number;
}

function lpad2(number) {
  /* jshint curly: false */
  if (number >= INT_10_1) return number;
  return ZERO_1 + number;
}

function _readInt64(buffer, offset, unsigned) {

  var x, y, s, y0, y1, x0, x1, x2;

  x = buffer[offset + 2] << 16;
  x |= buffer[offset + 1] << 8;
  x |= buffer[offset];
  x += buffer[offset + 3] << 24 >>> 0;
  offset += 4;

  y = buffer[offset + 2] << 16;
  y |= buffer[offset + 1] << 8;
  y |= buffer[offset];
  y += buffer[offset + 3] << 24 >>> 0;

  if (!unsigned && (y & 0x80000000)) {
    y = 0xffffffff - y;
    if (x === 0) {
      y += 1;
    } else {
      x = 0xffffffff - x + 1;
    }
    s = -1;
  } else {
    s = 1;
  }

  if (y === 0) {
    return s * x;
  }
  if (y < INT_2_21 || (y === INT_2_21 && x === 0)) {
    return s * (y * INT_2_32 + x);
  }

  if (x < BASE) {
    x0 = x % BASE;
    x1 = 0;
  } else {
    x0 = x % BASE;
    x1 = Math.floor(x / BASE);
  }

  if (y < BASE) {
    y0 = y % BASE;
    y1 = 0;
  } else {
    y0 = y % BASE;
    y1 = Math.floor(y / BASE);
  }

  x0 += y0 * INT_2_32_0;
  x1 += y0 * INT_2_32_1 + y1 * INT_2_32_0;
  x2 = y1 * INT_2_32_1;

  if (x0 >= BASE) {
    x1 += Math.floor(x0 / BASE);
    x0 %= BASE;
  }
  if (x1 >= BASE) {
    x2 += Math.floor(x1 / BASE);
    x1 %= BASE;
  }

  if (s === 1) {
    return '' + x2 + lpad14(x1 * BASE + x0);
  }
  return '-' + x2 + lpad14(x1 * BASE + x0);

}

function readDec128(buffer, offset) {

  var i, j, k, l, z0, z1, y0, y1, y2, x0, x1, x2, x3, x4;

  offset = offset || 0;

  if ((buffer[offset + 15] & 0x70) === 0x70) {
    return null;
  }

  i = buffer[offset + 2] << 16;
  i |= buffer[offset + 1] << 8;
  i |= buffer[offset];
  i += buffer[offset + 3] << 24 >>> 0;
  offset += 4;

  j = buffer[offset + 2] << 16;
  j |= buffer[offset + 1] << 8;
  j |= buffer[offset];
  j += buffer[offset + 3] << 24 >>> 0;
  offset += 4;

  k = buffer[offset + 2] << 16;
  k |= buffer[offset + 1] << 8;
  k |= buffer[offset];
  k += buffer[offset + 3] << 24 >>> 0;
  offset += 4;

  l = (buffer[offset + 2] & 0x01) << 16;
  l |= buffer[offset + 1] << 8;
  l |= buffer[offset];
  offset += 2;

  var dec = {
    s: (buffer[offset + 1] & 0x80) ? -1 : 1,
    m: undefined,
    e: ((((buffer[offset + 1] << 8) | buffer[offset]) & 0x7ffe) >> 1) - EXP_BIAS
  };

  if (k === 0 && l === 0) {
    if (j === 0) {
      dec.m = i;
      return dec;
    }
    if (j < INT_2_21 || (j === INT_2_21 && i === 0)) {
      dec.m = j * INT_2_32 + i;
      return dec;
    }
  }

  if (i < BASE) {
    x0 = i;
    x1 = 0;
  } else {
    x0 = i % BASE;
    x1 = Math.floor(i / BASE);
  }

  if (j < BASE) {
    x0 += j * INT_2_32_0;
    x1 += j * INT_2_32_1;
    x2 = 0;
  } else {
    z0 = j % BASE;
    z1 = Math.floor(j / BASE);
    x0 += z0 * INT_2_32_0;
    x1 += z0 * INT_2_32_1 + z1 * INT_2_32_0;
    x2 = z1 * INT_2_32_1;
  }

  if (k < BASE) {
    y0 = k;
    y1 = 0;
  } else {
    y0 = k % BASE;
    y1 = Math.floor(k / BASE);
  }

  if (l < BASE) {
    y0 += l * INT_2_32_0;
    y1 += l * INT_2_32_1;
    y2 = 0;
  } else {
    z0 = l % BASE;
    z1 = Math.floor(l / BASE);
    y0 += z0 * INT_2_32_0;
    y1 += z0 * INT_2_32_1 + z1 * INT_2_32_0;
    y2 = z1 * INT_2_32_1;
  }

  if (y0 >= BASE) {
    y1 += Math.floor(y0 / BASE);
    y0 %= BASE;
  }
  if (y1 >= BASE) {
    y2 += Math.floor(y1 / BASE);
    y1 %= BASE;
  }

  x0 += y0 * INT_2_64_0;
  x1 += y0 * INT_2_64_1 + y1 * INT_2_64_0;
  x2 += y0 * INT_2_64_2 + y1 * INT_2_64_1 + y2 * INT_2_64_0;
  x3 = y1 * INT_2_64_2 + y2 * INT_2_64_1;
  x4 = y2 * INT_2_64_2;

  if (x0 >= BASE) {
    x1 += Math.floor(x0 / BASE);
    x0 %= BASE;
  }
  if (x1 >= BASE) {
    x2 += Math.floor(x1 / BASE);
    x1 %= BASE;
  }
  if (x2 >= BASE) {
    x3 += Math.floor(x2 / BASE);
    x2 %= BASE;
  }
  if (x3 >= BASE) {
    x4 += Math.floor(x3 / BASE);
    x3 %= BASE;
  }

  if (x4) {
    dec.m = '' + x4 + lpad14(x3 * BASE + x2) + lpad14(x1 * BASE + x0);
    return dec;
  }
  if (x3) {
    dec.m = '' + (x3 * BASE + x2) + lpad14(x1 * BASE + x0);
    return dec;
  }
  if (x2) {
    if (x2 < INT_2_53_2 || (x2 === INT_2_53_2 && (x1 < INT_2_53_1 || (x1 ===
      INT_2_53_1 && x0 <= INT_2_53_0)))) {
      dec.m = (x2 * BASE + x1) * BASE + x0;
      return dec;
    }
    dec.m = '' + x2 + lpad14(x1 * BASE + x0);
    return dec;
  }
  dec.m = x1 * BASE + x0;
  return dec;

}

function readDecFloat(buffer, offset) {
  var value = readDec128(buffer, offset);
  if (value === null) {
    return null;
  }
  if (value.s === -1) {
    return '-' + value.m + 'e' + value.e;
  }
  return value.m + 'e' + value.e;
}

function readDecFixed(buffer, offset, frac) {
  var value = readDec128(buffer, offset);
  if (value === null) {
    return null;
  }
  var d = value.m;
  if (typeof d === 'number') {
    d = '' + d;
  }
  if (value.e < 0) {
    frac += value.e;
    var i = d.length + value.e;
    if (i > 0) {
      if (frac < 0) {
        d = d.substring(0, i) + '.' + d.substring(i, d.length + frac);
      } else {
        d = d.substring(0, i) + '.' + d.substring(i);
      }
    } else if (i < 0) {
      d = '0.' + ZEROS[-i] + d;
    } else {
      d = '0.' + d;
    }
  } else if (value.e > 0) {
    d = value.m + ZEROS[value.e];
  }
  if (frac > 0) {
    d += ZEROS[frac];
  }
  if (value.s === -1) {
    return '-' + d;
  }
  return d;
}

function _writeInt64(buffer, value, offset, unsigned) {

  var l, x, a, b, c, x0, x1, y0, y1, z0, z1, z2, z3;

  var negative = false;

  if (typeof value === 'string') {

    l = value.length;

    if (l > 15) {

      a = +value.substring(l - 7);
      b = +value.substring(l - 7, l - 14);
      c = +value.substring(0, l - 14);

      if (!unsigned && c < 0) {
        c *= -1;
        negative = true;
      }

      z0 = a % INT_2_16;
      z1 = Math.floor(a / INT_2_16);
      z2 = z3 = 0;

      y0 = b % INT_2_16;
      y1 = Math.floor(b / INT_2_16);
      if (y0 >= INT_2_16) {
        y1 += Math.floor(y0 / INT_2_16);
        y0 %= INT_2_16;
      }

      z0 += y0 * BIN_10_7_0;
      z1 += y0 * BIN_10_7_1 + y1 * BIN_10_7_0;
      z2 += y1 * BIN_10_7_1;

      y0 = c % INT_2_16;
      y1 = Math.floor(c / INT_2_16);
      if (y0 >= INT_2_16) {
        y1 += Math.floor(y0 / INT_2_16);
        y0 %= INT_2_16;
      }

      z0 += y0 * BIN_10_14_0;
      z1 += y0 * BIN_10_14_1 + y1 * BIN_10_14_0;
      z2 += y0 * BIN_10_14_2 + y1 * BIN_10_14_1;
      z3 += y1 * BIN_10_14_2;

      if (z0 >= INT_2_16) {
        z1 += Math.floor(z0 / INT_2_16);
        z0 %= INT_2_16;
      }
      if (z1 >= INT_2_16) {
        z2 += Math.floor(z1 / INT_2_16);
        z1 %= INT_2_16;
      }
      if (z2 >= INT_2_16) {
        z3 += Math.floor(z2 / INT_2_16);
        z2 %= INT_2_16;
      }

      x0 = z1 * INT_2_16 + z0;
      x1 = z3 * INT_2_16 + z2;

    } else {
      x = +value;

      if (!unsigned && x < 0) {
        x *= -1;
        negative = true;
      }

      x0 = x % INT_2_32;
      x1 = Math.floor(x / INT_2_32);
    }
  } else {
    x = value;

    if (!unsigned && x < 0) {
      x *= -1;
      negative = true;
    }

    x0 = x % INT_2_32;
    x1 = Math.floor(x / INT_2_32);
  }

  if (negative) {
    x1 = 0xffffffff - x1;
    if (x0 === 0) {
      x1 += 1;
    } else {
      x0 = 0xffffffff - x0 + 1;
    }
  }

  buffer[offset + 3] = (x0 >>> 24) & 0xff;
  buffer[offset + 2] = (x0 >>> 16) & 0xff;
  buffer[offset + 1] = (x0 >>> 8) & 0xff;
  buffer[offset] = x0 & 0xff;
  offset += 4;

  buffer[offset + 3] = (x1 >>> 24) & 0xff;
  buffer[offset + 2] = (x1 >>> 16) & 0xff;
  buffer[offset + 1] = (x1 >>> 8) & 0xff;
  buffer[offset] = x1 & 0xff;
}

function readInt64(buffer, offset) {
  return _readInt64(buffer, offset || 0, false);
}

function readUInt64(buffer, offset) {
  return _readInt64(buffer, offset || 0, true);
}

function writeInt64(buffer, value, offset) {
  _writeInt64(buffer, value, offset || 0, false);
}

function writeUInt64(buffer, value, offset) {
  _writeInt64(buffer, value, offset || 0, true);
}

Buffer.prototype.readInt64LE = function readInt64LE(offset) {
  return _readInt64(this, offset || 0, false);
};

Buffer.prototype.readUInt64LE = function readUInt64LE(offset) {
  return _readInt64(this, offset || 0, true);
};

Buffer.prototype.writeInt64LE = function writeInt64LE(value, offset) {
  _writeInt64(this, value, offset || 0, false);
};

Buffer.prototype.writeUInt64LE = function writeUInt64LE(value, offset) {
  _writeInt64(this, value, offset || 0, true);
};

exports.readInt64LE = readInt64;
exports.readUInt64LE = readUInt64;
exports.writeInt64LE = writeInt64;
exports.writeUInt64LE = writeUInt64;
exports.readDec128 = readDec128;
exports.readDecFloat = readDecFloat;
exports.readDecFixed = readDecFixed;
exports.lpad2 = lpad2;
exports.lpad4 = lpad4;
exports.lpad7 = lpad7;
exports.lpad14 = lpad14;