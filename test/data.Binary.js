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
var Binary = lib.data[PartKind.RESULT_SET_ID];

describe('Data', function () {

  describe('#Binary', function () {

    it('should deserialize a Binary Part from buffer', function () {
      var buffer = new Buffer([1, 2, 3, 4]);
      var part = {
        argumentCount: 1,
        buffer: buffer
      };
      var value = Binary.read(part);
      value.should.eql(buffer);
      Binary.getArgumentCount(value).should.equal(1);
      Binary.getByteLength(value).should.equal(buffer.length);
    });

    it('should serialize a Binary Part', function () {
      var buffer = new Buffer(0);
      Binary.write.call(buffer).should.eql({
        argumentCount: 1,
        buffer: buffer
      });
    });

  });

});