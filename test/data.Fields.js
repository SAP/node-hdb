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
var Fields = lib.data[PartKind.AUTHENTICATION];

describe('Data', function () {

  describe('#Fields', function () {

    var smallFields = [
      new Buffer([1]),
      new Buffer([2])
    ];
    var smallBuffer = new Buffer([2, 0, 1, 1, 1, 2]);

    var complexFields = [
      new Buffer([1]), [
        new Buffer([2]),
        new Buffer([3])
      ]
    ];
    var complexBuffer = new Buffer([2, 0, 1, 1, 6, 2, 0, 1, 2, 1, 3]);

    function createLargeBuffer(length) {
      var buffer = new Buffer(length);
      buffer.fill(0);
      return buffer;
    }
    var largeFields = [
      createLargeBuffer(256),
      createLargeBuffer(256)
    ];
    var largeBuffer = Buffer.concat([
      new Buffer([2, 0]),
      new Buffer([246, 0, 1]),
      largeFields[0],
      new Buffer([246, 0, 1]),
      largeFields[1]
    ]);

    it('should write small fields', function () {
      Fields.getArgumentCount(smallFields).should.equal(1);
      Fields.getByteLength(smallFields).should.equal(smallBuffer.length);
      Fields.write({}, smallFields).should.eql({
        argumentCount: 1,
        buffer: smallBuffer
      });
      Fields.write.call(smallFields).should.eql({
        argumentCount: 1,
        buffer: smallBuffer
      });
    });

    it('should read small fields', function () {
      Fields.read({
        buffer: smallBuffer
      }).should.eql(smallFields);
    });


    it('should write complex fields', function () {
      var part = Fields.write({}, complexFields);
      part.argumentCount.should.equal(1);
      Fields.getArgumentCount(complexFields).should.equal(1);
      part.buffer.should.eql(complexBuffer);
      Fields.getByteLength(complexFields).should.equal(
        complexBuffer.length);
    });

    it('should read complex fields', function () {
      var fields = Fields.read({
        buffer: complexBuffer
      });
      fields[1] = Fields.read({
        buffer: fields[1]
      });
      fields.should.eql(complexFields);
    });

    it('should write large fields', function () {
      var part = Fields.write({}, largeFields);
      part.argumentCount.should.equal(1);
      Fields.getArgumentCount(largeFields).should.equal(1);
      part.buffer.should.eql(largeBuffer);
      Fields.getByteLength(largeFields).should.equal(largeBuffer.length);
    });

    it('should read large fields', function () {
      var fields = Fields.read({
        buffer: largeBuffer
      });
      fields.should.eql(largeFields);
    });

  });

});