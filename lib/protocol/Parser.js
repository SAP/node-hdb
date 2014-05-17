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

var util = require('util');
var common = require('./common');
var ResultSetTransform = require('./ResultSetTransform');
var Reader = require('./Reader');
var ReadFunction = common.ReadFunction;
var TypeCode = common.TypeCode;

module.exports = Parser;

function Parser(metadata, lobFactory) {
  this.metadata = metadata;
  this.lobFactory = lobFactory;
}

Parser.create = function createParser(metadata, lobFactory) {
  return new Parser(metadata, lobFactory);
};

Parser.parseParameters = function parseParameters(metadata, buffer) {
  return Parser.create(metadata).parseParams(buffer);
};

Parser.prototype.createParseRowFunction = function createParseRowFunction() {
  return this.createParseFunction('columnDisplayName');
};

Parser.prototype.createParseParamsFunction = function createParseParamsFunction() {
  return this.createParseFunction('name');
};

Parser.prototype.createParseFunction = function createParseFunction(name) {
  /*jshint evil:true */
  return new Function(createFunctionBody(this.metadata, name ||
    'columnDisplayName'));
};

Parser.prototype.parseParams = function parseParams(buffer) {
  var reader = new Reader(buffer, this.lobFactory);
  var parseParamsFunction = this.createParseParamsFunction();
  return parseParamsFunction.call(reader);
};

Parser.prototype.parse = function parse(buffer) {
  var reader = new Reader(buffer, this.lobFactory);
  var parseRow = this.createParseRowFunction().bind(reader);
  var rows = [];
  while (reader.hasMore()) {
    rows.push(parseRow());
  }
  return rows;
};

Parser.prototype.createTransform = function createTransform(rs, options) {
  return new ResultSetTransform(this.createParseRowFunction(), rs, options);
};

function createFunctionBody(metadata, nameProperty) {

  function addParseColumnLine(column, index) {
    var fn = ReadFunction[column.dataType];
    if (column.dataType === TypeCode.DECIMAL) {
      fn = util.format(fn, column.fraction);
    }
    var key = (typeof nameProperty === 'string') ? column[nameProperty] : index;
    return '"' + key + '" : this.' + fn;
  }
  var bodyColumns = metadata.map(addParseColumnLine);
  var functionBody = 'return {\n' + bodyColumns.join(', \n') + '};';
  return functionBody;
}
