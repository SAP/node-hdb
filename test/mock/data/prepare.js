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
var SegmentKind = lib.common.SegmentKind;
var FunctionCode = lib.common.FunctionCode;
var PartKind = lib.common.PartKind;

exports['select * from numbers where b like ? order by a'] = {
  kind: SegmentKind.REPLY,
  functionCode: FunctionCode.SELECT,
  parts: [{
    kind: PartKind.STATEMENT_ID,
    argumentCount: 1,
    attributes: 0,
    buffer: new Buffer(
      '0100000000000000', 'hex')
  }, {
    kind: PartKind.RESULT_SET_METADATA,
    argumentCount: 2,
    attributes: 0,
    buffer: new Buffer(
      '020300000a00000000000000ffffffff08000000080000000109000010000000' +
      '0a000000ffffffff1200000012000000074e554d424552530141074e554d4245' +
      '52530142', 'hex')
  }, {
    kind: PartKind.PARAMETER_METADATA,
    argumentCount: 1,
    attributes: 0,
    buffer: new Buffer(
      '02090100ffffffff1000000000000000', 'hex')
  }]
};

exports['call read_numbers_between (?, ?, ?)'] = {
  kind: SegmentKind.REPLY,
  functionCode: FunctionCode.DB_PROCEDURE_CALL,
  parts: [{
    kind: PartKind.STATEMENT_ID,
    argumentCount: 1,
    attributes: 0,
    buffer: new Buffer(
      '0200000000000000', 'hex')
  }, {
    kind: PartKind.PARAMETER_METADATA,
    argumentCount: 2,
    attributes: 0,
    buffer: new Buffer(
      '02030100000000000a0000000200ffff02030100020000000a0000000200ffff' +
      '01410142', 'hex')
  }]
};

exports['insert into images values (?, ?)'] = {
  kind: SegmentKind.REPLY,
  functionCode: FunctionCode.INSERT,
  parts: [{
    kind: PartKind.STATEMENT_ID,
    argumentCount: 1,
    attributes: 0,
    buffer: new Buffer(
      '0300000000000000', 'hex')
  }, {
    kind: PartKind.PARAMETER_METADATA,
    argumentCount: 2,
    attributes: 0,
    buffer: new Buffer(
      '02090100ffffffff1000000018000000021b0100ffffffff1000000008000000',
      'hex')
  }]
};

exports['insert into numbers values (?, ?)'] = {
  kind: SegmentKind.REPLY,
  functionCode: FunctionCode.INSERT,
  parts: [{
    kind: PartKind.STATEMENT_ID,
    argumentCount: 1,
    attributes: 0,
    buffer: new Buffer(
      '0400000000000000', 'hex')
  }, {
    kind: PartKind.PARAMETER_METADATA,
    argumentCount: 2,
    attributes: 0,
    buffer: new Buffer(
      '02030100ffffffff0a0000000100000002090100ffffffff1000000008000000',
      'hex')
  }]
};

exports['select * from dummy where dummy = ?'] = {
  kind: SegmentKind.REPLY,
  functionCode: FunctionCode.SELECT,
  parts: [{
    kind: PartKind.STATEMENT_ID,
    argumentCount: 1,
    attributes: 0,
    buffer: new Buffer(
      '0700000000000000', 'hex')
  }, {
    kind: PartKind.RESULT_SET_METADATA,
    argumentCount: 1,
    attributes: 0,
    buffer: new Buffer(
      '020800000100000000000000ffffffff06000000060000000544554d4d590544' +
      '554d4d59', 'hex')
  }, {
    kind: PartKind.PARAMETER_METADATA,
    argumentCount: 1,
    attributes: 0,
    buffer: new Buffer(
      '02090100ffffffff1000000008000000', 'hex')
  }]
};

exports['call concat_strings_proc (?, ?, ?, ?)'] = {
  kind: SegmentKind.REPLY,
  functionCode: FunctionCode.DB_PROCEDURE_CALL,
  parts: [
    {
      kind: PartKind.STATEMENT_CONTEXT,
      argumentCount: 2,
      attributes: 0,
      buffer: new Buffer(
        '012144000100000020292029010000000000000000001b1cea7f0000994e8400' +
        '00000000e91600000000000000000000000000000000000000000000ffffffff' +
        '00000000000000000204bb02000000000000', 'hex')
    },
    {
      kind: PartKind.STATEMENT_ID,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        'e5b25188195d0500', 'hex')
    },
    {
      kind: PartKind.PARAMETER_METADATA,
      argumentCount: 3,
      attributes: 0,
      buffer: new Buffer(
        '020b0100000000000a00000000000000020b0100020000000a00000000000000' +
        '020b0400040000003200000000000000014101420143', 'hex')
    }
  ]
};
