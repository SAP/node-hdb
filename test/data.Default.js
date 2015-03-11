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
var Default = lib.data[PartKind.RESULT_SET];

describe('Data', function () {

  describe('#Default', function () {

    it('should deserialize an Default Part from buffer', function () {
      var buffer = new Buffer([1, 2, 3, 4]);
      var part = {
        argumentCount: 1,
        buffer: buffer,
        length: 16 + buffer.length
      };
      var value = Default.read(part);
      value.should.eql(part);
      Default.getArgumentCount(value).should.equal(part.argumentCount);
      Default.getByteLength(value).should.equal(part.length);
    });

    it('should serialize a Default Part', function () {
      var part = {
        argumentCount: 1,
        buffer: new Buffer(0),
        length: 16
      };
      Default.write.call(part).should.eql(part);
    });

  });

});