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

var lib = require('../../lib');
var TypeCode = lib.common.TypeCode;
var ParameterMode = lib.common.ParameterMode;

exports.VERSION_AND_CURRENT_USER = {
  part: {
    argumentCount: 2,
    buffer: new Buffer([
      // first column
      0x02,
      0x09,
      0x00, 0x00,
      0x20, 0x00,
      0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0xff, 0xff, 0xff, 0xff,
      0x0c, 0x00, 0x00, 0x00,
      0x0c, 0x00, 0x00, 0x00,
      // second column
      0x01,
      0x09,
      0x00, 0x00,
      0x06, 0x00,
      0x00, 0x00,
      0xff, 0xff, 0xff, 0xff,
      0xff, 0xff, 0xff, 0xff,
      0xff, 0xff, 0xff, 0xff,
      0x14, 0x00, 0x00, 0x00,
      // texts
      0x0b, 0x4d, 0x5f, 0x44, 0x41, 0x54, 0x41, 0x42, 0x41, 0x53, 0x45, 0x5f,
      0x07, 0x56, 0x45, 0x52, 0x53, 0x49, 0x4f, 0x4e,
      0x0c, 0x43, 0x55, 0x52, 0x52, 0x45, 0x4e, 0x54, 0x5f, 0x55, 0x53, 0x45,
      0x52
    ])
  },
  columns: [{
    mode: 2,
    dataType: 9,
    fraction: 0,
    length: 32,
    tableName: 'M_DATABASE_',
    schemaName: undefined,
    columnName: 'VERSION',
    columnDisplayName: 'VERSION'
  }, {
    mode: 1,
    dataType: 9,
    fraction: 0,
    length: 6,
    tableName: undefined,
    schemaName: undefined,
    columnName: undefined,
    columnDisplayName: 'CURRENT_USER'
  }]
};

exports.TABLES = {
  columns: [{
    mode: ParameterMode.MANDATORY,
    dataType: TypeCode.NVARCHAR,
    fraction: 0,
    length: 256,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'SCHEMA_NAME',
    columnDisplayName: 'SCHEMA_NAME'
  }, {
    mode: ParameterMode.MANDATORY,
    dataType: TypeCode.NVARCHAR,
    fraction: 0,
    length: 256,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'TABLE_NAME',
    columnDisplayName: 'TABLE_NAME'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.BIGINT,
    fraction: 0,
    length: 19,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'TABLE_OID',
    columnDisplayName: 'TABLE_OID'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.NVARCHAR,
    fraction: 0,
    length: 5000,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'COMMENTS',
    columnDisplayName: 'COMMENTS'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.SMALLINT,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'FIXED_PART_SIZE',
    columnDisplayName: 'FIXED_PART_SIZE'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'IS_LOGGED',
    columnDisplayName: 'IS_LOGGED'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'IS_SYSTEM_TABLE',
    columnDisplayName: 'IS_SYSTEM_TABLE'
  }, {
    mode: ParameterMode.MANDATORY,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'IS_COLUMN_TABLE',
    columnDisplayName: 'IS_COLUMN_TABLE'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 16,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'TABLE_TYPE',
    columnDisplayName: 'TABLE_TYPE'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'IS_INSERT_ONLY',
    columnDisplayName: 'IS_INSERT_ONLY'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'IS_TENANT_SHARED_DATA',
    columnDisplayName: 'IS_TENANT_SHARED_DATA'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'IS_TENANT_SHARED_METADATA',
    columnDisplayName: 'IS_TENANT_SHARED_METADATA'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 7,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'SESSION_TYPE',
    columnDisplayName: 'SESSION_TYPE'
  }, {
    mode: ParameterMode.MANDATORY,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'IS_TEMPORARY',
    columnDisplayName: 'IS_TEMPORARY'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 8,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'TEMPORARY_TABLE_TYPE',
    columnDisplayName: 'TEMPORARY_TABLE_TYPE'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'IS_USER_DEFINED_TYPE',
    columnDisplayName: 'IS_USER_DEFINED_TYPE'
  }, {
    mode: ParameterMode.MANDATORY,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'HAS_PRIMARY_KEY',
    columnDisplayName: 'HAS_PRIMARY_KEY'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.NCLOB,
    fraction: 0,
    length: -1,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'PARTITION_SPEC',
    columnDisplayName: 'PARTITION_SPEC'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'USES_EXTKEY',
    columnDisplayName: 'USES_EXTKEY'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'AUTO_MERGE_ON',
    columnDisplayName: 'AUTO_MERGE_ON'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'USES_DIMFN_CACHE',
    columnDisplayName: 'USES_DIMFN_CACHE'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'IS_PUBLIC',
    columnDisplayName: 'IS_PUBLIC'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'AUTO_OPTIMIZE_COMPRESSION_ON',
    columnDisplayName: 'AUTO_OPTIMIZE_COMPRESSION_ON'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'COMPRESSED_EXTKEY',
    columnDisplayName: 'COMPRESSED_EXTKEY'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'HAS_TEXT_FIELDS',
    columnDisplayName: 'HAS_TEXT_FIELDS'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'USES_QUEUE_TABLE',
    columnDisplayName: 'USES_QUEUE_TABLE'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'IS_PRELOAD',
    columnDisplayName: 'IS_PRELOAD'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'IS_PARTIAL_PRELOAD',
    columnDisplayName: 'IS_PARTIAL_PRELOAD'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.TINYINT,
    fraction: 0,
    length: 3,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'UNLOAD_PRIORITY',
    columnDisplayName: 'UNLOAD_PRIORITY'
  }, {
    mode: ParameterMode.OPTIONAL,
    dataType: TypeCode.VARCHAR1,
    fraction: 0,
    length: 5,
    tableName: 'TABLES',
    schemaName: '',
    columnName: 'HAS_SCHEMA_FLEXIBILITY',
    columnDisplayName: 'HAS_SCHEMA_FLEXIBILITY'
  }]
};