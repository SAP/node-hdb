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
var data = require('../data');
var common = require('../common');
var Part = require('./Part');
var MessageType = common.MessageType;
var SegmentKind = common.SegmentKind;

var MAX_SEGMENT_SIZE = common.MAX_PACKET_SIZE - common.PACKET_HEADER_LENGTH;
var SEGMENT_HEADER_LENGTH = common.SEGMENT_HEADER_LENGTH;

module.exports = Segment;

function Segment(type, commitImmediateley, commandOptions, useCesu8) {
  this.type = type || MessageType.NIL;
  this.commitImmediateley = !!commitImmediateley ? 1 : 0;
  this.commandOptions = commandOptions || 0;
  this.parts = [];
  this.useCesu8 = (useCesu8 === true);
}

Segment.prototype.addPart = function addPart(part) {
  this.parts.push(part);
  return part;
};

Segment.prototype.push = function push(kind, args) {
  this.parts.push({
    kind: kind,
    args: args
  });
};

Segment.prototype.unshift = function unshift(kind, args) {
  this.parts.unshift({
    kind: kind,
    args: args
  });
};

Segment.prototype.add = function add(kind, args) {
  if (!args) {
    return;
  }
  if (util.isNumber(kind)) {
    this.parts.push({
      kind: kind,
      args: args
    });
    return;
  }
  if (util.isObject(kind)) {
    this.parts.push({
      kind: kind.kind,
      module: kind.module,
      args: args
    });
  }
};

Segment.prototype.toBuffer = function toBuffer(size) {
  size = size || MAX_SEGMENT_SIZE;
  var remainingSize = size - SEGMENT_HEADER_LENGTH;
  var length = SEGMENT_HEADER_LENGTH;
  var buffers = [];
  for (var i = 0; i < this.parts.length; i++) {
    var buffer = partToBuffer(this.parts[i], remainingSize, this.useCesu8);
    remainingSize -= buffer.length;
    length += buffer.length;
    buffers.push(buffer);
  }

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
  header.writeInt8(SegmentKind.REQUEST, 12);
  // Message type
  header.writeInt8(this.type, 13);
  // Whether the command shall be committed
  header.writeInt8(this.commitImmediateley, 14);
  // Command options
  header.writeInt8(this.commandOptions, 15);
  // Filler
  header.fill(0x00, 16, SEGMENT_HEADER_LENGTH);

  buffers.unshift(header);
  return Buffer.concat(buffers, length);
};

function partToBuffer(pd, remainingSize, useCesu8) {
  var m = pd.module || data[pd.kind];
  var part = new Part({
    kind: pd.kind,
    useCesu8: useCesu8
  });
  part.argumentCount = m.getArgumentCount(pd.args);
  m.write(part, pd.args, remainingSize);
  return part.toBuffer(remainingSize);
}
