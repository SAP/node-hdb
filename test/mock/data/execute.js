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

exports['0100000000000000'] = {
  '1d05257465656e': {
    kind: SegmentKind.REPLY,
    functionCode: FunctionCode.SELECT,
    parts: [{
      kind: PartKind.RESULT_SET_ID,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        '0100000001000000', 'hex')
    }, {
      kind: PartKind.RESULT_SET,
      argumentCount: 7,
      attributes: 17,
      buffer: new Buffer(
        '010d00000008746869727465656e010e00000008666f75727465656e010f0000' +
        '00076669667465656e0110000000077369787465656e01110000000973657665' +
        '6e7465656e011200000008656967687465656e0113000000086e696e65746565' +
        '6e', 'hex')
    }]
  },
  '1d04256f6e65': {
    kind: SegmentKind.REPLY,
    functionCode: FunctionCode.SELECT,
    parts: [{
      kind: PartKind.RESULT_SET_ID,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        '0100000002000000', 'hex')
    }, {
      kind: PartKind.RESULT_SET,
      argumentCount: 9,
      attributes: 17,
      buffer: new Buffer(
        '0101000000036f6e6501150000000a7477656e74792d6f6e65011f0000000a74' +
        '68697274792d6f6e6501290000000a666f757274792d6f6e6501330000000966' +
        '696674792d6f6e65013d0000000973697874792d6f6e6501470000000b736576' +
        '656e74792d6f6e6501510000000a6569676874792d6f6e65015b0000000a6e69' +
        '6e6574792d6f6e65', 'hex')
    }]
  }
};

exports['0200000000000000'] = {
  '03030000000305000000': {
    kind: SegmentKind.REPLY,
    functionCode: FunctionCode.DB_PROCEDURE_CALL_WITH_RESULT,
    parts: [{
      kind: PartKind.RESULT_SET_METADATA,
      argumentCount: 2,
      attributes: 0,
      buffer: new Buffer(
        '020300000a00000000000000ffffffff26000000260000000209000011000000' +
        '28000000ffffffff4e0000004e000000254e554d535f35323732463941423846' +
        '464336314532453130303030303030413434323139430141254e554d535f3532' +
        '3732463941423846464336314532453130303030303030413434323139430142',
        'hex')
    }, {
      kind: PartKind.RESULT_SET_ID,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        '0200000001000000', 'hex')
    }, {
      kind: PartKind.RESULT_SET,
      argumentCount: 3,
      attributes: 17,
      buffer: new Buffer(
        '0103000000057468726565010400000004666f757201050000000466697665',
        'hex')
    }]
  },
  '03080000000307000000': {
    kind: SegmentKind.REPLY,
    functionCode: FunctionCode.DB_PROCEDURE_CALL_WITH_RESULT,
    parts: [{
      kind: PartKind.RESULT_SET_METADATA,
      argumentCount: 2,
      attributes: 0,
      buffer: new Buffer(
        '020300000a00000000000000ffffffff26000000260000000209000011000000' +
        '28000000ffffffff4e0000004e000000254e554d535f35323732463941433846' +
        '464336314532453130303030303030413434323139430141254e554d535f3532' +
        '3732463941433846464336314532453130303030303030413434323139430142',
        'hex')
    }, {
      kind: PartKind.RESULT_SET_ID,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        '0200000002000000', 'hex')
    }, {
      kind: PartKind.RESULT_SET,
      argumentCount: 0,
      attributes: 25,
      buffer: new Buffer(0)
    }]
  }
};

exports['0300000000000000'] = {
  'logo.1.png': {
    kind: SegmentKind.REPLY,
    functionCode: FunctionCode.INSERT,
    parts: [{
      kind: PartKind.ROWS_AFFECTED,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        '01000000', 'hex')
    }, {
      kind: PartKind.TRANSACTION_FLAGS,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        '011c01', 'hex')
    }]
  },
  'sap.2.jpg': {
    kind: SegmentKind.REPLY,
    functionCode: FunctionCode.INSERT,
    parts: [{
      kind: PartKind.ROWS_AFFECTED,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        '01000000', 'hex')
    }, {
      kind: PartKind.WRITE_LOB_REPLY,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        '0300000000000000', 'hex')
    }, {
      kind: PartKind.TRANSACTION_FLAGS,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        '041c01', 'hex')
    }]
  },
  'lobby.3.jpg': {
    kind: SegmentKind.REPLY,
    functionCode: FunctionCode.INSERT,
    parts: [{
      kind: PartKind.ROWS_AFFECTED,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        '01000000', 'hex')
    }, {
      kind: PartKind.WRITE_LOB_REPLY,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        '0300000000000000', 'hex')
    }, {
      kind: PartKind.TRANSACTION_FLAGS,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        '041c01', 'hex')
    }]
  },
  'locked.3.png': {
    kind: SegmentKind.REPLY,
    functionCode: FunctionCode.INSERT,
    parts: [{
      kind: PartKind.ROWS_AFFECTED,
      argumentCount: 3,
      attributes: 0,
      buffer: new Buffer(
        '010000000100000001000000', 'hex')
    }, {
      kind: PartKind.WRITE_LOB_REPLY,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        '0300000000000000', 'hex')
    }]
  }
};

exports['0700000000000000'] = {
  '1d0158': {
    kind: SegmentKind.REPLY,
    functionCode: FunctionCode.SELECT,
    parts: [{
      kind: PartKind.RESULT_SET_ID,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer(
        '0700000001000000', 'hex')
    }, {
      kind: PartKind.RESULT_SET,
      argumentCount: 1,
      attributes: 17,
      buffer: new Buffer(
        '0158', 'hex')
    }]
  }
};

exports['e5b25188195d0500'] = {
  '1e06eda0bcedbda81e06eda0bcedbda9': {
    kind: SegmentKind.REPLY,
    functionCode: FunctionCode.DB_PROCEDURE_CALL_WITH_RESULT,
    parts: [
      {
        kind: PartKind.ROWS_AFFECTED,
        argumentCount: 1,
        attributes: 0,
        buffer: new Buffer(
          '00000000', 'hex')
      },
      {
        kind: PartKind.TRANSACTION_FLAGS,
        argumentCount: 2,
        attributes: 0,
        buffer: new Buffer(
          '071c00041c01', 'hex')
      },
      {
        kind: PartKind.STATEMENT_CONTEXT,
        argumentCount: 2,
        attributes: 0,
        buffer: new Buffer(
          '012144000200000064656366070000000000000000002f646563666c8dd58300' +
          '00000000e91600000000000000000000000000000000000000000000ffffffff' +
          '000000000000000002047510000000000000', 'hex')
      },
      {
        kind: PartKind.OUTPUT_PARAMETERS,
        argumentCount: 1,
        attributes: 0,
        buffer: new Buffer(
          '0ceda0bcedbda8eda0bcedbda9', 'hex')
      },
      {
        kind: PartKind.RESULT_SET_METADATA,
        argumentCount: 2,
        attributes: 0,
        buffer: new Buffer(
          '020b00000a00000000000000ffffffff3d0000003d000000020b000032000000' +
          '40000000ffffffff7d0000007d0000003c5f5359535f5353325f544d505f5441' +
          '424c455f3136313032305f455f35383532464338323830323233423141453230' +
          '304639433746383231453034430249443c5f5359535f5353325f544d505f5441' +
          '424c455f3136313032305f455f35383532464338323830323233423141453230' +
          '3046394337463832314530344303434154', 'hex')
      },
      {
        kind: PartKind.RESULT_SET_ID,
        argumentCount: 1,
        attributes: 0,
        buffer: new Buffer(
          '5f09f99527580500', 'hex')
      },
      {
        kind: PartKind.STATEMENT_CONTEXT,
        argumentCount: 2,
        attributes: 0,
        buffer: new Buffer(
          '012144000200000064656366070000000000000000002f646563666c8dd58300' +
          '00000000e91600000000000000000000000000000000000000000000ffffffff' +
          '00000000000000000204ba11000000000000', 'hex')
      },
      {
        kind: PartKind.RESULT_SET,
        argumentCount: 1,
        attributes: 17,
        buffer: new Buffer(
          '06eda0bcedbda80ceda0bcedbda8eda0bcedbda9', 'hex')
      }
    ]
  }
};
