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

var util = require('../util');
var common = require('./common');
var bignum = util.bignum;
var PACKET_HEADER_LENGTH = common.PACKET_HEADER_LENGTH;

module.exports = MessageBuffer;

function MessageBuffer() {
  this.length = 0;
  this.header = undefined;
  this.data = undefined;
}

MessageBuffer.prototype.isReady = function () {
  return this.header && this.length >= this.header.length;
};

MessageBuffer.prototype.push = function push(chunk) {
  if (!chunk || !chunk.length) {
    return;
  }
  this.length += chunk.length;
  if (!this.data) {
    this.data = chunk;
  } else if (Buffer.isBuffer(this.data)) {
    this.data = [this.data, chunk];
  } else {
    this.data.push(chunk);
  }
  if (!this.header && this.length >= PACKET_HEADER_LENGTH) {
    this.readHeader();
  }
};

MessageBuffer.prototype.getData = function getData() {
  if (util.isArray(this.data)) {
    return Buffer.concat(this.data, this.length);
  }
  return this.data;
};

MessageBuffer.prototype.readHeader = function readHeader() {
  var buffer = this.getData();
  this.header = {
    sessionId: bignum.readUInt64LE(buffer, 0),
    packetCount: buffer.readUInt32LE(8),
    length: buffer.readUInt32LE(12)
  };
  this.data = buffer.slice(PACKET_HEADER_LENGTH);
  this.length -= PACKET_HEADER_LENGTH;
};

MessageBuffer.prototype.clear = function clear() {
  this.length = 0;
  this.header = undefined;
  this.data = undefined;
};