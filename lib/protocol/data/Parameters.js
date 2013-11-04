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
var TypeCode = common.TypeCode;
var bignum = util.bignum;

exports.write = write;
exports.getArgumentCount = getArgumentCount;

function write(part, params) {
  /* jshint validthis:true, bitwise:false */

  part = part || {};
  params = params || this;

  var buffers = [];
  var byteLength;
  var buffer, type, value;
  for (var i = 0; i < params.length; i++) {
    type = params[i].type;
    value = params[i].value;
    if (typeof value === 'undefined' || value === null) {
      buffer = new Buffer(1);
      buffer[0] = type | 0x80;
      buffers.push(buffer);
    } else {
      switch (type) {
      case TypeCode.TINYINT:
        buffer = new Buffer(2);
        buffer[0] = type;
        buffer.writeInt8(value, 1);
        buffers.push(buffer);
        break;
      case TypeCode.SMALLINT:
        buffer = new Buffer(3);
        buffer[0] = type;
        buffer.writeInt16LE(value, 1);
        buffers.push(buffer);
        break;
      case TypeCode.INT:
        buffer = new Buffer(5);
        buffer[0] = type;
        buffer.writeInt32LE(value, 1);
        buffers.push(buffer);
        break;
      case TypeCode.BIGINT:
        buffer = new Buffer(9);
        buffer[0] = type;
        bignum.writeInt64LE(buffer, value, 1);
        buffers.push(buffer);
        break;
      case TypeCode.REAL:
        buffer = new Buffer(5);
        buffer[0] = type;
        buffer.writeFloatLE(value, 1);
        buffers.push(buffer);
        break;
      case TypeCode.DOUBLE:
        buffer = new Buffer(9);
        buffer[0] = type;
        buffer.writeDoubleLE(value, 1);
        buffers.push(buffer);
        break;
      case TypeCode.STRING:
      case TypeCode.NSTRING:
      case TypeCode.VARCHAR1:
      case TypeCode.VARCHAR2:
      case TypeCode.CHAR:
      case TypeCode.NCHAR:
      case TypeCode.NVARCHAR:
      case TypeCode.SHORTTEXT:
      case TypeCode.ALPHANUM:
        byteLength = Buffer.byteLength(value, 'utf-8');
        if (byteLength <= 245) {
          buffer = new Buffer(2 + byteLength);
          buffer[0] = type;
          buffer[1] = byteLength;
          buffer.write(value, 2, byteLength, 'utf-8');
        } else if (byteLength <= 32767) {
          buffer = new Buffer(4 + byteLength);
          buffer[0] = type;
          buffer[1] = 246;
          buffer.writeInt16LE(byteLength, 2);
          buffer.write(value, 4, byteLength, 'utf-8');
        } else {
          buffer = new Buffer(6 + byteLength);
          buffer[0] = type;
          buffer[1] = 247;
          buffer.writeInt32LE(byteLength, 2);
          buffer.write(value, 6, byteLength, 'utf-8');
        }
        buffers.push(buffer);
        break;
      case TypeCode.BSTRING:
      case TypeCode.BINARY:
      case TypeCode.VARBINARY:
        byteLength = value.length;
        if (byteLength <= 245) {
          buffer = new Buffer(2 + byteLength);
          buffer[0] = type;
          buffer[1] = byteLength;
          value.copy(buffer, 2);
        } else if (byteLength <= 32767) {
          buffer = new Buffer(4 + byteLength);
          buffer[0] = type;
          buffer[1] = 246;
          buffer.writeInt16LE(byteLength, 2);
          value.copy(buffer, 4);
        } else {
          buffer = new Buffer(6 + byteLength);
          buffer[0] = type;
          buffer[1] = 247;
          buffer.writeInt32LE(byteLength, 2);
          value.copy(buffer, 6);
        }
        buffers.push(buffer);
        break;
      case TypeCode.DATE:
        buffer = new Buffer(6);
        buffer[0] = type;
        buffer.writeInt16LE(~~value.substring(0, 4), 1);
        buffer.writeInt8(~~value.substring(5, 7), 3);
        buffer.writeInt16LE(~~value.substring(8, 10), 4);
        buffers.push(buffer);
        break;
      case TypeCode.TIME:
        buffer = new Buffer(5);
        buffer[0] = type;
        buffer.writeInt8(~~value.substring(0, 2), 1);
        buffer.writeInt8(~~value.substring(3, 5), 2);
        buffer.writeUInt16LE(Math.round(parseFloat(value.substring(6))), 3);
        buffers.push(buffer);
        break;
      }
    }
  }
  part.argumentCount = getArgumentCount(params);
  part.buffer = Buffer.concat(buffers);
  return part;
}

function getArgumentCount(params) {
  /* jshint unused:false */
  return 1;
}