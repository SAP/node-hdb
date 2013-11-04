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

var lib = require('./lib');
var bignum = lib.util.bignum;

function readInt64(hex) {
  return bignum.readInt64LE(new Buffer(hex, 'hex'), 0);
}

function writeInt64(value) {
  var buffer = new Buffer(8);
  bignum.writeInt64LE(buffer, value, 0);
  return buffer.toString('hex');
}

function readUInt64(hex) {
  return bignum.readUInt64LE(new Buffer(hex, 'hex'), 0);
}

function writeUInt64(value) {
  var buffer = new Buffer(8);
  bignum.writeUInt64LE(buffer, value, 0);
  return buffer.toString('hex');
}

function readDec128(hex) {
  return bignum.readDec128(new Buffer(hex, 'hex'), 0);
}
describe('BigNum', function () {

  describe('#Int64', function () {

    it('read negative numbers', function () {
      readInt64('ffffffffffffffff').should.equal(-1);
      readInt64('feffffffffffffff').should.equal(-2);
      readInt64('0000ffffffffffff').should.equal(-Math.pow(2, 16));
      readInt64('00000000ffffffff').should.equal(-Math.pow(2, 32));
      readInt64('000000000000ffff').should.equal(-Math.pow(2, 48));
      readInt64('000000000000f0ff').should.equal(-Math.pow(2, 52));
      readInt64('000000000000e0ff').should.equal(-Math.pow(2, 53));
      readInt64('ffffffffffffdfff').should.equal('-9007199254740993');
    });

    it('read positive numbers', function () {
      readInt64('0100000000000000').should.equal(1);
      readInt64('0200000000000000').should.equal(2);
      readInt64('0001000000000000').should.equal(256);
      readInt64('0000000001000000').should.equal(Math.pow(2, 32));
      readInt64('0000000000000100').should.equal(Math.pow(2, 48));
      readInt64('0000000000001000').should.equal(Math.pow(2, 52));
      readInt64('0000000000002000').should.equal(Math.pow(2, 53));
      readInt64('bd34a75e47780300').should.equal(976672856159421);
      readInt64('0100000000002000').should.equal('9007199254740993');
      readInt64('7708530509f40102').should.equal('144664982633777271');
    });

    it('write negative numbers', function () {
      'ffffffffffffffff'.should.equal(writeInt64(-1));
      'feffffffffffffff'.should.equal(writeInt64(-2));
      '00000000ffffffff'.should.equal(writeInt64(-Math.pow(2, 32)));
      '000000000000f0ff'.should.equal(writeInt64(-Math.pow(2, 52)));
      '000000000000e0ff'.should.equal(writeInt64(-Math.pow(2, 53)));
      'ffffffffffffdfff'.should.equal(writeInt64('-9007199254740993'));
    });

    it('write positive numbers', function () {
      '7708530509f40102'.should.equal(writeInt64('144664982633777271'));
      '0100000000000000'.should.equal(writeInt64(1));
      '0001000000000000'.should.equal(writeInt64(256));
      'bd34a75e47780300'.should.equal(writeInt64(976672856159421));
      '0000000000002000'.should.equal(writeInt64(Math.pow(2, 53)));
    });

  });

  describe('#Unsigned Int64', function () {

    it('read numbers', function () {
      readUInt64('7708530509f40102').should.equal('144664982633777271');
      readUInt64('0000000000000000').should.equal(0);
      readUInt64('0000000000002000').should.equal(Math.pow(2, 53));
      readUInt64('ffffffff00000000').should.equal(Math.pow(2, 32) - 1);
      readUInt64('ffffffffffffffff').should.equal('18446744073709551615');
    });

    it('write numbers', function () {
      '7708530509f40102'.should.equal(writeUInt64('144664982633777271'));
      '0000000000002000'.should.equal(writeUInt64(Math.pow(2, 53)));
      'bd34a75e47780300'.should.equal(writeUInt64(976672856159421));
      'feffffffffffffff'.should.equal(writeUInt64('18446744073709551614'));
      'ffffffffffffffff'.should.equal(writeUInt64('18446744073709551615'));
    });

  });

  describe('#Decimal', function () {

    it('read null', function () {
      (readDec128('ffffffffffffffffffffffffffffffff') === null).should.be
        .true;
      (readDec128('00000000000000000000000000000077') === null).should.be
        .true;
    });

    it('read zero', function () {
      readDec128('00000000000000000000000000004030').should.eql({
        s: 1,
        m: 0,
        e: 0
      });
      readDec128('000000000000000000000000000040b0').should.eql({
        s: -1,
        m: 0,
        e: 0
      });
      readDec128('00000000000000000000000000000000').should.eql({
        s: 1,
        m: 0,
        e: -6176
      });
      readDec128('0000000000000000000000000000feef').should.eql({
        s: -1,
        m: 0,
        e: 8159
      });
    });

    it('read positive numbers', function () {
      readDec128('63000000000000000000000000004230').should.eql({
        s: 1,
        m: 99,
        e: 1
      });
      readDec128('ae080000000000000000000000004430').should.eql({
        s: 1,
        m: 2222,
        e: 2
      });
      readDec128('7708530509f401027708530509f44130').should.eql({
        s: 1,
        m: '10141919503094329964824243895208055',
        e: 0
      });
      readDec128('ffffffffffffffffffffffffffffff6f').should.eql({
        s: 1,
        m: '10384593717069655257060992658440191',
        e: 8159
      });
    });

    it('read negative numbers', function () {
      readDec128('63000000000000000000000000003eb0').should.eql({
        s: -1,
        m: 99,
        e: -1
      });
      readDec128('ae080000000000000000000000003cb0').should.eql({
        s: -1,
        m: 2222,
        e: -2
      });
      readDec128('ffffffffffffffffffffffffffffffef').should.eql({
        s: -1,
        m: '10384593717069655257060992658440191',
        e: 8159
      });
    });

    it('read m strictly', function () {
      readDec128('63000000000000000000000000004030').m.should.equal(99);
      readDec128('ae0800000000000000000000000040b0').m.should.equal(2222);
      readDec128('00000000000020000000000000004030').m.should.equal(Math.pow(
        2, 53));
      readDec128('000000000000200000000000000040b0').m.should.equal(Math.pow(
        2, 53));
      readDec128('01000000000020000000000000004030').m.should.equal(
        '9007199254740993');
      readDec128('ffffffffffffffffffffffffffffffef').m.should.equal(
        '10384593717069655257060992658440191');
    });

  });

});