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
var util = lib.util;

describe('Util', function () {

  describe('#zeropad', function () {

    it('should add left variable left padding', function () {
      util.lpad(2, 1).should.equal('01');
      util.lpad(2, 10).should.equal('10');
      util.lpad(7, 10000).should.equal('0010000');
      util.lpad(14, 1).should.equal('00000000000001');
      util.lpad(28, 1).should.equal('0000000000000000000000000001');
    });

    it('should validate ZEROS', function () {
      util.ZEROS.should.have.length(35);
    });

    it('should add left padding up to length 2', function () {
      util.lpad2(1).should.equal('01');
      util.lpad2(10).should.equal('10');
    });

    it('should add left padding up to length 4', function () {
      util.lpad4(1).should.equal('0001');
      util.lpad4(10).should.equal('0010');
      util.lpad4(100).should.equal('0100');
      util.lpad4(1000).should.equal('1000');
    });

    it('should add left padding up to length 7', function () {
      util.lpad7(1).should.equal('0000001');
      util.lpad7(10).should.equal('0000010');
      util.lpad7(100).should.equal('0000100');
      util.lpad7(1000).should.equal('0001000');
      util.lpad7(10000).should.equal('0010000');
      util.lpad7(100000).should.equal('0100000');
      util.lpad7(1000000).should.equal('1000000');
    });

    it('should add left padding up to length 14', function () {
      util.lpad14(1).should.equal('00000000000001');
      util.lpad14(10).should.equal('00000000000010');
      util.lpad14(100).should.equal('00000000000100');
      util.lpad14(1000).should.equal('00000000001000');
      util.lpad14(10000).should.equal('00000000010000');
      util.lpad14(100000).should.equal('00000000100000');
      util.lpad14(1000000).should.equal('00000001000000');
      util.lpad14(10000000).should.equal('00000010000000');
      util.lpad14(100000000).should.equal('00000100000000');
      util.lpad14(1000000000).should.equal('00001000000000');
      util.lpad14(10000000000).should.equal('00010000000000');
      util.lpad14(100000000000).should.equal('00100000000000');
      util.lpad14(1000000000000).should.equal('01000000000000');
      util.lpad14(10000000000000).should.equal('10000000000000');
    });

  });

});