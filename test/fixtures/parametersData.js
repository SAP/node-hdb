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

var lib = require('../lib');
var TypeCode = lib.common.TypeCode;

exports.DEFAULT = {
  part: {
    argumentCount: 1,
    buffer: new Buffer(
      '1e03616c6c' +
      '1d0464617465' +
      '1d0464657363' +
      '0301000000' +
      '0328000000' +
      '0100' +
      '1e03616c6c' +
      '1e00' +
      '1e00' +
      '1e00', 'hex')
  },
  values: [{
    type: TypeCode.NSTRING,
    value: 'all'
  }, {
    type: TypeCode.STRING,
    value: 'date'
  }, {
    type: TypeCode.STRING,
    value: 'desc'
  }, {
    type: TypeCode.INT,
    value: 1
  }, {
    type: TypeCode.INT,
    value: 40
  }, {
    type: TypeCode.TINYINT,
    value: 0
  }, {
    type: TypeCode.NSTRING,
    value: 'all'
  }, {
    type: TypeCode.NSTRING,
    value: ''
  }, {
    type: TypeCode.NSTRING,
    value: ''
  }, {
    type: TypeCode.NSTRING,
    value: ''
  }]
};