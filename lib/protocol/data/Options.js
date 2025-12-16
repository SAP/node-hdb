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
var bignum = util.bignum;
var common = require('../common');
var TypeCode = common.TypeCode;

exports.read = read;
exports.toObject = toObject;
exports._read = _read;
exports.write = write;
exports.getByteLength = getByteLength;
exports.getArgumentCount = getArgumentCount;

function read(part, properties) {
  var options = new Array(part.argumentCount);
  _read.call(options, part.buffer, 0);
  if (util.isObject(properties)) {
    return toObject(options, properties);
  }
  return options;
}

function toObject(options, propertyNames) {
  var obj = {};

  function hasProperty(option) {
    return Object.prototype.hasOwnProperty.call(propertyNames, option.name);
  }

  function setOption(option) {
    obj[util._2cc(propertyNames[option.name])] = option.value;
  }
  options.filter(hasProperty).forEach(setOption);
  return obj;
}

function _read(buffer, offset) {
  /* jshint validthis:true */

  offset = offset || 0;
  var options = this;
  var option, length;
  for (var i = 0; i < options.length; i++) {
    option = {
      name: buffer[offset],
      type: buffer[offset + 1],
      value: undefined
    };
    offset += 2;
    switch (option.type) {
      case TypeCode.BOOLEAN:
        option.value = !!buffer[offset];
        offset += 1;
        break;
      case TypeCode.INT:
        option.value = buffer.readInt32LE(offset);
        offset += 4;
        break;
      case TypeCode.BIGINT:
        option.value = bignum.readInt64LE(buffer, offset);
        offset += 8;
        break;
      case TypeCode.DOUBLE:
        option.value = buffer.readDoubleLE(offset);
        offset += 8;
        break;
      case TypeCode.STRING:
        length = buffer.readInt16LE(offset);
        offset += 2;
        option.value = buffer.toString('utf-8', offset, offset + length);
        offset += length;
        break;
      case TypeCode.BSTRING:
        length = buffer.readInt16LE(offset);
        offset += 2;
        option.value = new Buffer(length);
        buffer.copy(option.value, 0, offset, offset + length);
        offset += length;
        break;
      default:
      // do nothing
    }
    options[i] = option;
  }
  return offset;
}

function write(part, options) {
  /* jshint validthis:true */
  var offset = 0;
  part = part || {};
  options = options || this;
  var byteLength = getByteLength(options);
  var buffer = new Buffer(byteLength);
  var option;
  for (var i = 0; i < options.length; i++) {
    option = options[i];
    buffer[offset] = option.name;
    buffer[offset + 1] = option.type;
    offset += 2;
    switch (option.type) {
      case TypeCode.BOOLEAN:
        buffer[offset] = !!option.value ? 1 : 0;
        offset += 1;
        break;
      case TypeCode.INT:
        buffer.writeInt32LE(option.value, offset);
        offset += 4;
        break;
      case TypeCode.BIGINT:
        bignum.writeInt64LE(buffer, option.value, offset);
        offset += 8;
        break;
      case TypeCode.DOUBLE:
        buffer.writeDoubleLE(option.value, offset);
        offset += 8;
        break;
      case TypeCode.STRING:
        byteLength = Buffer.byteLength(option.value, 'utf-8');
        buffer.writeInt16LE(byteLength, offset);
        offset += 2;
        buffer.write(option.value, offset, byteLength, 'utf-8');
        offset += byteLength;
        break;
      case TypeCode.BSTRING:
        byteLength = option.value.length;
        buffer.writeInt16LE(byteLength, offset);
        offset += 2;
        option.value.copy(buffer, offset);
        offset += byteLength;
        break;
      default:
      // do nothing
    }
  }
  part.argumentCount = options.length;
  part.buffer = buffer;
  return part;
}

function getByteLength(options) {
  var byteLength = 0;
  var option;
  for (var i = 0; i < options.length; i++) {
    option = options[i];
    switch (option.type) {
      case TypeCode.BOOLEAN:
        byteLength += 3;
        break;
      case TypeCode.INT:
        byteLength += 6;
        break;
      case TypeCode.BIGINT:
        byteLength += 10;
        break;
      case TypeCode.DOUBLE:
        byteLength += 10;
        break;
      case TypeCode.STRING:
        byteLength += 4 + Buffer.byteLength(option.value, 'utf-8');
        break;
      case TypeCode.BSTRING:
        byteLength += 4 + option.value.length;
        break;
      default:
      // do nothing
    }
  }
  return byteLength;
}

function getArgumentCount(options) {
  return options.length;
}
