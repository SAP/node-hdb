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
      // offset 167
      '1b06c8000000c6000000' +
      '19060b0000008e010000' +
      '1a060b00000099010000',
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
