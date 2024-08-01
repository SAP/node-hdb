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
var Part = require('./Part');
var data = require('../data');
var common = require('../common');
var FunctionCode = common.FunctionCode;
var SegmentKind = common.SegmentKind;
var PartKindName = common.PartKindName;
var PACKET_HEADER_LENGTH = common.PACKET_HEADER_LENGTH;
var DEFAULT_SEGMENT_SIZE = common.DEFAULT_PACKET_SIZE - PACKET_HEADER_LENGTH;
var SEGMENT_HEADER_LENGTH = common.SEGMENT_HEADER_LENGTH;

module.exports = Segment;

function Segment(kind, functionCode) {
  this.kind = kind || SegmentKind.INVALID;
  this.functionCode = functionCode || FunctionCode.NIL;
  this.parts = [];
}

Segment.prototype.push = function push(part) {
  this.parts.push(part);
};

Segment.prototype.inspect = function inpsect() {
  function inspectPart(part) {
    return part.inspect({
      indentOffset: 4
    });
  }

  var kindName = common.SegmentKindName[this.kind];
  var fcodeName = common.FunctionCodeName[this.functionCode];
  var lines = [];
  lines.push('{\n');
  lines.push('  kind: SegmentKind.' + kindName + ',\n');
  lines.push('  functionCode: FunctionCode.' + fcodeName + ',\n');
  lines.push('  parts: [\n');
  lines.push(this.parts.map(inspectPart).join(',\n') + '\n');
  lines.push('  ]\n');
  lines.push('}\n');
  return lines.join('');
};
Segment.create = createSegment;

function createSegment(buffer, offset) {
  var segment = new Segment();
  readSegment.call(segment, buffer, offset);
  return segment;
}

Segment.read = readSegment;

function readSegment(buffer, offset) {
  /* jshint validthis:true */
  offset = offset || 0;

  var numberOfParts = buffer.readInt16LE(offset + 8);
  this.kind = buffer.readInt8(offset + 12);
  this.functionCode = buffer.readInt16LE(offset + 14);
  offset += SEGMENT_HEADER_LENGTH;
  for (var i = 0; i < numberOfParts; i++) {
    var part = new Part();
    offset = Part.read.call(part, buffer, offset);
    this.push(part);
  }
  return offset;
}

Segment.prototype.toBuffer = function toBuffer(size) {
  size = size || DEFAULT_SEGMENT_SIZE;
  var remainingSize = size - SEGMENT_HEADER_LENGTH;
  var length = SEGMENT_HEADER_LENGTH;
  var buffers = this.parts.map(function getPartBuffer(part) {
    var buffer = part.toBuffer(remainingSize);
    remainingSize -= buffer.length;
    length += buffer.length;
    return buffer;
  });

  var header = new Buffer(SEGMENT_HEADER_LENGTH);

  // Length of the segment, including the header
  header.writeInt32LE(length, 0);
  // Offset of the segment within the message buffer
  header.writeInt32LE(0, 4);
  // Number of contained parts
  header.writeInt16LE(this.parts.length, 8);
  // Number of segment within packet
  header.writeInt16LE(1, 10);
  // Segment kind
  header.writeInt8(this.kind, 12);
  // Filler
  header[13] = 0x00;
  // Function code
  header.writeInt16LE(this.functionCode, 14);
  // Filler
  header.fill(0x00, 16);

  buffers.unshift(header);
  return Buffer.concat(buffers, length);
};

Segment.prototype.getPart = function (kind) {
  var parts = this.parts.filter(function isKindOf(part) {
    return part.kind === kind;
  });
  if (parts.length === 1) {
    return parts[0];
  } else if (parts.length > 1) {
    return parts;
  }
  return null;
};

Segment.prototype.getReply = function getReply() {
  var reply = new Reply(this.kind, this.functionCode);
  for (var i = 0; i < this.parts.length; i++) {
    reply.add(this.parts[i]);
  }
  return reply;
};

function Reply(kind, functionCode) {
  this.kind = kind;
  this.functionCode = functionCode;
  this.resultSets = [];
}

Reply.prototype.addResultSetFragment = function addResultSetFragment(name,
  value) {
  var resultSet;
  if (this.resultSets.length) {
    resultSet = this.resultSets[this.resultSets.length - 1];
  }
  if (name === 'resultSet') {
    name = 'data';
  } else if (name === 'resultSetId') {
    name = 'id';
  } else if (name === 'resultSetMetadata') {
    name = 'metadata';
  }
  if (!resultSet || resultSet[name]) {
    resultSet = {};
    resultSet[name] = value;
    this.resultSets.push(resultSet);
  } else {
    resultSet[name] = value;
  }
};

Reply.prototype.add = function add(part) {
  var name = util._2cc(PartKindName[part.kind]);
  var value = data[part.kind].read(part);
  if (/^resultSet/.test(name) || name === 'tableName') {
    this.addResultSetFragment(name, value);
  } else if (util.isUndefined(this[name])) {
    this[name] = value;
  } else if (Array.isArray(this[name])) {
    this[name].push(value);
  } else {
    var existingValue = this[name];
    this[name] = [existingValue, value];
  }
};