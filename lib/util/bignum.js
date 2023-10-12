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

var zeropad = require('./zeropad');

var BASE = Math.pow(10, 7);

var EXP_BIAS = 6176;

var INT_2_16 = Math.pow(2, 16);
var INT_2_21 = Math.pow(2, 21);
var INT_2_32 = Math.pow(2, 32);

/* 2^32 = 429 4967296 */
var INT_2_32_0 = 4967296;
var INT_2_32_1 = 429;

/* 2^64 = 184467 4407370 9551616 */
var INT_2_64_0 = 9551616;
var INT_2_64_1 = 4407370;
var INT_2_64_2 = 184467;

/* 10^7 for base 2^16 */
var BIN_10_7_0 = 38528;
var BIN_10_7_1 = 152;

/* 10^14 for base 2^16 */
var BIN_10_14_0 = 16384;
var BIN_10_14_1 = 4218;
var BIN_10_14_2 = 23283;

/* 10^21 for base 2^16 */
var BIN_10_21_0 = 0;
var BIN_10_21_1 = 56992;
var BIN_10_21_2 = 44485;
var BIN_10_21_3 = 13769;
var BIN_10_21_4 = 54;

/* 10^28 for base 2^16 */
var BIN_10_28_0 = 0;
var BIN_10_28_1 = 4096;
var BIN_10_28_2 = 609;
var BIN_10_28_3 = 15909;
var BIN_10_28_4 = 52830;
var BIN_10_28_5 = 8271;

/* 10^35 for base 2^16 */
var BIN_10_35_0 = 0;
var BIN_10_35_1 = 0;
var BIN_10_35_2 = 36840;
var BIN_10_35_3 = 11143;
var BIN_10_35_4 = 19842;
var BIN_10_35_5 = 29383;
var BIN_10_35_6 = 16993;
var BIN_10_35_7 = 19;

/* max values for UInt */
var UInt64Max = '18446744073709551615';
var UInt64MaxLen = 20;

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
    return '' + x2 + zeropad.lpad14(x1 * BASE + x0);
  }
  return '-' + x2 + zeropad.lpad14(x1 * BASE + x0);

}

function isUInt64(value) {
  if (typeof value === 'number') {
    return true;
  }
  if (value.length < UInt64MaxLen) {
    return true;
  }
  if (value.length === UInt64MaxLen && value <= UInt64Max) {
    return true;
  }
  return false;
}

function writeDec128(buffer, value, offset) {
  offset = offset || 0;
  buffer.fill(0x00, offset, offset + 16);

  if (isUInt64(value.m)) {
    writeUInt64(buffer, value.m, offset);
  } else {
    writeUInt128(buffer, value.m, offset);
  }

  var e = EXP_BIAS + value.e;

  var e0 = e << 1;
  e0 &= 0xfe;
  e0 |= buffer[offset + 14] & 0x01;
  buffer[offset + 14] = e0;

  var e1 = e >> 7;
  if (value.s < 0) {
    e1 |= 0x80;
  }
  buffer[offset + 15] = e1;
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
    e: ((((buffer[offset + 1] << 8) | buffer[offset]) & 0x7ffe) >> 1) -
      EXP_BIAS
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

  y0 += l * INT_2_32_0;
  y1 += l * INT_2_32_1;
  y2 = 0;

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
    dec.m = '' + x4 + zeropad.lpad14(x3 * BASE + x2) + zeropad.lpad14(x1 * BASE + x0);
    return dec;
  }
  if (x3) {
    dec.m = '' + (x3 * BASE + x2) + zeropad.lpad14(x1 * BASE + x0);
    return dec;
  }
  dec.m = '' + x2 + zeropad.lpad14(x1 * BASE + x0);
  return dec;
}

function readDecFloat(buffer, offset) {
  var value = readDec128(buffer, offset);
  if (value === null) {
    return null;
  }
  var d, l, e;
  d = '' + value.m;
  l = d.length;
  e = value.e + l - 1;
  if (e < 0) {
    e = 'e' + e;
  } else {
    e = 'e+' + e;
  }
  while (d.charCodeAt(l - 1) === 48) {
    l -= 1;
  }
  if (l > 1) {
    d = d.substring(0, 1) + '.' + d.substring(1, l);
  }
  if (value.s < 0) {
    return '-' + d + e;
  }
  return d + e;
}

function readDecFixed(buffer, offset, frac) {
  var value = readDec128(buffer, offset);
  if (value === null) {
    return null;
  }
  frac = frac || 0;
  var d, e, l, k, i, f;
  d = '' + value.m;
  e = value.e;
  if (e < 0) {
    l = d.length;
    k = l + e;
    if (k > 0) {
      i = d.substring(0, k);
      f = d.substring(k);
    } else if (k < 0) {
      i = '0';
      f = zeropad.ZEROS[-k] + d;
    } else {
      i = '0';
      f = d;
    }
  } else if (e > 0) {
    i = d + zeropad.ZEROS[e];
    f = '';
  } else {
    i = d;
    f = '';
  }
  if (value.s < 0) {
    i = '-' + i;
  }
  if (frac === 0) {
    return i;
  }
  l = f.length;
  if (l > frac) {
    f = f.substring(0, frac);
  } else if (l < frac) {
    f += zeropad.ZEROS[frac - l];
  }
  return i + '.' + f;
}


function _writeInt64(buffer, value, offset, unsigned) {

  var l, x, a, b, c, x0, x1, y0, y1, z0, z1, z2, z3;

  var negative = false;

  if (typeof value === 'string') {

    l = value.length;

    if (l > 15) {

      a = +value.substring(l - 7);
      b = +value.substring(l - 14, l - 7);
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

      z0 += y0 * BIN_10_7_0;
      z1 += y0 * BIN_10_7_1 + y1 * BIN_10_7_0;
      z2 += y1 * BIN_10_7_1;

      y0 = c % INT_2_16;
      y1 = Math.floor(c / INT_2_16);

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

function readUInt128(buffer, offset) {

  var i, j, k, l, z0, z1, y0, y1, y2, x0, x1, x2, x3, x4;

  offset = offset || 0;

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

  l = (buffer[offset + 2]) << 16;
  l |= buffer[offset + 1] << 8;
  l |= buffer[offset];
  l += buffer[offset + 3] << 24 >>> 0;

  if (k === 0 && l === 0) {
    if (j === 0) {
      return i;
    }
    if (j < INT_2_21 || (j === INT_2_21 && i === 0)) {
      return j * INT_2_32 + i;
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
    return '' + x4 + zeropad.lpad14(x3 * BASE + x2) + zeropad.lpad14(x1 * BASE +
      x0);
  }
  if (x3) {
    return '' + (x3 * BASE + x2) + zeropad.lpad14(x1 * BASE + x0);
  }
  return '' + x2 + zeropad.lpad14(x1 * BASE + x0);
}


function writeUInt128(buffer, value, offset) {

  var l, a, b, c, d, e, f,
    x0, x1, x2, x3, y0, y1, z0, z1, z2, z3, z4, z5, z6, z7;

  l = value.length;

  a = +value.substring(l - 7);
  if (l > 7) {
    b = +value.substring(l - 14, l - 7);
  } else {
    b = 0;
  }
  if (l > 14) {
    c = +value.substring(l - 21, l - 14);
  } else {
    c = 0;
  }
  if (l > 21) {
    d = +value.substring(l - 28, l - 21);
  } else {
    d = 0;
  }
  if (l > 28) {
    e = +value.substring(l - 35, l - 28);
  } else {
    e = 0;
  }
  if (l > 35) {
    f = +value.substring(0, l - 35);
  } else {
    f = 0;
  }

  z0 = z1 = z2 = z3 = z4 = z5 = z6 = z7 = 0;

  // set a * 10^0
  if (a) {
    z0 = a % INT_2_16;
    z1 = Math.floor(a / INT_2_16);
  }

  // add b * 10^7
  if (b) {
    y0 = b % INT_2_16;
    y1 = Math.floor(b / INT_2_16);
    z0 += y0 * BIN_10_7_0;
    z1 += y0 * BIN_10_7_1 + y1 * BIN_10_7_0;
    z2 += y1 * BIN_10_7_1;
  }

  // add c * 10^14
  if (c) {
    y0 = c % INT_2_16;
    y1 = Math.floor(c / INT_2_16);
    z0 += y0 * BIN_10_14_0;
    z1 += y0 * BIN_10_14_1 + y1 * BIN_10_14_0;
    z2 += y0 * BIN_10_14_2 + y1 * BIN_10_14_1;
    z3 += y1 * BIN_10_14_2;
  }

  // add d * 10^21
  if (d) {
    y0 = d % INT_2_16;
    y1 = Math.floor(d / INT_2_16);
    z0 += y0 * BIN_10_21_0;
    z1 += y0 * BIN_10_21_1 + y1 * BIN_10_21_0;
    z2 += y0 * BIN_10_21_2 + y1 * BIN_10_21_1;
    z3 += y0 * BIN_10_21_3 + y1 * BIN_10_21_2;
    z4 += y0 * BIN_10_21_4 + y1 * BIN_10_21_3;
    z5 += y1 * BIN_10_21_4;
  }

  // add e * 10^28
  if (e) {
    y0 = e % INT_2_16;
    y1 = Math.floor(e / INT_2_16);
    z0 += y0 * BIN_10_28_0;
    z1 += y0 * BIN_10_28_1 + y1 * BIN_10_28_0;
    z2 += y0 * BIN_10_28_2 + y1 * BIN_10_28_1;
    z3 += y0 * BIN_10_28_3 + y1 * BIN_10_28_2;
    z4 += y0 * BIN_10_28_4 + y1 * BIN_10_28_3;
    z5 += y0 * BIN_10_28_5 + y1 * BIN_10_28_4;
    z6 += y1 * BIN_10_28_5;
  }

  // add f * 10^35
  if (f) {
    y0 = f % INT_2_16;
    z0 += y0 * BIN_10_35_0;
    z1 += y0 * BIN_10_35_1;
    z2 += y0 * BIN_10_35_2;
    z3 += y0 * BIN_10_35_3;
    z4 += y0 * BIN_10_35_4;
    z5 += y0 * BIN_10_35_5;
    z6 += y0 * BIN_10_35_6;
    z7 += y0 * BIN_10_35_7;
  }

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
  if (z3 >= INT_2_16) {
    z4 += Math.floor(z3 / INT_2_16);
    z3 %= INT_2_16;
  }
  if (z4 >= INT_2_16) {
    z5 += Math.floor(z4 / INT_2_16);
    z4 %= INT_2_16;
  }
  if (z5 >= INT_2_16) {
    z6 += Math.floor(z5 / INT_2_16);
    z5 %= INT_2_16;
  }
  if (z6 >= INT_2_16) {
    z7 += Math.floor(z6 / INT_2_16);
    z6 %= INT_2_16;
  }

  x0 = z1 * INT_2_16 + z0;
  x1 = z3 * INT_2_16 + z2;
  x2 = z5 * INT_2_16 + z4;
  x3 = z7 * INT_2_16 + z6;

  buffer[offset + 3] = (x0 >>> 24) & 0xff;
  buffer[offset + 2] = (x0 >>> 16) & 0xff;
  buffer[offset + 1] = (x0 >>> 8) & 0xff;
  buffer[offset] = x0 & 0xff;
  offset += 4;

  buffer[offset + 3] = (x1 >>> 24) & 0xff;
  buffer[offset + 2] = (x1 >>> 16) & 0xff;
  buffer[offset + 1] = (x1 >>> 8) & 0xff;
  buffer[offset] = x1 & 0xff;
  offset += 4;

  buffer[offset + 3] = (x2 >>> 24) & 0xff;
  buffer[offset + 2] = (x2 >>> 16) & 0xff;
  buffer[offset + 1] = (x2 >>> 8) & 0xff;
  buffer[offset] = x2 & 0xff;
  offset += 4;

  buffer[offset + 3] = (x3 >>> 24) & 0xff;
  buffer[offset + 2] = (x3 >>> 16) & 0xff;
  buffer[offset + 1] = (x3 >>> 8) & 0xff;
  buffer[offset] = x3 & 0xff;
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

exports.readInt64LE = readInt64;
exports.readUInt64LE = readUInt64;
exports.writeInt64LE = writeInt64;
exports.writeUInt64LE = writeUInt64;
exports.readUInt128LE = readUInt128;
exports.writeUInt128LE = writeUInt128;
exports.readDec128 = readDec128;
exports.writeDec128 = writeDec128;
exports.readDecFloat = readDecFloat;
exports.readDecFixed = readDecFixed;
