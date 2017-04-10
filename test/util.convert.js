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
var util = lib.util;

describe('Util', function () {

  describe('#convert', function () {
    var outOfBom = '🍩';
    var outOfBomCesuBuffer = new Buffer([0xed, 0xa0, 0xbc, 0xed, 0xbd, 0xa9]);
    var outOfBomUtf8Buffer = new Buffer([0xf0, 0x9f, 0x8d, 0xa9]);

    it('should encode in cesu8 if useCesu8 is true', function () {
      util.convert.encode(outOfBom, true).should.eql(outOfBomCesuBuffer);
    });

    it('should encode in utf-8 if useCesu8 is false', function () {
      util.convert.encode(outOfBom, false).should.eql(outOfBomUtf8Buffer);
    });

    it('should decode from utf-8 if useCesu8 is false', function () {
      util.convert.decode(outOfBomUtf8Buffer, false).should.eql(outOfBom);
    });

    it('should decode from cesu-8 if useCesu8 is true', function () {
      util.convert.decode(outOfBomCesuBuffer, true).should.eql(outOfBom);
    });

    it('should count cesu8 charactes in cesu8 encoded buffer', function () {
      util.convert.lengthInCesu8(outOfBomCesuBuffer).should.equal(1);
    });

  });

});
