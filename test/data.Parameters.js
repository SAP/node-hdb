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
var Parameters = lib.data[PartKind.PARAMETERS];

describe('Data', function () {

  describe('#Parameters', function () {

    it('should write multiple parameters values', function () {
      var value = [new Buffer([1]), new Buffer([2])];
      var part = Parameters.write({}, value);
      part.argumentCount.should.equal(2);
      Parameters.getArgumentCount(value).should.equal(2);
      part.buffer.should.eql(new Buffer([1, 2]));
      Parameters.getByteLength(value).should.equal(2);
    });

    it('should write one parameters value', function () {
      var value = new Buffer([1]);
      Parameters.getArgumentCount(value).should.equal(1);
      Parameters.getByteLength(value).should.equal(1);
      Parameters.write({}, value).should.eql({
        argumentCount: 1,
        buffer: value
      });
      Parameters.write.call(value).should.eql({
        argumentCount: 1,
        buffer: value
      });
    });

  });

});