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


var lib = require('../lib/hdb').lib;
var bignum = lib.util.bignum;
var common = lib.common;
var SegmentKind = common.SegmentKind;
var FunctionCode = common.FunctionCode;
var PartKind = common.PartKind;
var LobOptions = common.LobOptions;

var IMAGES = require('./images');

exports.read = function read(req) {
  var i = bignum.readUInt64LE(req.locatorId, 0);
  return {
    kind: SegmentKind.REPLY,
    functionCode: FunctionCode.READ_LOB,
    parts: [{
      kind: PartKind.READ_LOB_REPLY,
      argumentCount: 1,
      attributes: 0,
      buffer: getImageBuffer(i, req.offset, req.length)
    }]
  };
};

function getImageBuffer(i, offset, length) {
  /* jshint bitwise:false, unused:false */
  offset = offset || 1025;
  offset -= 1;
  var bdata = IMAGES[i].BDATA;
  var chunk = bdata.slice(offset);
  var chunkLength = chunk.length;
  var buffer = new Buffer(16);
  bignum.writeUInt64LE(buffer, i, 0);
  buffer[8] = LobOptions.DATA_INCLUDED | LobOptions.LAST_DATA;
  buffer.writeUInt32LE(chunkLength, 9);
  buffer.fill(0, 13, 16);
  return Buffer.concat([buffer, chunk], chunkLength + 16);
}