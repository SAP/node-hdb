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
var Int32 = lib.data[PartKind.ROWS_AFFECTED];

describe('Data', function () {

  describe('#Int32', function () {

    it('should deserialize an Int32 Part from buffer', function () {
      var part = {
        argumentCount: 1,
        buffer: new Buffer([1, 0, 0, 0])
      };
      var value = Int32.read(part);
      value.should.equal(1);
      Int32.getArgumentCount(value).should.equal(1);
      Int32.getByteLength(value).should.equal(4);
    });

    it('should serialize an Int32 Part', function () {
      Int32.write.call(1).should.eql({
        argumentCount: 1,
        buffer: new Buffer([1, 0, 0, 0])
      });
    });
  });

});