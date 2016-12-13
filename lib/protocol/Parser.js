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

var util = require('../util');
var common = require('./common');
var ResultSetTransform = require('./ResultSetTransform');
var Reader = require('./Reader');
var ReadFunction = common.ReadFunction;
var TypeCode = common.TypeCode;

module.exports = Parser;

function Parser(metadata, lobFactory, useCesu8) {
  this.metadata = metadata;
  this.lobFactory = lobFactory;
  this.honest = !!process.browser;
  this.useCesu8 = (useCesu8 === true);
}

Parser.create = function createParser(metadata, lobFactory, useCesu8) {
  return new Parser(metadata, lobFactory, useCesu8);
};

Parser.prototype.createParseRowFunction = function createParseRowFunction(options) {
  return this.createParseFunction(util.extend({
    nameProperty: 'columnDisplayName'
  }, options));
};

Parser.prototype.createParseParamsFunction = function createParseParamsFunction(options) {
  return this.createParseFunction(util.extend({
    nameProperty: 'name'
  }, options));
};

Parser.prototype.createParseFunction = function createParseFunction(options) {
  options = options || {};
  if (!this.honest) {
    return createEvilParseFunction(this.metadata, options);
  }
  return createHonestParseFunction(this.metadata, options);
};

Parser.prototype.parseParams = function parseParams(buffer, options) {
  var reader = new Reader(buffer, this.lobFactory, this.useCesu8);
  return this.createParseParamsFunction(options).call(reader);
};

Parser.prototype.parse = function parse(buffer, options) {
  var reader = new Reader(buffer, this.lobFactory, this.useCesu8);
  var parseRow = this.createParseRowFunction(options).bind(reader);
  var rows = [];
  while (reader.hasMore()) {
    rows.push(parseRow());
  }
  return rows;
};

Parser.prototype.createTransform = function createTransform(rs, options) {
  return new ResultSetTransform(this.createParseRowFunction(options), rs, options);
};

function parseRowAsArray(columns) {
  /* jshint validthis: true */
  var column;
  var row = [];
  for (var i = 0; i < columns.length; i++) {
    column = columns[i];
    row.push(this[column.f.name].apply(this, column.f.args));
  }
  return row;
}

function parseRowAsHash(columns) {
  /* jshint validthis: true */
  var column;
  var row = {};
  for (var i = 0; i < columns.length; i++) {
    column = columns[i];
    row[column.key] = this[column.f.name].apply(this, column.f.args);
  }
  return row;
}

function parseRowAsNestedHash(tables) {
  /* jshint validthis: true */
  var table;
  var row = {};
  for (var i = 0; i < tables.length; i++) {
    table = tables[i];
    row[table.name] = parseRowAsHash.call(this, table.columns);
  }
  return row;
}

function createHonestParseFunction(metadata, options) {

  function addReadFunction(column) {
    var args = [];
    if (column.dataType === TypeCode.DECIMAL) {
      args.push(column.fraction);
    }
    column.f = {
      name: ReadFunction[column.dataType],
      args: args
    };
  }

  function addReadFunctionToTableColumns(table) {
    table.columns.forEach(addReadFunction);
  }

  if (!util.isString(options.nameProperty)) {
    (metadata = getFlatMetadata(metadata, options)).forEach(addReadFunction);
    return function parse() {
      /* jshint validthis: true */
      return parseRowAsArray.call(this, metadata);
    };
  }

  if (!options.nestTables || util.isString(options.nestTables)) {
    (metadata = getFlatMetadata(metadata, options)).forEach(addReadFunction);
    return function parse() {
      /* jshint validthis: true */
      return parseRowAsHash.call(this, metadata);
    };
  }

  (metadata = getNestedMetadata(metadata, options)).forEach(addReadFunctionToTableColumns);
  return function parse() {
    /* jshint validthis: true */
    return parseRowAsNestedHash.call(this, metadata);
  };
}

function createEvilParseFunction(metadata, options) {
  /* jshint evil: true */
  return new Function(createFunctionBody(metadata, options));
}

function createFunctionBody(metadata, options) {

  function getReadFunction(column) {
    var fn = ReadFunction[column.dataType];
    if (column.dataType === TypeCode.DECIMAL) {
      fn += '(' + column.fraction + ')';
    } else {
      fn += '()';
    }
    return fn;
  }

  function addPairToRow(column) {
    return JSON.stringify(column.key) + ': this.' + getReadFunction(column);
  }

  function addValueToRow(column) {
    return 'this.' + getReadFunction(column);
  }

  function addTableToRow(table) {
    return [
      JSON.stringify(table.name) + ': {',
      table.columns.map(addPairToRow).join(',\n'),
      '}'
    ].join('\n');
  }

  if (!util.isString(options.nameProperty)) {
    return [
      'return [',
      metadata.map(addValueToRow).join(',\n'),
      '];'
    ].join('\n');
  }

  if (!options.nestTables || util.isString(options.nestTables)) {
    return [
      'return {',
      getFlatMetadata(metadata, options).map(addPairToRow).join(',\n'),
      '};'
    ].join('\n');
  }

  return [
    'return {',
    getNestedMetadata(metadata, options).map(addTableToRow).join(',\n'),
    '};'
  ].join('\n');
}

function getFlatMetadata(metadata, options) {

  function getMetadataWithKey(column) {
    var key;
    if (util.isString(options.nestTables)) {
      key = column.tableName + options.nestTables + column[options.nameProperty];
    } else {
      key = column[options.nameProperty];
    }
    return {
      key: key,
      dataType: column.dataType,
      fraction: column.fraction
    };
  }
  return metadata.map(getMetadataWithKey);
}

function getNestedMetadata(metadata, options) {
  var tables = [];
  var tableNames = [];

  function pushTableColumn(column) {
    var table;
    var tableName = column.tableName;
    var index = tableNames.indexOf(tableName);
    if (index === -1) {
      table = {
        name: tableName,
        columns: []
      };
      tableNames.push(tableName);
      tables.push(table);
    } else {
      table = tables[index];
    }
    table.columns.push({
      key: column[options.nameProperty],
      dataType: column.dataType,
      fraction: column.fraction
    });
  }
  metadata.forEach(pushTableColumn);
  return tables;
}