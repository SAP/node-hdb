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

describe('Lib', function () {

  describe('#Stringifier', function () {

    it('should create a JSON Stringifier', function () {
      var stringifier = lib.createJSONStringifier();
      stringifier.should.be.instanceof(lib.Stringifier);
      stringifier._stringify.should.equal(JSON.stringify);
      stringifier._header.should.equal('[');
      stringifier._footer.should.equal(']');
      stringifier._seperator.should.equal(',');
    });

    it('should write an array with 3 elements', function (done) {
      testStringifier([0, 1, 2], [0, 1, 2], done);
    });

    it('should write an array with 5 elements', function (done) {
      testStringifier([
        [0, 1],
        [2, 3],
        4
      ], [0, 1, 2, 3, 4], done);
    });

    it('should write an empty array', function (done) {
      testStringifier([], [], done);
    });

    it('should write an array with powers of 2', function (done) {
      var stringifier = new lib.Stringifier({
        map: Math.pow.bind(null, 2)
      });
      testStringifier.call(stringifier, [0, 1, 2, 3], [1, 2, 4, 8], done);
    });

    it('should write an array with powers of 3', function (done) {
      var stringifier = new lib.Stringifier({
        map: Math.pow.bind(null, 3)
      });
      testStringifier.call(stringifier, [
        [0, 1],
        [2, 3],
        4
      ], [1, 3, 9, 27, 81], done);
    });

  });

});

function testStringifier(chunks, rows, done) {
  /* jshint validthis:true */
  var data = '';
  var stringifier = this || lib.createJSONStringifier();
  stringifier.on('error', function (err) {
    done(err);
  }).on('readable', function () {
    var chunk = this.read();
    if (chunk) {
      data += chunk;
    }
  }).on('finish', function () {
    JSON.parse(data).should.eql(rows);
    done();
  });
  chunks.forEach(function (chunk) {
    stringifier.write(chunk);
  });
  stringifier.end();
}