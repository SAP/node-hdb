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
var ParameterMode = common.ParameterMode;
var READONLY = ParameterMode.READONLY;
var AUTO_INCREMENT = ParameterMode.AUTO_INCREMENT;
var MANDATORY = ParameterMode.MANDATORY;

exports.read = read;
exports.getArgumentCount = getArgumentCount;

function read(part) {
  var columns = new Array(part.argumentCount);
  _read.call(columns, part.buffer, 0);
  return columns;
}

function _read(buffer, offset) {
  /* jshint validthis:true */

  offset = offset || 0;
  var columns = this;
  var textOffset = offset + columns.length * 24;
  for (var i = 0; i < columns.length; i++) {
    columns[i] = new Column(buffer, offset, textOffset);
    offset += 24;
  }
  return offset;
}

function getArgumentCount(columns) {
  /* jshint unused:false */
  return columns.length;
}

function Column(buffer, offset, textOffset) {
  this.mode = buffer.readInt8(offset);
  this.dataType = buffer.readInt8(offset + 1);
  this.fraction = buffer.readInt16LE(offset + 2);
  this.length = buffer.readInt16LE(offset + 4);
  offset += 8;

  ['tableName', 'schemaName', 'columnName', 'columnDisplayName'].forEach(
    function readName(name) {
      var start = buffer.readInt32LE(offset);
      offset += 4;
      if (start < 0) {
        this[name] = undefined;
      } else {
        start += textOffset;
        var length = buffer.readUInt8(start);
        start += 1;
        this[name] = buffer.toString('utf-8', start, start + length);
      }
    }, this);
}

Column.prototype.isReadOnly = function isReadOnly() {
  /* jshint bitwise:false */
  return this.mode & READONLY ? true : false;
};

Column.prototype.isMandatory = function isMandatory() {
  /* jshint bitwise:false */
  return this.mode & MANDATORY ? true : false;
};

Column.prototype.isAutoIncrement = function isAutoIncrement() {
  /* jshint bitwise:false */
  return this.mode & AUTO_INCREMENT ? true : false;
};