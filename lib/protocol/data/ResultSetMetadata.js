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
var OPTIONAL = ParameterMode.OPTIONAL;

exports.read = read;
exports.getArgumentCount = getArgumentCount;
exports.Column = Column;

function read(part) {
  var columns = new Array(part.argumentCount);
  var offset = 0;
  var textOffset = columns.length * 24;
  for (var i = 0; i < columns.length; i++) {
    columns[i] = readColumn(part.buffer, offset, textOffset);
    offset += 24;
  }
  return columns;
}

function getArgumentCount(columns) {
  /* jshint unused:false */
  return columns.length;
}

var COLUMN_NAME_PROPERTIES = [
  'tableName', 'schemaName', 'columnName', 'columnDisplayName'
];

function readColumn(buffer, offset, textOffset) {
  var column = new Column(
    buffer.readInt8(offset),
    buffer.readInt8(offset + 1),
    buffer.readInt16LE(offset + 2),
    buffer.readInt16LE(offset + 4)
  );
  offset += 8;

  function readName(name) {
    var start = buffer.readInt32LE(offset);
    offset += 4;
    if (start < 0) {
      column[name] = undefined;
    } else {
      start += textOffset;
      var length = buffer.readUInt8(start);
      start += 1;
      column[name] = buffer.toString('utf-8', start, start + length);
    }
  }
  COLUMN_NAME_PROPERTIES.forEach(readName);
  return column;
}

function Column(mode, dataType, fraction, length) {
  this.mode = mode;
  this.dataType = dataType;
  this.fraction = fraction;
  this.length = length;
  this.tableName = undefined;
  this.schemaName = undefined;
  this.columnName = undefined;
  this.columnDisplayName = undefined;
}

Column.prototype.isReadOnly = function isReadOnly() {
  /* jshint bitwise:false */
  return !!(this.mode & READONLY);
};

Column.prototype.isMandatory = function isMandatory() {
  /* jshint bitwise:false */
  return !!(this.mode & MANDATORY);
};

Column.prototype.isOptional = function isOptional() {
  /* jshint bitwise:false */
  return !!(this.mode & OPTIONAL);
};

Column.prototype.isAutoIncrement = function isAutoIncrement() {
  /* jshint bitwise:false */
  return !!(this.mode & AUTO_INCREMENT);
};