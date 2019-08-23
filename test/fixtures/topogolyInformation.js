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

exports.DEFAULT = {
  part: {
    argumentCount: 2,
    buffer: Buffer.from([
      // first row
      0x0b, 0x00,
      0x01, 0x1d, 0x08, 0x00, 0x76, 0x65, 0x68, 0x78, 0x73, 0x30, 0x30, 0x31,
      0x02, 0x03, 0x3f, 0x75, 0x00, 0x00,
      0x03, 0x1d, 0x00, 0x00,
      0x04, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x3f,
      0x05, 0x03, 0x02, 0x00, 0x00, 0x00,
      0x06, 0x1c, 0x01,
      0x07, 0x1c, 0x01,
      0x08, 0x03, 0x03, 0x00, 0x00, 0x00,
      0x09, 0x1d, 0x11, 0x00, 0x64, 0x68, 0x63, 0x70, 0x2e, 0x77, 0x64, 0x66,
      0x2e, 0x73, 0x61, 0x70, 0x2e, 0x63, 0x6f, 0x72, 0x70,
      0x0b, 0x1d, 0x17, 0x00, 0x31, 0x32, 0x37, 0x2e, 0x30, 0x2e, 0x30, 0x2e,
      0x32, 0x2c, 0x31, 0x30, 0x2e, 0x36, 0x36, 0x2e, 0x31, 0x39, 0x30, 0x2e,
      0x32, 0x32, 0x31,
      0x0c, 0x1d, 0x08, 0x00, 0x76, 0x65, 0x68, 0x78, 0x73, 0x30, 0x30, 0x31,
      // second row
      0x0a, 0x00,
      0x01, 0x1d, 0x08, 0x00, 0x76, 0x65, 0x68, 0x78, 0x73, 0x30, 0x30, 0x31,
      0x02, 0x03, 0x41, 0x75, 0x00, 0x00,
      0x03, 0x1d, 0x00, 0x00,
      0x04, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x3f,
      0x05, 0x03, 0x03, 0x00, 0x00, 0x00,
      0x06, 0x1c, 0x01,
      0x08, 0x03, 0x04, 0x00, 0x00, 0x00,
      0x09, 0x1d, 0x11, 0x00, 0x64, 0x68, 0x63, 0x70, 0x2e, 0x77, 0x64, 0x66,
      0x2e, 0x73, 0x61, 0x70, 0x2e, 0x63, 0x6f, 0x72, 0x70,
      0x0b, 0x1d, 0x17, 0x00, 0x31, 0x32, 0x37, 0x2e, 0x30, 0x2e, 0x30, 0x2e,
      0x32, 0x2c, 0x31, 0x30, 0x2e, 0x36, 0x36, 0x2e, 0x31, 0x39, 0x30, 0x2e,
      0x32, 0x32, 0x31,
      0x0c, 0x1d, 0x08, 0x00, 0x76, 0x65, 0x68, 0x78, 0x73, 0x30, 0x30, 0x31
    ])
  },
  options: [
    [{
      name: 1,
      value: 'vehxs001',
      type: TypeCode.STRING
    }, {
      name: 2,
      value: 30015,
      type: TypeCode.INT
    }, {
      name: 3,
      value: '',
      type: TypeCode.STRING
    }, {
      name: 4,
      value: 1,
      type: TypeCode.DOUBLE
    }, {
      name: 5,
      value: 2,
      type: TypeCode.INT
    }, {
      name: 6,
      value: true,
      type: TypeCode.BOOLEAN
    }, {
      name: 7,
      value: true,
      type: TypeCode.BOOLEAN
    }, {
      name: 8,
      value: 3,
      type: TypeCode.INT
    }, {
      name: 9,
      value: 'dhcp.wdf.sap.corp',
      type: TypeCode.STRING
    }, {
      name: 11,
      value: '127.0.0.2,10.66.190.221',
      type: TypeCode.STRING
    }, {
      name: 12,
      value: 'vehxs001',
      type: TypeCode.STRING
    }],
    [{
      name: 1,
      value: 'vehxs001',
      type: TypeCode.STRING
    }, {
      name: 2,
      value: 30017,
      type: TypeCode.INT
    }, {
      name: 3,
      value: '',
      type: TypeCode.STRING
    }, {
      name: 4,
      value: 1,
      type: TypeCode.DOUBLE
    }, {
      name: 5,
      value: 3,
      type: TypeCode.INT
    }, {
      name: 6,
      value: true,
      type: TypeCode.BOOLEAN
    }, {
      name: 8,
      value: 4,
      type: TypeCode.INT
    }, {
      name: 9,
      value: 'dhcp.wdf.sap.corp',
      type: TypeCode.STRING
    }, {
      name: 11,
      value: '127.0.0.2,10.66.190.221',
      type: TypeCode.STRING
    }, {
      name: 12,
      value: 'vehxs001',
      type: TypeCode.STRING
    }]
  ]
};