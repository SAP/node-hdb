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

exports.NOT_CONNECTED = {
  kind: SegmentKind.REPLY,
  functionCode: FunctionCode.NIL,
  parts: [
    {
      kind: PartKind.DB_CONNECT_INFO,
      argumentCount: 3,
      attributes: 0,
      buffer: new Buffer('041c00021d0c0031322e33342e35362e3132330303a8790000', 'hex')
    }
  ]
};

exports.CONNECTED = {
  kind: SegmentKind.REPLY,
  functionCode: FunctionCode.NIL,
  parts: [
    {
      kind: PartKind.DB_CONNECT_INFO,
      argumentCount: 1,
      attributes: 0,
      buffer: new Buffer('041c01', 'hex')
    }
  ]
};