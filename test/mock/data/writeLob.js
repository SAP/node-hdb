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

exports['0300000000000000'] = {
  2: {
    kind: SegmentKind.REPLY,
    functionCode: FunctionCode.WRITE_LOB,
    parts: [{
      kind: PartKind.WRITE_LOB_REPLY,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer('0300000000000000', 'hex')
    }]
  },
  6: {
    kind: SegmentKind.REPLY,
    functionCode: FunctionCode.WRITE_LOB,
    parts: [{
      kind: PartKind.WRITE_LOB_REPLY,
      argumentCount: 0,
      attributes: 0,
      buffer: new Buffer(0)
    }]
  }
};