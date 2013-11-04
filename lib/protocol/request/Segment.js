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

var MAX_PACKET_SIZE = common.MAX_PACKET_SIZE;
var PACKET_HEADER_LENGTH = common.PACKET_HEADER_LENGTH;
var SEGMENT_HEADER_LENGTH = common.SEGMENT_HEADER_LENGTH;

module.exports = Segment;

function Segment(type, options) {
  options = options || {};
  this.type = type || MessageType.NIL;
  this.commitImmediateley = !! options.commitImmediateley ? 1 : 0;
  this.commandOptions = options.commandOptions || 0;
  this.parts = [];
}

Segment.prototype.addPart = function addPart(part) {
  this.parts.push(part);
  return part;
};

Segment.prototype.add = function add(kind, options) {
  if (options) {
    var dataModule;
    if (util.isNumber(kind)) {
      dataModule = data[kind];
    } else {
      dataModule = kind.module;
      kind = kind.kind;
    }
    var part = new Part({
      kind: kind
    });
    part.argumentCount = dataModule.getArgumentCount(options);
    dataModule.write(part, options);
    this.parts.push(part);
  }
};

Segment.prototype.toBuffer = function toBuffer(size) {
  size = size || (MAX_PACKET_SIZE - PACKET_HEADER_LENGTH);
  var remainingSize = size - SEGMENT_HEADER_LENGTH;
  var length = SEGMENT_HEADER_LENGTH;
  var buffers = this.parts.map(function (part) {
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