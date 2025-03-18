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

var fs = require('fs');
var path = require('path');
var lib = require('../../lib');
var TypeCode = lib.common.TypeCode;
var LobOptions = lib.common.LobOptions;
var MAX_PART_SIZE = Math.pow(2, 10);

exports.MAX_PART_SIZE = MAX_PART_SIZE;

exports.DEFAULT = {
  part: {
    argumentCount: 1,
    buffer: new Buffer(
      '1e03616c6c' +
      '1d0464617465' +
      '1d0464657363' +
      '0301000000' +
      '0328000000' +
      '0100' +
      '1e03616c6c' +
      '1e00' +
      '1e00' +
      '1e00', 'hex')
  },
  types: [
    TypeCode.NSTRING,
    TypeCode.STRING,
    TypeCode.STRING,
    TypeCode.INT,
    TypeCode.INT,
    TypeCode.TINYINT,
    TypeCode.NSTRING,
    TypeCode.NSTRING,
    TypeCode.NSTRING,
    TypeCode.NSTRING
  ],
  values: [
    'all',
    'date',
    'desc',
    1,
    40,
    0,
    'all',
    '',
    '',
    ''
  ]
};

var blob = new Buffer(
  '89504e470d0a1a0a0000000d494844520000000d0000000e0806000000f47f96d20000' +
  '000467414d410000b18f0bfc6105000000097048597300000ec100000ec101b8916bed' +
  '0000001974455874536f667477617265005061696e742e4e45542076332e352e38373b' +
  '805d00000045494441542853636040030606060b80f83f125e80ae06850fd3a0afaf6f' +
  '00c350cd981ad14c46b605838dd756a22489b10dc320a8a6787cf4a826030370005135' +
  '2068971a00fc928ca7dff7607f0000000049454e44ae426082', 'hex');
var clob = new Buffer('Bjoern Borg', 'ascii');
var nclob = new Buffer('Bj\u00F6rn Borg', 'utf8');
exports.ALL_TYPES = {
  part: {
    argumentCount: 1,
    buffer: Buffer.concat([new Buffer(
      '0301000000' +
      '020200' +
      '0303000000' +
      '020400' +
      '0305000000' +
      '020600' +
      '040700000000000000' +
      '040800000000000000' +
      '0563000000000000000000000000003e30' +
      '069a992141' +
      '07b81e85eb51382640' +
      '0edd870a14' +
      '0edd870a14' +
      '10dd870a148d2827cb' +
      '0f8d2827cb' +
      '0f8d2827cb' +
      '10dd870a148d2827cb' +
      '10dd870a148d2827cb' +
      '1d086e696e657465656e' +
      '1e067477656e7479' +
      '8c' +
      '05ae080000000000000000000000003c30' +
      '060ad7b941' +
      '0685ebc141' +
      '8c' +
      '3F38450B00' +
      '3E6DB3C0DB0E000000' +
      '40EDB00000' +
      '3DBFB3AF519B36DB08' +
      '1C02' +
      // offset 197
      '1b06c8000000e4000000' +
      '19060b000000ac010000' +
      '1a060b000000b7010000',
      'hex'), blob, clob, nclob])
  },
  types: [
    TypeCode.INT,
    TypeCode.SMALLINT,
    TypeCode.INT,
    TypeCode.SMALLINT,
    TypeCode.INT,
    TypeCode.SMALLINT,
    TypeCode.BIGINT,
    TypeCode.BIGINT,
    TypeCode.DECIMAL,
    TypeCode.REAL,
    TypeCode.DOUBLE,
    TypeCode.DATE,
    TypeCode.DATE,
    TypeCode.TIMESTAMP,
    TypeCode.TIME,
    TypeCode.TIME,
    TypeCode.TIMESTAMP,
    TypeCode.TIMESTAMP,
    TypeCode.VARCHAR1,
    TypeCode.NVARCHAR,
    TypeCode.VARBINARY,
    TypeCode.DECIMAL,
    TypeCode.REAL,
    TypeCode.REAL,
    TypeCode.BINARY,
    TypeCode.DAYDATE,
    TypeCode.SECONDDATE,
    TypeCode.SECONDTIME,
    TypeCode.LONGDATE,
    TypeCode.BOOLEAN,
    TypeCode.BLOB,
    TypeCode.CLOB,
    TypeCode.NCLOB
  ],
  values: [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9.9,
    10.1,
    11.11,
    '2013-11-20',
    '2013-11-20',
    '2013-11-20T13:40:52.007',
    '13:40:52.007',
    '13:40:52.007',
    '2013-11-20T13:40:52.007',
    '2013-11-20T13:40:52.007',
    'nineteen',
    'twenty',
    null,
    22.22,
    23.23,
    24.24,
    null,
    '2023-04-04',
    '2023-04-04 12:34:52',
    '12:34:52',
    '2023-04-04 12:34:52.1357246',
    true,
    blob,
    clob,
    nclob
  ]
};

var uuid = '536A6F342D036BA5E10000000A434504';

exports.BINARY = {
  part: {
    argumentCount: 1,
    buffer: new Buffer('0c10' + uuid + '0c10' + uuid + '0c10' + uuid, 'hex')
  },
  types: [
    TypeCode.BINARY,
    TypeCode.VARBINARY,
    TypeCode.BSTRING
  ],
  values: [
    new Buffer(uuid, 'hex'),
    new Buffer(uuid, 'hex'),
    new Buffer(uuid, 'hex')
  ]
};


var logo = fs.readFileSync(path.join(__dirname, 'img', 'logo.png'));

function logoBuffer(size) {
  var buffer = new Buffer(size);
  var offset = 15;
  buffer[0] = TypeCode.INT;
  buffer.writeInt32LE(1, 1);
  buffer[5] = TypeCode.BLOB;
  buffer[6] = LobOptions.DATA_INCLUDED;
  buffer.writeInt32LE(size - offset, 7);
  buffer.writeInt32LE(offset + 1, 11);
  logo.copy(buffer, offset, 0, size - offset);
  return buffer;
}
exports.LOGO = {
  part: {
    argumentCount: 1,
    buffer: logoBuffer(MAX_PART_SIZE)
  },
  types: [
    TypeCode.INT,
    TypeCode.BLOB
  ],
  values: [
    1,
    logo
  ]
};

exports.EMOJI = {
  part: {
    argumentCount: 2,
    buffer: Buffer.concat([
      new Buffer([0x1e, 0x6]),
      new Buffer([0xed, 0xa0, 0xbc, 0xed, 0xbd, 0xa8]), // cesu-8 encoded 🍨
      new Buffer([0x1a, 0x6, 0x6, 0x0, 0x0, 0x0, 0x13, 0x0, 0x0, 0x0]),
      new Buffer([0xed, 0xa0, 0xbc, 0xed, 0xbd, 0xa9])  // cesu-8 encoded 🍩
    ])
  },
  types: [
    TypeCode.NSTRING,
    TypeCode.NCLOB
  ],
  values: [
    '🍨',
    '🍩'
  ]
};

exports.DECIMAL = {
  part: {
    argumentCount: 1,
    buffer: new Buffer(
      '057b000000000000000000000000004030' + // 123
      '057b0000000000000000000000000040b0' + // -123
      '057b000000000000000000000000004030' + // 123
      '057b0000000000000000000000000040b0' + // -123
      '057b00000000000000000000000000a430' + // 123e50
      '057b00000000000000000000000000dcaf' + // -123e-50
      '057b000000000000000000000000004030' + // 123
      '057b0000000000000000000000000040b0' + // -123
      '057b000000000000000000000000004030' + // 123
      '057b000000000000000000000000003a30' + // 0.123
      '057b000000000000000000000000003ab0' + // -0.123
      '057b000000000000000000000000003a30' + // 0.123
      '057b000000000000000000000000003ab0' + // -0.123
      '0500000000000000000000000000004030' + // 0
      '0500000000000000000000000000004030' + // 0
      '0500000000000000000000000000004030' + // 0
      '0500000000000000000000000000004030' + // 0
      '0540e20100000000000000000000003a30' + // 123.456
      '0540e20100000000000000000000003ab0' + // -123.456
      '0540e20100000000000000000000003a30' + // 123.456
      '0540e20100000000000000000000003ab0' + // -123.456
      '05ffffffffffffffffffffffffffff4030' + // max 112 bit unsigned int
      '05ffffffffffffffffffffffffffff3009' + // max112UInt * 10^-5000
      '05ffffffffffffffffffffffffffff40b0' + // -max112UInt
      '05ffffffffffffffffffffffffffff50d7' + // -max112UInt * 10^5000
      '05ffffffffffffffffffffffffffff5430' + // max112UInt * 10^10
      '05ffffffffffffffffffffffffffff54b0' + // -max112UInt * 10^10
      '05ffffffffffffffffffffffffffff2c30' + // max112UInt * 10^-10
      '05ffffffffffffffffffffffffffff2cb0' + // -max112UInt * 10^-10
      '0500000000000000000000000000004130' + // max112UInt + 1
      '05000000000000000000000000000041b0' + // -(max112UInt + 1)
      '05f3af967ed05c82de3297ff6fde3c6030' + // 1234567890123456789012345678901235
      '05f3af967ed05c82de3297ff6fde3c0230' + // 123.4567890123456789012345678901235
      '05f3af967ed05c82de3297ff6fde3c60b0' + // -1234567890123456789012345678901235
      '05f3af967ed05c82de3297ff6fde3c02b0' + // -123.4567890123456789012345678901235
      '057b00000000000000000000000000d42f' + // 123 * 10^-54
      '057b00000000000000000000000000d4af' + // -123 * 10^-54
      '05fdffffff638e8d37c087adbe09ed4130' + // 9999999999999999999999999999999997
      '05feffffff638e8d37c087adbe09ed4130' + // 9999999999999999999999999999999998
      '05ffffffff638e8d37c087adbe09ed4130' + // 9999999999999999999999999999999999
      '0501000000000000000000000000008430' + // 10000000000000000000000000000000000
      '0501000000000000000000000000008430' + // 10000000000000000000000000000000000
      '0501000000000000000000000000008430' + // 10000000000000000000000000000000000
      '0501000000000000000000000000008430' + // 10000000000000000000000000000000000
      '0501000000000000000000000000008430' + // 10000000000000000000000000000000000
      '05010000000a5bc138938d44c64d314230' + // 10000000000000000000000000000000010
      '05010000000a5bc138938d44c64d314230' + // 10000000000000000000000000000000010
      '05010000000a5bc138938d44c64d314230' + // 10000000000000000000000000000000010
      '05010000000a5bc138938d44c64d314230' + // 10000000000000000000000000000000010
      '05010000000a5bc138938d44c64d314230' + // 10000000000000000000000000000000010
      '0501000000000000000000000000008630' + // 100000000000000000000000000000000000
      '05fe7fc6a47e8d03000000000000006830' + // 99999999999999800000000000000000000
      '05ffffffff638e8d37c087adbe09ed4330' + // 99999999999999999999999999999999990
      '0501000000000000000000000000008630' + // 100000000000000000000000000000000000
      '05fe7fc6a47e8d03000000000000001ab0' + // -0.0000999999999999998
      '05d30a3f4eeee073c3f60fe98e01004e30' + // 1234567890123456789012345678910000000
      // Fixed decimals
      '057b000000000000000000000000004030' + // 123
      '057b0000000000000000000000000040b0' + // -123
      '057b000000000000000000000000003a30' + // 0.123
      '057b000000000000000000000000003ab0' + // -0.123
      '05f2af967ed05c82de3297ff6fde3c6030' + // 1234567890123456789012345678901234
      '05f2af967ed05c82de3297ff6fde3c6030' + // 1234567890123456789012345678901234
      '05f2af967ed05c82de3297ff6fde3c0230' + // 123.4567890123456789012345678901234
      '05f2af967ed05c82de3297ff6fde3c60b0' + // -1234567890123456789012345678901234
      '05f2af967ed05c82de3297ff6fde3c60b0' + // -1234567890123456789012345678901234
      '05f2af967ed05c82de3297ff6fde3c02b0' + // -123.4567890123456789012345678901234
      '05ffffffff638e8d37c087adbe09ed4130' + // 9999999999999999999999999999999999
      '0501000000000000000000000000008430' + // 10000000000000000000000000000000000
      '0501000000000000000000000000008430' + // 10000000000000000000000000000000000
      '0501000000000000000000000000008430' + // 10000000000000000000000000000000000
      '05ffffffff638e8d37c087adbe09ed4330' + // 99999999999999999999999999999999990
      '05ffff2fec5a48ff21bf87adbe09ed4330' + // 99999999999999799999999999999999990
      '05ffffffff638e8d37c087adbe09ed4330' + // 99999999999999999999999999999999990
      '05ffffffff638e8d37c087adbe09ed4330' + // 99999999999999999999999999999999990
      '05ffff2fec5a48ff21bf87adbe09edf5af' + // -0.0000999999999999997999999999999999
      '052fd2967ed05c82de3297ff6fde3c4630', 'hex') // 1234567890123456789012345678909999000
  },
  types: [
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
    TypeCode.DECIMAL,
  ],
  fractions: [
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    32767,
    0,
    0,
    3,
    3,
    0,
    0,
    31,
    0,
    0,
    31,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    34,
    0,
  ],
  values: [
    123,
    -123,
    "123",
    "-123",
    "123e50",
    "-123e-50",
    "00000123",
    "-00000123",
    "123.",
    ".123",
    "-.123",
    "00000.123",
    "-00000.123",
    "0.",
    "00000.",
    ".0",
    ".00000",
    "000123.456",
    "-000123.456",
    "123.456000",
    "-123.456000",
    "5192296858534827628530496329220095", // max 112 bit unsigned int
    "5192296858534827628530496329220095e-5000",
    "-5192296858534827628530496329220095",
    "-5192296858534827628530496329220095e5000",
    "51922968585348276285304963292200950000000000",
    "-51922968585348276285304963292200950000000000",
    "519229685853482762853049.6329220095",
    "-519229685853482762853049.6329220095",
    "5192296858534827628530496329220096", // max 112 bit + 1
    "-5192296858534827628530496329220096",
    "12345678901234567890123456789012345678901234567890",
    "123.45678901234567890123456789012345678901234567890",
    "-12345678901234567890123456789012345678901234567890",
    "-123.45678901234567890123456789012345678901234567890",
    ".000000000000000000000000000000000000000000000000000123",
    "-.000000000000000000000000000000000000000000000000000123",
    "9999999999999999999999999999999997",
    "9999999999999999999999999999999998",
    "9999999999999999999999999999999999",
    "10000000000000000000000000000000000",
    "10000000000000000000000000000000001",
    "10000000000000000000000000000000002",
    "10000000000000000000000000000000003",
    "10000000000000000000000000000000004",
    "10000000000000000000000000000000005",
    "10000000000000000000000000000000006",
    "10000000000000000000000000000000007",
    "10000000000000000000000000000000008",
    "10000000000000000000000000000000009",
    "99999999999999999999999999999999999",
    "99999999999999799999999999999999999",
    "99999999999999999999999999999999994",
    "99999999999999999999999999999999995",
    "-00000000000000000000000000000000000000009999999999999979999999999999999999999999999999.99900000000000e-50",
    "1234567890123456789012345678909999999",
    // Fixed decimals
    123,
    -123,
    ".123",
    "-.123",
    "12345678901234567890123456789012340000000000000000",
    "12345678901234567890123456789012345678901234567890",
    "123.45678901234567890123456789012345678901234567890",
    "-12345678901234567890123456789012340000000000000000",
    "-12345678901234567890123456789012345678901234567890",
    "-123.45678901234567890123456789012345678901234567890",
    "9999999999999999999999999999999999",
    "10000000000000000000000000000000001",
    "10000000000000000000000000000000005",
    "10000000000000000000000000000000009",
    "99999999999999999999999999999999999",
    "99999999999999799999999999999999999",
    "99999999999999999999999999999999994",
    "99999999999999999999999999999999995",
    "-00000000000000000000000000000000000000009999999999999979999999999999999999999999999999.99900000000000e-50",
    "1234567890123456789012345678909999999",
  ]
};

exports.FIXED = {
  part: {
    argumentCount: 1,
    buffer: new Buffer(
      '510000000000000000' + // 0, frac 3
      '51115227828b2f506d' + // 7876848024501572113, frac 0
      '5182749409bb6f0cd1' + // -3383206370951793534, frac 0
      '5144d6120000000000' + // 0.12345, frac 7 => 1234500
      '51bc29edffffffffff' + // -0.12345, frac 7 => -1234500
      '51ad6a1a0000000000' + // 17.312458, frac 5 => 1731245
      '515395e5ffffffffff' + // -17.312458, frac 5 => -1731245
      '51e9ffffffffffffff' + // -0.000232, frac 5 => -23
      '510080056e07fad705' + // 42108e+12, frac 1 => 421080000000000000
      '5154a5ffffffffffff' + // -2321296e-7, frac 5 => -23212
      '5197e1bd0000000000' + // 1.24440553e-11, frac 18 => 12444055
      '51903d33cefbffffff' + // -.001801537188867e10, frac 3 => -18015371888
      '510500000000000000' + // 59.443e-8, frac 7 => 5
      '510000000000000000' + // -59.443e-9, frac 7 => 0
      '52a4df8a3bcc59c6385d608c11' + // 5430949848529524638928789412, frac 0
      '52c184ae52fbc87d7fd8af61b2' + // -24021734553744354424755682111, frac 0
      '5244d612000000000000000000' + // 0.12345, frac 7 => 1234500
      '52bc29edffffffffffffffffff' + // -0.12345, frac 7 => -1234500
      '52ad6a1a000000000000000000' + // 17.312458, frac 5 => 1731245
      '525395e5ffffffffffffffffff' + // -17.312458, frac 5 => -1731245
      '52e9ffffffffffffffffffffff' + // -0.000232, frac 5 => -23
      '520000988e0b6771c4446fc5f3' + // -378462129e+17, frac 2 => -3784621290000000000000000000
      '5254a5ffffffffffffffffffff' + // -2321296e-7, frac 5 => -23212
      '5297e1bd000000000000000000' + // 1.24440553e-21, frac 28 => 12444055
      '52903d33cefbffffffffffffff' + // -.001801537188867e10, frac 3 => -18015371888
      '52050000000000000000000000' + // 59.443e-8, frac 7 => 5
      '52000000000000000000000000' + // -59.443e-9, frac 7 => 0
      '4c7b000000000000000000000000000000' + // 123, frac 0
      '4c800b257d6e8e3a2db59e667ee5c4ed00' + // 1234567890123456789012345678910000000, frac 0
      '4c008d8d1caf6fb63becccfd0f094fb6f6' + // -1234567890123456789012345678910000000, frac 1
      '4c3ae20100000000000000000000000000' + // 0.012345, frac 7 => 123450
      '4cc61dfeffffffffffffffffffffffffff' + // -0.012345, frac 7 => -123450
      '4c1a851e00000000000000000000000000' + // 2000.15429, frac 3 => 2000154
      '4ce67ae1ffffffffffffffffffffffffff' + // -2000.15429, frac 3 => -2000154
      '4c79f97809000000000000000000000000' + // 15892312.998, frac 1 => 158923129
      '4c870687f6ffffffffffffffffffffffff' + // -15892312.998, frac 1 => -158923129
      '4c00000000000000000000000000000000' + // 0.9, frac 0 => 0
      '4c00000000000000000000000000000000' + // -0.9, frac 0 => 0
      '4c00000000000000000000000000000000' + // 0.000099999, frac 1 => 0
      '4cffffffff3f228a097ac4865aa84c3b4b' + // 99999999999999999999999999999999999999, frac 0
      '4cffffffff3f228a097ac4865aa84c3b4b' + // 9999999999999999999999999999.99999999999999, frac 10
      '4c00000000782422ea8a3dc225d2e44009' + // 123e+34, frac 1 => 12300000000000000000000000000000000000
      '4c76f5ffffffffffffffffffffffffffff' + // -26981039051.12e-32, frac 25 => -2698
      '4c8cb91d00000000000000000000000000' + // 1.948044795288557e-32, frac 38 => 1948044
      '4cc9fdffffffffffffffffffffffffffff' + // -0.000000000000056789012345e15, frac 1 => -567
      '4c00000000000000000000000000000000' + // 9e-35, frac 34 => 0
      '4c00000000000000000000000000000000', 'hex') // -9e-35, frac 34 => 0
  },
  types: [
    TypeCode.FIXED8,
    TypeCode.FIXED8,
    TypeCode.FIXED8,
    TypeCode.FIXED8,
    TypeCode.FIXED8,
    TypeCode.FIXED8,
    TypeCode.FIXED8,
    TypeCode.FIXED8,
    TypeCode.FIXED8,
    TypeCode.FIXED8,
    TypeCode.FIXED8,
    TypeCode.FIXED8,
    TypeCode.FIXED8,
    TypeCode.FIXED8,
    TypeCode.FIXED12,
    TypeCode.FIXED12,
    TypeCode.FIXED12,
    TypeCode.FIXED12,
    TypeCode.FIXED12,
    TypeCode.FIXED12,
    TypeCode.FIXED12,
    TypeCode.FIXED12,
    TypeCode.FIXED12,
    TypeCode.FIXED12,
    TypeCode.FIXED12,
    TypeCode.FIXED12,
    TypeCode.FIXED12,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
    TypeCode.FIXED16,
  ],
  fractions: [
    3,
    0,
    0,
    7,
    7,
    5,
    5,
    5,
    1,
    5,
    18,
    3,
    7,
    7,
    0,
    0,
    7,
    7,
    5,
    5,
    5,
    2,
    5,
    28,
    3,
    7,
    7,
    0,
    0,
    1,
    7,
    7,
    3,
    3,
    1,
    1,
    0,
    0,
    1,
    0,
    10,
    1,
    25,
    38,
    1,
    34,
    34,
  ],
  values: [
    0,
    '7876848024501572113',
    '-3383206370951793534',
    '0.12345',
    '-0.12345',
    '17.312458',
    '-17.312458',
    '-0.000232',
    '42108e+12',
    '-2321296e-7',
    '1.24440553e-11',
    '-.001801537188867e10',
    '59.443e-8',
    '-59.443e-9',
    '5430949848529524638928789412',
    '-24021734553744354424755682111',
    '0.12345',
    '-0.12345',
    '17.312458',
    '-17.312458',
    '-0.000232',
    '-378462129e+17',
    '-2321296e-7',
    '1.24440553e-21',
    '-.001801537188867e10',
    '59.443e-8',
    '-59.443e-9',
    123,
    "1234567890123456789012345678910000000",
    "-1234567890123456789012345678910000000",
    "0.012345",
    "-0.012345",
    "2000.15429",
    "-2000.15429",
    "15892312.998",
    "-15892312.998",
    "0.9",
    "-0.9",
    "0.000099999",
    "99999999999999999999999999999999999999",
    "9999999999999999999999999999.99999999999999",
    "123e+34",
    "-26981039051.12e-32",
    "1.948044795288557e-32",
    "-0.000000000000056789012345e15",
    "9e-35",
    "-9e-35",
  ]
}

exports.DATETIME = {
  part: {
    argumentCount: 1,
    buffer: new Buffer(
      '90' +
      '3dc9f830e43673b308' +
      '3d027700111f64ed06' +
      '3d811658b7c86aed06' +
      '3d0100000000000000' +
      '3d00c00a49082aca2b' +
      '90' +
      '3eb9830a990e000000' +
      '3e0100000000000000' +
      '3e80db887749000000' +
      '8e' +
      '3f9e120b00' +
      '3f439d0600' +
      '3f01000000' +
      '3fddb93700' +
      '8f' +
      '4039880000' +
      '4080510100' +
      '4001000000', 'hex')
  },
  types: [
    TypeCode.LONGDATE,
    TypeCode.LONGDATE,
    TypeCode.LONGDATE,
    TypeCode.LONGDATE,
    TypeCode.LONGDATE,
    TypeCode.LONGDATE,
    TypeCode.SECONDDATE,
    TypeCode.SECONDDATE,
    TypeCode.SECONDDATE,
    TypeCode.SECONDDATE,
    TypeCode.DAYDATE,
    TypeCode.DAYDATE,
    TypeCode.DAYDATE,
    TypeCode.DAYDATE,
    TypeCode.DAYDATE,
    TypeCode.SECONDTIME,
    TypeCode.SECONDTIME,
    TypeCode.SECONDTIME,
    TypeCode.SECONDTIME,
  ],
  values: [
    null,
    '1987-10-16 09:41:12.84738',
    '1582-10-15 12:30:30.0000001',
    '1582-10-14 00:00:01',
    '0001-01-01 00:00:00',
    '9999-12-31 23:59:59.999999999999',
    null,
    '1987-10-16 09:41:12',
    '0001-01-01 00:00:00',
    '9999-12-31 23:59:59',
    null,
    '1987-10-16',
    '1187-10-16',
    '0001-01-01',
    '9999-12-31',
    null,
    '09:41:12',
    '23:59:59',
    '00:00:00'
  ]
};

exports.BOOLEAN = {
  part: {
    argumentCount: 1,
    buffer: new Buffer(
      '1C02' +
      '9C' +
      '1C00', 'hex')
  },
  types: [
    TypeCode.BOOLEAN,
    TypeCode.BOOLEAN,
    TypeCode.BOOLEAN,
  ],
  values: [
    true,
    null,
    false
  ]
};
