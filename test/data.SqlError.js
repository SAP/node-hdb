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
var normalize = require('./normalize');
var PartKind = lib.common.PartKind;
var ErrorLevel = lib.common.ErrorLevel;
var SqlError = lib.data[PartKind.ERROR];

function serializeError(error) {
  var length = Buffer.byteLength(error.message);
  var buffer = new Buffer(18 + length);
  buffer.writeInt32LE(error.code, 0);
  buffer.writeInt32LE(error.position, 4);
  buffer.writeInt32LE(length, 8);
  buffer.writeInt8(error.level, 12);
  buffer.write(error.sqlState, 13, 5);
  buffer.write(error.message, 18, length);
  return buffer;
}
describe('Data', function () {

  describe('#SqlError', function () {

    it('should deserialize warning from buffer', function () {
      var warning = {
        message: 'foo',
        code: 1,
        position: 2,
        level: ErrorLevel.WARNING,
        sqlState: 'HY001'
      };
      var sqlError = SqlError.read({
        buffer: serializeError(warning),
        argumentCount: 1
      });
      normalize(sqlError).should.eql(warning);
      SqlError.getArgumentCount(sqlError).should.equal(1);
      SqlError.getByteLength(sqlError).should.equal(21);
    });

    it('should deserialize fatal error from buffer', function () {
      var fatal = {
        message: 'bar',
        code: 1,
        position: 2,
        level: ErrorLevel.FATAL,
        fatal: true,
        sqlState: 'HY001'
      };
      var sqlError = SqlError.read({
        buffer: serializeError(fatal),
        argumentCount: 1
      });
      normalize(sqlError).should.eql(fatal);
    });

  });

});