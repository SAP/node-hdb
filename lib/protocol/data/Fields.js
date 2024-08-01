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

const common = require('../../protocol/common');

exports.read = read;
exports.write = write;
exports.getByteLength = getByteLength;
exports.getArgumentCount = getArgumentCount;

/**
 * Read sub-parameters from a buffer (fieldCount, field1Size, field1Data, field2Size, field2Data, ...)
 * @param {{buffer:Buffer}} part
 * @returns {Array<Buffer>} the sub-parameters
 */
function read(part) {
  var offset = 0;
  var buffer = part.buffer;
  var fields = [];

  var numberOfFields = buffer.readUInt16LE(offset);
  offset += 2;
  var fieldLength;
  for (var i = 0; i < numberOfFields; i++) {
    fieldLength = buffer[offset];
    offset += 1;
    if (fieldLength > common.DATA_LENGTH_MAX1BYTE_LENGTH) {
      if (fieldLength == common.DATA_LENGTH_2BYTE_LENGTH_INDICATOR) {
        fieldLength = buffer.readUInt16LE(offset);
        offset += 2;
      } else if (fieldLength == common.DATA_LENGTH_4BYTE_LENGTH_INDICATOR) {
        fieldLength = buffer.readUInt32LE(offset);
        offset += 4;
      } else if (fieldLength == 255) {  // indicates that the following two bytes contain the length in big endian (bug?)
        fieldLength = buffer.readUInt16BE(offset);
        offset += 2;
      } else {
        throw Error("Unsupported length indicator: " + fieldLength);
      }
    }
    fields.push(buffer.slice(offset, offset + fieldLength));
    offset += fieldLength;
  }
  return fields;
}

/**
 * Write sub-parameters to a buffer
 * @param {object?} part
 * @param {Array<Buffer|string>} fields
 * @returns {{argumentCount:number, buffer:Buffer}}
 */
function write(part, fields) {
  /* jshint validthis:true */

  var offset = 0;
  part = part || {};
  fields = fields || this;

  var byteLength = getByteLength(fields);
  var buffer = new Buffer(byteLength);

  buffer.writeUInt16LE(fields.length, 0);
  offset += 2;

  var field, fieldLength, data;
  for (var i = 0; i < fields.length; i++) {
    field = fields[i];
    if (Buffer.isBuffer(field)) {
      data = field;
    } else if (Array.isArray(field)) {
      data = write({}, field).buffer;
    } else {
      data = new Buffer(field, 'ascii');
    }
    fieldLength = data.length;
    if (fieldLength <= common.DATA_LENGTH_MAX1BYTE_LENGTH) {
      buffer[offset] = fieldLength;
      offset += 1;
    } else if (fieldLength <= common.DATA_LENGTH_MAX2BYTE_LENGTH) {
      buffer[offset] = common.DATA_LENGTH_2BYTE_LENGTH_INDICATOR;
      offset += 1;
      buffer.writeUInt16LE(fieldLength, offset);
      offset += 2;
    } else {
      buffer[offset] = common.DATA_LENGTH_4BYTE_LENGTH_INDICATOR;
      offset += 1;
      buffer.writeInt32LE(fieldLength, offset);
      offset += 4;
    }
    data.copy(buffer, offset);
    offset += fieldLength;
  }
  part.argumentCount = getArgumentCount(fields);
  part.buffer = buffer;
  return part;
}

function getByteLength(fields) {
  var byteLength = 2;
  var fieldLength;
  for (var i = 0; i < fields.length; i++) {
    fieldLength = getByteLengthOfField(fields[i]);
    if (fieldLength <= common.DATA_LENGTH_MAX1BYTE_LENGTH) {
      byteLength += fieldLength + 1;
    } else if (fieldLength <= common.DATA_LENGTH_MAX2BYTE_LENGTH) {
      byteLength += fieldLength + 3;
    } else {
      byteLength += fieldLength + 5;
    }
  }
  return byteLength;
}

function getArgumentCount(fields) {
  /* jshint unused:false */
  return 1;
}

function getByteLengthOfField(field) {
  if (Buffer.isBuffer(field)) {
    return field.length;
  } else if (Array.isArray(field)) {
    return getByteLength(field);
  }
  return Buffer.byteLength(field, 'ascii');
}