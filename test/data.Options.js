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
var PartKind = lib.common.PartKind;
var Options = lib.data[PartKind.CONNECT_OPTIONS];

describe('Data', function () {

  var optsPart = {
    argumentCount: 10,
    buffer: new Buffer([
      0x01, 0x03, 0x67, 0x15, 0x03, 0x00,
      0x0b, 0x1d, 0x03, 0x00, 0x58, 0x53, 0x45,
      0x0c, 0x03, 0x01, 0x00, 0x00, 0x00,
      0x17, 0x03, 0x01, 0x00, 0x00, 0x00,
      0x10, 0x04, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x02, 0x1c, 0x01,
      0x0f, 0x03, 0x02, 0x00, 0x00, 0x00,
      0x13, 0x1c, 0x01,
      0x14, 0x1c, 0x01,
      0x15, 0x03, 0x01, 0x00, 0x00, 0x00
    ])
  };

  var opts = [{
    name: 1,
    type: 3,
    value: 202087
  }, {
    name: 11,
    type: 29,
    value: 'XSE'
  }, {
    name: 12,
    type: 3,
    value: 1
  }, {
    name: 23,
    type: 3,
    value: 1
  }, {
    name: 16,
    type: 4,
    value: 3
  }, {
    name: 2,
    type: 28,
    value: true
  }, {
    name: 15,
    type: 3,
    value: 2
  }, {
    name: 19,
    type: 28,
    value: true
  }, {
    name: 20,
    type: 28,
    value: true
  }, {
    name: 21,
    type: 3,
    value: 1
  }];

  describe('#Options', function () {

    it('should write an Options part', function () {
      Options.write({}, opts).should.eql(optsPart);
      Options.write.call(opts).should.eql(optsPart);
    });

    it('should read an Options part', function () {
      Options.read(optsPart).should.eql(opts);
    });

  });

});