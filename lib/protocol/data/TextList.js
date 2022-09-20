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

exports.write = write;
exports.getByteLength = getByteLength;
exports.getArgumentCount = getArgumentCount;

function write(part, fields) {
  /* jshint validthis:true */
  var offset = 0;
  part = part || {};
  fields = fields || this;

  var byteLength = getByteLength(fields, part.useCesu8);
  var buffer = new Buffer(byteLength);

  var field, fieldLength, data;
  for (var i = 0; i < fields.length; i++) {
    field = fields[i];
    data = util.convert.encode(field, part.useCesu8);

    fieldLength = data.length;
    if (fieldLength <= common.DATA_LENGTH_MAX1BYTE_LENGTH) {
      buffer[offset] = fieldLength;
      offset += 1;
    } else {
      buffer[offset] = common.DATA_LENGTH_2BYTE_LENGTH_INDICATOR;
      offset += 1;
      buffer.writeUInt16LE(fieldLength, offset);
      offset += 2;
    }

    data.copy(buffer, offset);
    offset += fieldLength;
  }
  part.argumentCount = getArgumentCount(fields);
  part.buffer = buffer;
  return part;
}

function getByteLength(fields, useCesu8) {
  var byteLength = 0;
  var fieldLength;
  for (var i = 0; i < fields.length; i++) {
    fieldLength = getByteLengthOfField(fields[i], useCesu8);
    if (fieldLength <= common.DATA_LENGTH_MAX1BYTE_LENGTH) {
      byteLength += fieldLength + 1;
    } else {
      byteLength += fieldLength + 3;
    }
  }
  return byteLength;
}

function getArgumentCount(fields) {
  /* jshint unused:false */
  return fields.length;
}

function getByteLengthOfField(field, useCesu8) {
  if (useCesu8) {
    return util.convert.encode(field, useCesu8).length;
  }
  return Buffer.byteLength(field);
}


