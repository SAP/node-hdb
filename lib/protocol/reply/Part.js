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
var common = require('../common');
var PartKind = common.PartKind;

var PART_HEADER_LENGTH = common.PART_HEADER_LENGTH;
var BIG_ARGUMENT_COUNT_INDICATOR = -1;

module.exports = Part;

function Part(kind, attributes, argumentCount) {
  this.kind = kind || PartKind.NIL;
  this.attributes = attributes || 0;
  this.argumentCount = argumentCount || 0;
  this.buffer = undefined;
}

Object.defineProperty(Part.prototype, 'byteLength', {
  get: function getByteLength() {
    var byteLength = PART_HEADER_LENGTH;
    if (Buffer.isBuffer(this.buffer)) {
      byteLength += util.alignLength(this.buffer.length, 8);
    }
    return byteLength;
  }
});

Part.createPart = createPart;

function createPart(buffer, offset) {
  var part = new Part();
  readPart.call(part, buffer, offset);
  return part;
}

Part.read = readPart;

function readPart(buffer, offset) {
  /* jshint validthis:true */
  offset = offset || 0;

  this.kind = buffer[offset];
  this.attributes = buffer[offset + 1];
  this.argumentCount = buffer.readInt16LE(offset + 2);
  if (this.argumentCount === BIG_ARGUMENT_COUNT_INDICATOR) {
    this.argumentCount = buffer.readInt32LE(offset + 4);
  }
  var length = buffer.readInt32LE(offset + 8);
  offset += PART_HEADER_LENGTH;
  if (length > 0) {
    this.buffer = new Buffer(length);
    buffer.copy(this.buffer, 0, offset, offset + length);
    offset += util.alignLength(length, 8);
  }
  return offset;
}