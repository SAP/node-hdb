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

function Part(kind, attributes, argumentCount, buffer, encoding) {
  this.kind = kind || PartKind.NIL;
  this.attributes = attributes || 0;
  this.argumentCount = argumentCount || 0;
  if (util.isString(buffer)) {
    this.buffer = new Buffer(buffer, encoding || 'hex');
  } else {
    this.buffer = buffer;
  }
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

Part.create = createPart;
Part.read = readPart;

function createPart(buffer, offset) {
  var part = new Part();
  readPart.call(part, buffer, offset);
  return part;
}

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

Part.prototype.inspect = function inspect(options) {
  var lines = [];
  options = options || {};
  var offset = new Buffer(options.indentOffset || 0);
  offset.fill(0x20);
  offset = offset.toString('ascii');
  var kindName = common.PartKindName[this.kind];
  lines.push(offset + '{\n');
  lines.push(offset + '  kind: PartKind.' + kindName + ',\n');
  lines.push(offset + '  argumentCount: ' + this.argumentCount + ',\n');
  lines.push(offset + '  attributes: ' + this.attributes + ',\n');
  if (Buffer.isBuffer(this.buffer)) {
    var length = this.buffer.length;
    var start, end, chunk;
    start = 0;
    var hexstr = [];
    while (start < length) {
      end = start + 32 > length ? length : start + 32;
      chunk = this.buffer.toString('hex', start, end);
      hexstr.push(offset + '    \'' + chunk + '\'');
      start = end;
    }
    lines.push(offset + '  buffer: new Buffer(\n');
    lines.push(hexstr.join(' +\n') + ', \'hex\')\n');
  } else {
    lines.push(offset + '  buffer: null\n');
  }
  lines.push(offset + '}');
  return lines.join('');
};