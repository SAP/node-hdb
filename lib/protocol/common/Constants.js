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

var ConnectOption = require('./ConnectOption');
var TypeCode = require('./TypeCode');
var ClientDistributionMode = require('./ClientDistributionMode');
var DataFormatVersion = require('./DataFormatVersion');
var DistributionProtocolVersion = require('./DistributionProtocolVersion');

module.exports = {
  PACKET_HEADER_LENGTH: 32,
  SEGMENT_HEADER_LENGTH: 24,
  PART_HEADER_LENGTH: 16,
  DEFAULT_PACKET_SIZE: Math.pow(2, 17),
  MAXIMUM_PACKET_SIZE: Math.pow(2, 30) - 1,
  MINIMUM_PACKET_SIZE: Math.pow(2, 16),
  MAX_RESULT_SET_SIZE: Math.pow(2, 20),
  EMPTY_BUFFER: new Buffer(0),
  DATA_LENGTH_MAX1BYTE_LENGTH: 245,
  DATA_LENGTH_MAX2BYTE_LENGTH: 32767,
  DATA_LENGTH_2BYTE_LENGTH_INDICATOR: 246,
  DATA_LENGTH_4BYTE_LENGTH_INDICATOR: 247,
  DEFAULT_CONNECT_OPTIONS: [{
    name: ConnectOption.CLIENT_LOCALE,
    value: 'en_US',
    type: TypeCode.STRING
  }, {
    name: ConnectOption.COMPLETE_ARRAY_EXECUTION,
    value: true,
    type: TypeCode.BOOLEAN
  }, {
    name: ConnectOption.DATA_FORMAT_VERSION2,
    value: DataFormatVersion.COMPLETE_DATATYPE_SUPPORT,
    type: TypeCode.INT
  }, {
    name: ConnectOption.DATA_FORMAT_VERSION,
    value: DataFormatVersion.COMPLETE_DATATYPE_SUPPORT,
    type: TypeCode.INT
  }, {
    name: ConnectOption.DISTRIBUTION_ENABLED,
    value: false,
    type: TypeCode.BOOLEAN
  }, {
    name: ConnectOption.DISTRIBUTION_MODE,
    value: ClientDistributionMode.OFF,
    type: TypeCode.INT
  }, {
    name: ConnectOption.DISTRIBUTION_PROTOCOL_VERSION,
    value: DistributionProtocolVersion.BASE,
    type: TypeCode.INT
  }, {
    name: ConnectOption.SELECT_FOR_UPDATE_SUPPORTED,
    value: false,
    type: TypeCode.BOOLEAN
  }, {
    name: ConnectOption.ROW_AND_COLUMN_OPTIMIZED_FORMAT,
    value: true,
    type: TypeCode.BOOLEAN
  }]
};