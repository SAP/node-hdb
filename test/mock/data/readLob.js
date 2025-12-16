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
var IMAGES = require('../../fixtures/images');
var bignum = lib.util.bignum;
var SegmentKind = lib.common.SegmentKind;
var FunctionCode = lib.common.FunctionCode;
var PartKind = lib.common.PartKind;
var LobOptions = lib.common.LobOptions;

exports.read = function read(req) {
  var id = bignum.readUInt64LE(req.locatorId, 0);
  return {
    kind: SegmentKind.REPLY,
    functionCode: FunctionCode.READ_LOB,
    parts: [{
      kind: PartKind.READ_LOB_REPLY,
      argumentCount: 1,
      attributes: 0,
      buffer: getBuffer(id, req.offset, req.length)
    }]
  };
};

function getBuffer(id, offset, length) {
  /* jshint bitwise:false, unused:false */
  offset = offset || 1025;
  var bdata = IMAGES[id].BDATA;
  var buffer = new Buffer(16);
  bignum.writeUInt64LE(buffer, id, 0);
  var start = offset - 1;
  var end = start + length;
  if (end < bdata.length) {
    buffer[8] = LobOptions.DATA_INCLUDED;
  } else {
    buffer[8] = LobOptions.DATA_INCLUDED | LobOptions.LAST_DATA;
    end = bdata.length;
  }
  var chunk = bdata.slice(start, end);
  buffer.writeUInt32LE(chunk.length, 9);
  buffer.fill(0x00, 13);
  return Buffer.concat([buffer, chunk], buffer.length + chunk.length);
}