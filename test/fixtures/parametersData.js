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

var lib = require('../lib');
var TypeCode = lib.common.TypeCode;

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
  values: [{
    type: TypeCode.NSTRING,
    value: 'all'
  }, {
    type: TypeCode.STRING,
    value: 'date'
  }, {
    type: TypeCode.STRING,
    value: 'desc'
  }, {
    type: TypeCode.INT,
    value: 1
  }, {
    type: TypeCode.INT,
    value: 40
  }, {
    type: TypeCode.TINYINT,
    value: 0
  }, {
    type: TypeCode.NSTRING,
    value: 'all'
  }, {
    type: TypeCode.NSTRING,
    value: ''
  }, {
    type: TypeCode.NSTRING,
    value: ''
  }, {
    type: TypeCode.NSTRING,
    value: ''
  }]
};

var blob = new Buffer(
  '89504e470d0a1a0a0000000d494844520000000d0000000e0806000000f47f96d20000' +
  '000467414d410000b18f0bfc6105000000097048597300000ec100000ec101b8916bed' +
  '0000001974455874536f667477617265005061696e742e4e45542076332e352e38373b' +
  '805d00000045494441542853636040030606060b80f83f125e80ae06850fd3a0afaf6f' +
  '00c350cd981ad14c46b605838dd756a22489b10dc320a8a6787cf4a826030370005135' +
  '2068971a00fc928ca7dff7607f0000000049454e44ae426082', 'hex');
var clob = new Buffer('Hello CLOB', 'utf8');
var nclob = new Buffer('Hello NCLOB', 'utf8');
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
      '1b06c8000000c6000000' +
      '1a060a0000008e010000' +
      '1a060b00000098010000',
      'hex'), blob, clob, nclob])
  },
  values: [{
    type: TypeCode.INT,
    value: 1
  }, {
    type: TypeCode.SMALLINT,
    value: 2
  }, {
    type: TypeCode.INT,
    value: 3
  }, {
    type: TypeCode.SMALLINT,
    value: 4
  }, {
    type: TypeCode.INT,
    value: 5
  }, {
    type: TypeCode.SMALLINT,
    value: 6
  }, {
    type: TypeCode.BIGINT,
    value: 7
  }, {
    type: TypeCode.BIGINT,
    value: 8
  }, {
    type: TypeCode.DECIMAL,
    value: 9.9
  }, {
    type: TypeCode.REAL,
    value: 10.1
  }, {
    type: TypeCode.DOUBLE,
    value: 11.11
  }, {
    type: TypeCode.DATE,
    value: '2013-11-20'
  }, {
    type: TypeCode.DATE,
    value: '2013-11-20'
  }, {
    type: TypeCode.TIMESTAMP,
    value: '2013-11-20T13:40:52.007'
  }, {
    type: TypeCode.TIME,
    value: '13:40:52.007'
  }, {
    type: TypeCode.TIME,
    value: '13:40:52.007'
  }, {
    type: TypeCode.TIMESTAMP,
    value: '2013-11-20T13:40:52.007'
  }, {
    type: TypeCode.TIMESTAMP,
    value: '2013-11-20T13:40:52.007'
  }, {
    type: TypeCode.VARCHAR1,
    value: 'nineteen'
  }, {
    type: TypeCode.NVARCHAR,
    value: 'twenty'
  }, {
    type: TypeCode.VARBINARY,
    value: null
  }, {
    type: TypeCode.DECIMAL,
    value: 22.22
  }, {
    type: TypeCode.REAL,
    value: 23.23
  }, {
    type: TypeCode.REAL,
    value: 24.24
  }, {
    type: TypeCode.BINARY,
    value: null
  }, {
    type: TypeCode.BLOB,
    value: blob
  }, {
    type: TypeCode.CLOB,
    value: clob
  }, {
    type: TypeCode.NCLOB,
    value: nclob
  }]
};