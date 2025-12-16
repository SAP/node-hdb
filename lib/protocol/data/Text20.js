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

exports.read = read;
exports.write = write;
exports.getByteLength = getByteLength;
exports.getArgumentCount = getArgumentCount;

function read(part) {
  return util.convert.decode(part.buffer.slice(1), part.useCesu8);
}

function write(part, value) {
  /* jshint validthis:true */

  value = value || this;
  part = part || {};
  part.argumentCount = getArgumentCount(value);
  part.buffer = util.convert.encode(' ' + value, part.useCesu8);
  return part;
}

function getByteLength(value) {
  return Buffer.byteLength(value) + 1;
}

function getArgumentCount(value) {
  /* jshint unused:false */
  return 1;
}