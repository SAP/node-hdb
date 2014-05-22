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

var opts = require('./Options');
var getByteLengthOfOptions = opts.getByteLength;
var writeOptions = opts.write;
var readOptions = opts._read;

exports.read = read;
exports.write = write;
exports.getByteLength = getByteLength;
exports.getArgumentCount = getArgumentCount;

function read(part) {
  var offset = 0;
  var buffer = part.buffer;
  var lines = [];
  var numberOfOptions, options;
  for (var i = 0; i < part.argumentCount; i++) {
    numberOfOptions = buffer.readInt16LE(offset);
    offset += 2;
    options = new Array(numberOfOptions);
    offset = readOptions.call(options, buffer, offset);
    lines.push(options);
  }
  return lines;
}

function write(part, lines) {
  /* jshint validthis:true */

  var offset = 0;
  lines = lines || this;
  part = part || {};
  var byteLength = getByteLength(lines);
  var buffer = new Buffer(byteLength);
  var options;
  for (var i = 0; i < lines.length; i++) {
    options = writeOptions({}, lines[i]);
    buffer.writeInt16LE(options.argumentCount, offset);
    offset += 2;
    options.buffer.copy(buffer, offset);
    offset += options.buffer.length;
  }
  part.argumentCount = getArgumentCount(lines);
  part.buffer = buffer;
  return part;
}

function getByteLength(lines) {
  var byteLength = 0;

  for (var i = 0; i < lines.length; i++) {
    byteLength += 2 + getByteLengthOfOptions(lines[i]);
  }
  return byteLength;
}

function getArgumentCount(lines) {
  /* jshint unused:false */
  return lines.length;
}