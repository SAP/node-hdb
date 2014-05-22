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

var common = require('../common');
var LobOptions = common.LobOptions;

exports.read = read;
exports.getByteLength = getByteLength;
exports.getArgumentCount = getArgumentCount;

function read(part) {
  var offset = 0;
  var buffer = part.buffer;

  var locatorId = buffer.slice(offset, offset + 8);
  offset += 8;
  var options = buffer[offset];
  offset += 1;
  var length = buffer.readInt32LE(offset);
  offset = 16;
  var chunk = buffer.slice(offset, offset + length);
  offset += length;
  return new ReadLobReply(locatorId, options, chunk);
}

function getByteLength(chunk) {
  return 16 + chunk.length;
}

function getArgumentCount(value) {
  /* jshint unused:false */
  return 1;
}

function ReadLobReply(locatorId, options, chunk) {
  this.locatorId = locatorId;
  this.options = options;
  this.chunk = chunk;
}

Object.defineProperties(ReadLobReply.prototype, {
  isNull: {
    get: function isNull() {
      /* jshint bitwise:false */
      return !!(this.options & LobOptions.NULL_INDICATOR);
    }
  },
  isDataIncluded: {
    get: function isDataIncluded() {
      /* jshint bitwise:false */
      return !!(this.options & LobOptions.DATA_INCLUDED);
    }
  },
  isLast: {
    get: function isLast() {
      /* jshint bitwise:false */
      return !!(this.options & LobOptions.LAST_DATA);
    }
  }
});