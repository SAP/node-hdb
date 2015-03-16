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

exports.write = write;
exports.getByteLength = getByteLength;
exports.getArgumentCount = getArgumentCount;

function write(part, value) {
  /* jshint validthis:true */

  value = value || this;
  part = part || {};
  if (Array.isArray(value)) {
    part.argumentCount = value.length;
    part.buffer = Buffer.concat(value);
    return part;
  }
  part.argumentCount = 1;
  part.buffer = value;
  return part;
}

function getByteLength(value) {
  if (Array.isArray(value)) {
    var byteLength = 0;
    for (var i = 0; i < value.length; i++) {
      byteLength += value[i].length;
    }
    return byteLength;
  }
  return value.length;
}

function getArgumentCount(value) {
  /* jshint unused:false */
  if (Array.isArray(value)) {
    return value.length;
  }
  return 1;
}