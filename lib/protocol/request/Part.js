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

var util = require('../../util');
var PartKind = require('../common/PartKind');

var PART_HEADER_LENGTH = 16;

module.exports = Part;

function Part(options) {
  this.kind = options.kind || PartKind.NIL;
  this.attributes = options.attributes || 0;
  this.argumentCount = options.argumentCount || 0;
  this.useCesu8 = options.useCesu8;
  this.buffer = undefined;
}


Part.prototype.toBuffer = function toBuffer(size) {
  var byteLength = util.alignLength(this.buffer.length, 8);
  var buffer = new Buffer(PART_HEADER_LENGTH + byteLength);
  // Part kind, specifies nature of part data
  buffer.writeInt8(this.kind, 0);
  // Further attributes of part
  buffer.writeInt8(this.attributes, 1);
  // Argument count, number of elements in part data.
  buffer.writeInt16LE(this.argumentCount, 2);
  // Argument count, number of elements in part data (only for some part kinds).
  buffer.writeInt32LE(0, 4);
  // Length of part buffer in bytes
  buffer.writeInt32LE(this.buffer.length, 8);
  // Length in packet remaining without this part.
  buffer.writeInt32LE(size, 12);
  this.buffer.copy(buffer, PART_HEADER_LENGTH);
  if (this.buffer.length < byteLength) {
    buffer.fill(0x00, PART_HEADER_LENGTH + this.buffer.length);
  }
  return buffer;
};