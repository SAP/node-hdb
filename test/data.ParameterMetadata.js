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
/* jshint expr: true */

var lib = require('../lib');
var normalize = require('./normalize');
var PartKind = lib.common.PartKind;
var ParameterMetadata = lib.data[PartKind.PARAMETER_METADATA];

describe('Data', function () {

  var paramsPart = {
    argumentCount: 4,
    buffer: new Buffer(
      '020b01000000000000010000500a0000' +
      '020b01000b0000000001000000000000' +
      '020b01001b0000000001000000000000' +
      '02030400240000000a00000000004d7f' +
      '0a504152454e5455554944' +
      '0f5345415243485f4352495445524941' +
      '085355425f54595045' +
      '0a4552524f525f434f4445', 'hex')
  };
  var paramsMetadata = [{
    mode: 2,
    dataType: 11,
    ioType: 1,
    length: 256,
    fraction: 0,
    name: 'PARENTUUID'
  }, {
    mode: 2,
    dataType: 11,
    ioType: 1,
    length: 256,
    fraction: 0,
    name: 'SEARCH_CRITERIA'
  }, {
    mode: 2,
    dataType: 11,
    ioType: 1,
    length: 256,
    fraction: 0,
    name: 'SUB_TYPE'
  }, {
    mode: 2,
    dataType: 3,
    ioType: 4,
    length: 10,
    fraction: 0,
    name: 'ERROR_CODE'
  }];

  describe('#ParameterMetadata', function () {

    it('should read parameter metadata', function () {
      var parameterMetadata = ParameterMetadata.read(paramsPart);
      var argumentCount = ParameterMetadata.getArgumentCount(
        parameterMetadata);
      argumentCount.should.equal(paramsMetadata.length);
      parameterMetadata.forEach(function (param) {
        param.isReadOnly().should.be.false;
        param.isMandatory().should.be.false;
        param.isAutoIncrement().should.be.false;
      });
      normalize(parameterMetadata).should.eql(paramsMetadata);
    });

  });

});