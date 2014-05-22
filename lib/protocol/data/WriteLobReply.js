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

exports.read = read;
exports.getArgumentCount = getArgumentCount;

function read(part) {
  var offset = 0;
  var buffer = part.buffer;
  var args = [];
  for (var i = 0; i < part.argumentCount; i++) {
    args.push(buffer.slice(offset, offset + 8));
    offset += 8;
  }
  return args;
}

function getArgumentCount(args) {
  return args.length;
}