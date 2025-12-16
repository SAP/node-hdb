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


var lib = require('../../../lib');
var bignum = lib.util.bignum;
var SegmentKind = lib.common.SegmentKind;
var FunctionCode = lib.common.FunctionCode;
var PartKind = lib.common.PartKind;
var LobSourceType = lib.common.LobSourceType;
var LobOptions = lib.common.LobOptions;

var IMAGES = require('../../fixtures/images');

exports['select * from dummy'] = {
  kind: SegmentKind.REPLY,
  functionCode: FunctionCode.SELECT,
  parts: [{
    kind: PartKind.RESULT_SET_METADATA,
    argumentCount: 1,
    attributes: 0,
    buffer: new Buffer(
      '020800000100000000000000ffffffff06000000060000000544554d4d590544' +
      '554d4d59', 'hex')
  }, {
    kind: PartKind.RESULT_SET_ID,
    argumentCount: 1,
    attributes: 0,
    buffer: new Buffer(
      '0100000000000000', 'hex')
  }, {
    kind: PartKind.RESULT_SET,
    argumentCount: 1,
    attributes: 17,
    buffer: new Buffer(
      '0158', 'hex')
  }]
};

exports['select * from numbers order by a'] = {
  kind: SegmentKind.REPLY,
  functionCode: FunctionCode.SELECT,
  parts: [{
    kind: PartKind.RESULT_SET_METADATA,
    argumentCount: 2,
    attributes: 0,
    buffer: new Buffer(
      '020300000a00000000000000ffffffff08000000080000000209000010000000' +
      '0a000000ffffffff1200000012000000074e554d424552530141074e554d4245' +
      '52530142', 'hex')
  }, {
    kind: PartKind.RESULT_SET_ID,
    argumentCount: 1,
    attributes: 0,
    buffer: new Buffer(
      '0200000000000000', 'hex')
  }, {
    kind: PartKind.RESULT_SET,
    argumentCount: 32,
    attributes: 0,
    buffer: new Buffer(
      '0100000000047a65726f0101000000036f6e6501020000000374776f01030000' +
      '00057468726565010400000004666f7572010500000004666976650106000000' +
      '03736978010700000005736576656e0108000000056569676874010900000004' +
      '6e696e65010a0000000374656e010b00000006656c6576656e010c0000000674' +
      '77656c7665010d00000008746869727465656e010e00000008666f7572746565' +
      '6e010f000000076669667465656e0110000000077369787465656e0111000000' +
      '09736576656e7465656e011200000008656967687465656e0113000000086e69' +
      '6e657465656e0114000000067477656e747901150000000a7477656e74792d6f' +
      '6e6501160000000a7477656e74792d74776f01170000000c7477656e74792d74' +
      '6872656501180000000b7477656e74792d666f757201190000000b7477656e74' +
      '792d66697665011a0000000a7477656e74792d736978011b0000000c7477656e' +
      '74792d736576656e011c0000000c7477656e74792d6569676874011d0000000b' +
      '7477656e74792d6e696e65011e00000006746869727479011f0000000a746869' +
      '7274792d6f6e65', 'hex')
  }]
};

exports['select * from read_numbers_between_view with parameters (' +
  '\'placeholder\' = (\'$$a$$\', \'3\'),' +
  '\'placeholder\' = (\'$$b$$\', \'5\'))'] = {
    kind: SegmentKind.REPLY,
    functionCode: FunctionCode.SELECT,
    parts: [{
      kind: PartKind.RESULT_SET_METADATA,
      argumentCount: 2,
      attributes: 0,
      buffer: new Buffer(
        '020300000a00000000000000ffffffff1a0000001a0000000209000010000000' +
        '1c000000ffffffff360000003600000019524541445f4e554d424552535f4245' +
        '545745454e5f56494557014119524541445f4e554d424552535f424554574545' +
        '4e5f564945570142', 'hex')
    }, {
      kind: PartKind.RESULT_SET_ID,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        '0300000000000000', 'hex')
    }, {
      kind: PartKind.STATEMENT_CONTEXT,
      argumentCount: 2,
      attributes: 0,
      buffer: new Buffer(
        '0121080002000000000000000204cb17000000000000', 'hex')
    }, {
      kind: PartKind.RESULT_SET,
      argumentCount: 3,
      attributes: 17,
      buffer: new Buffer(
        '0103000000057468726565010400000004666f757201050000000466697665', 'hex'
      )
    }]
  };

exports['select * from images order by name'] = {
  kind: SegmentKind.REPLY,
  functionCode: FunctionCode.SELECT,
  parts: [{
    kind: PartKind.RESULT_SET_METADATA,
    argumentCount: 2,
    attributes: 0,
    buffer: new Buffer(
      '020900001000000000000000ffffffff0700000007000000021b0000ffff0000' +
      '0c000000ffffffff130000001300000006494d41474553044e414d4506494d41' +
      '474553054244415441', 'hex')
  }, {
    kind: PartKind.RESULT_SET_ID,
    argumentCount: 1,
    attributes: 0,
    buffer: new Buffer(
      '0400000000000000', 'hex')
  }, {
    kind: PartKind.RESULT_SET,
    argumentCount: IMAGES.length,
    attributes: 1,
    buffer: Buffer.concat(IMAGES.map(function imgToBuffer(img, index) {
      return getImageBuffer(index, 1024);
    }))
  }]
};


function getImageBuffer(i, length) {
  /* jshint bitwise:false */
  length = length || 1024;
  var name = new Buffer(' ' + IMAGES[i].NAME, 'ascii');
  name[0] = name.length - 1;
  var bdata = IMAGES[i].BDATA;
  var chunkLength = Math.min(length, bdata.length);
  var chunk = bdata.slice(0, chunkLength);
  var buffer = new Buffer(32);
  buffer[0] = LobSourceType.BLOB;
  if (chunk.length === bdata.length) {
    buffer[1] = LobOptions.DATA_INCLUDED | LobOptions.LAST_DATA;
  } else {
    buffer[1] = LobOptions.DATA_INCLUDED;
  }
  buffer.fill(0, 2, 4);
  bignum.writeUInt64LE(buffer, bdata.length, 4);
  bignum.writeUInt64LE(buffer, bdata.length, 12);
  bignum.writeUInt64LE(buffer, i, 20);
  buffer.writeUInt32LE(chunkLength, 28);
  return Buffer.concat([name, buffer, chunk], name.length + 32 + chunkLength);
}