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

var should = require('should');
var lib = require('../lib');
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

function readDecFloat(hex) {
  return bignum.readDecFloat(new Buffer(hex, 'hex'), 0);
}

function readDecFixed(hex, frac) {
  return bignum.readDecFixed(new Buffer(hex, 'hex'), 0, frac);
}

function readFIXED8(hex, frac) {
  return bignum.readFIXED(new Buffer(hex, "hex"), 8, 0, frac);
}

function readFIXED12(hex, frac) {
  return bignum.readFIXED(new Buffer(hex, "hex"), 12, 0, frac);
}

function readFIXED16(hex, frac) {
  return bignum.readFIXED(new Buffer(hex, "hex"), 16, 0, frac);
}

function writeDec128(value) {
  var buffer = new Buffer(16);
  bignum.writeDec128(buffer, value, 0);
  return buffer.toString('hex');
}

function writeUInt128(value) {
  var buffer = new Buffer(16);
  bignum.writeUInt128LE(buffer, value, 0);
  return buffer.toString('hex');
}

function readUInt128(hex) {
  return bignum.readUInt128LE(new Buffer(hex, 'hex'), 0);
}

describe('Util', function () {

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
      readInt64('0000000000004000').should.equal('18014398509481984');
      readInt64('0000000000008000').should.equal('36028797018963968');
      readInt64('bd34a75e47780300').should.equal(976672856159421);

      readInt64('0100000000002000').should.equal('9007199254740993');
      readInt64('7708530509f40102').should.equal('144664982633777271');
    });

    it('write negative numbers', function () {
      'ffffffffffffffff'.should.equal(writeInt64(-1));
      'feffffffffffffff'.should.equal(writeInt64(-2));
      '00000000ffffffff'.should.equal(writeInt64(-Math.pow(2, 32)));
      '00000000ffffffff'.should.equal(writeInt64('-' + Math.pow(2, 32)));
      '000000000000f0ff'.should.equal(writeInt64(-Math.pow(2, 52)));
      '000000000000e0ff'.should.equal(writeInt64(-Math.pow(2, 53)));
      '000000000000c0ff'.should.equal(writeInt64('-18014398509481984'));
      '00000000000080ff'.should.equal(writeInt64('-36028797018963968'));
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

  describe('#UInt64', function () {

    it('read numbers', function () {
      readUInt64('0000000000000000').should.equal(0);
      readUInt64('0000000000002000').should.equal(Math.pow(2, 53));
      readUInt64('ffffffff00000000').should.equal(Math.pow(2, 32) - 1);
      readUInt64('feffffffffffffff').should.equal('18446744073709551614');
      readUInt64('ffffffffffffffff').should.equal('18446744073709551615');
      readUInt64('bd34a75e47780300').should.equal(976672856159421);
      readUInt64('7708530509f40102').should.equal('144664982633777271');
    });

    it('write numbers', function () {
      '0000000000000000'.should.equal(writeUInt64(0));
      '0000000000002000'.should.equal(writeUInt64(Math.pow(2, 53)));
      'ffffffff00000000'.should.equal(writeUInt64(Math.pow(2, 32) - 1));
      'feffffffffffffff'.should.equal(writeUInt64('18446744073709551614'));
      'ffffffffffffffff'.should.equal(writeUInt64('18446744073709551615'));
      'bd34a75e47780300'.should.equal(writeUInt64(976672856159421));
      'bd34a75e47780300'.should.equal(writeUInt64('976672856159421'));
      '7708530509f40102'.should.equal(writeUInt64('144664982633777271'));
    });
  });

  describe('#Decimal', function () {

    it('read null', function () {
      /* jshint expr: true */
      should(null === readDec128('ffffffffffffffffffffffffffffffff')).ok;
      should(null === readDec128('00000000000000000000000000000077')).ok;
      should(null === readDecFloat('00000000000000000000000000000077')).ok;
      should(null === readDecFixed('00000000000000000000000000000077')).ok;
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
      readDec128('301b0f00000000000000000000003630').should.eql({
        s: 1,
        m: 990000,
        e: -5
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
      readDec128('ff3f7a10f35a00000000000000004030').m.should.equal(99999999999999);
      readDec128('01000000000020000000000000004030').m.should.equal(
        '9007199254740993');
      readDec128('ffffffffffffffffffffffffffffffef').m.should.equal(
        '10384593717069655257060992658440191');
      readDec128('000000a1edccce1bc2d3000000000000').m.should.equal(
        '1000000000000000000000000');
    });

    it('write positive numbers', function () {
      writeDec128({
        s: 1,
        m: 99,
        e: -1
      }).should.eql('63000000000000000000000000003e30');
      writeDec128({
        s: 1,
        m: 2222,
        e: -2
      }).should.eql('ae080000000000000000000000003c30');
      writeDec128({
        s: 1,
        m: '18446744073709551615',
        e: 0
      }).should.eql('ffffffffffffffff0000000000004030');
      writeDec128({
        s: 1,
        m: '18446744073709551616',
        e: 0
      }).should.eql('00000000000000000100000000004030');
      writeDec128({
        s: 1,
        m: '18446744073709551617',
        e: 0
      }).should.eql('01000000000000000100000000004030');
      writeDec128({
        s: 1,
        m: '10000000000000000',
        e: 0
      }).should.eql('0000c16ff28623000000000000004030');
      writeDec128({
        s: 1,
        m: '10141919503094329964824243895208055',
        e: 0
      }).should.eql('7708530509f401027708530509f44130');
      writeDec128({
        s: 1,
        m: '10384593717069655257060992658440191',
        e: 8159
      }).should.eql('ffffffffffffffffffffffffffffff6f');
      writeDec128({
        s: 1,
        m: 990000,
        e: -5
      }).should.eql('301b0f00000000000000000000003630');
      writeDec128({
        s: 1,
        m: 99999999999999,
        e: 0
      }).should.eql('ff3f7a10f35a00000000000000004030');
    });

    it('write negative numbers', function () {
      writeDec128({
        s: -1,
        m: 99,
        e: -1
      }).should.eql('63000000000000000000000000003eb0');
      writeDec128({
        s: -1,
        m: 2222,
        e: -2
      }).should.eql('ae080000000000000000000000003cb0');
      writeDec128({
        s: -1,
        m: '10384593717069655257060992658440191',
        e: 8159
      }).should.eql('ffffffffffffffffffffffffffffffef');
    });

    it('read float decimal numbers', function () {
      readDecFloat('301b0f00000000000000000000003630')
        .should.equal('9.9e+0');
      readDecFloat('ffffffffffffffffffffffffffffff6f')
        .should.equal('1.0384593717069655257060992658440191e+8193');
      readDecFloat('000000000000000000000000000040b0')
        .should.equal('-0e+0');
      readDecFloat('01000000000000000000000000004030')
        .should.equal('1e+0');
      readDecFloat('01000000000000000000000000003eb0')
        .should.equal('-1e-1');
    });

    it('read fixed decimal numbers', function () {
      readDecFixed('301b0f00000000000000000000003630', 10)
        .should.equal('9.9000000000');
      readDecFixed('301b0f00000000000000000000003e30', 3)
        .should.equal('99000.000');
      readDecFixed('301b0f00000000000000000000003630', 5)
        .should.equal('9.90000');
      readDecFixed('301b0f00000000000000000000003630', 1)
        .should.equal('9.9');
      readDecFixed('301b0f00000000000000000000003630', 3)
        .should.equal('9.900');
      readDecFixed('7708530509f401027708530509f44130', 0)
        .should.equal('10141919503094329964824243895208055');
      readDecFixed('000000000000000000000000000040b0', 2)
        .should.equal('-0.00');
      readDecFixed('01000000000000000000000000004230', 2)
        .should.equal('10.00');
      readDecFixed('01000000000000000000000000003eb0', 2)
        .should.equal('-0.10');
      readDecFixed('01000000000000000000000000003a30', 3)
        .should.equal('0.001');
    });

  });

  describe('#UInt128', function () {

    it('should write numbers', function () {
      writeUInt128('340282366920938463463374607431768211455').should.equal(
        'ffffffffffffffffffffffffffffffff'
      );
      writeUInt128('18446744073709551614').should.equal(
        'feffffffffffffff0000000000000000'
      );
      writeUInt128('18446744073709551615').should.equal(
        'ffffffffffffffff0000000000000000'
      );
      writeUInt128('18446744073709551616').should.equal(
        '00000000000000000100000000000000'
      );
      writeUInt128('18446744073709551617').should.equal(
        '01000000000000000100000000000000'
      );
      writeUInt128('1').should.equal(
        '01000000000000000000000000000000'
      );
      writeUInt128('100000000').should.equal(
        '00e1f505000000000000000000000000'
      );
      writeUInt128('10000000000000000').should.equal(
        '0000c16ff28623000000000000000000'
      );
      writeUInt128('1000000000000000000000000').should.equal(
        '000000a1edccce1bc2d3000000000000'
      );
      writeUInt128('4294967296').should.equal(
        '00000000010000000000000000000000'
      );
    });

    it('should read numbers', function () {
      readUInt128(
        'ffffffffffffffffffffffffffffffff'
      ).should.equal('340282366920938463463374607431768211455');
      readUInt128(
        '00000000000000000000000001000000'
      ).should.equal('79228162514264337593543950336');
      readUInt128(
        '00000000000000000100000000000000'
      ).should.equal('18446744073709551616');
      readUInt128(
        '01000000000000000000000000000000'
      ).should.equal(1);
      readUInt128(
        '00e1f505000000000000000000000000'
      ).should.equal(100000000);
      readUInt128(
        '0000c16ff28623000000000000000000'
      ).should.equal('10000000000000000');
      readUInt128(
        '000000a1edccce1bc2d3000000000000'
      ).should.equal('1000000000000000000000000');
      readUInt128(
        'feffffffffffffff0000000000000000'
      ).should.equal('18446744073709551614');
      readUInt128(
        'ffffffffffffffff0000000000000000'
      ).should.equal('18446744073709551615');

      readUInt128(
        '01000000000000000100000000000000'
      ).should.equal('18446744073709551617');
      readUInt128(
        '00000000010000000000000000000000'
      ).should.equal(4294967296);
      readUInt128(
        'ffffffff000000000000000000000000'
      ).should.equal(4294967295);
    });

  });

  describe('#Fixed8/12/16 (Decimal)', function () {
    it('should read zero', function () {
      readFIXED8('0000000000000000', 18).should.eql('0.000000000000000000');
      readFIXED12('000000000000000000000000', 23).should.eql('0.00000000000000000000000');
      readFIXED16('00000000000000000000000000000000', 32).should.eql('0.00000000000000000000000000000000');
    });

    it('should read positive numbers', function () {
      readFIXED8('64c0600700000000', 2).should.eql('1237812.20');
      readFIXED8('82f3d3a5440b0000', 9).should.eql('12389.467812738');
      readFIXED8('7ca35aded929b801', 9).should.eql('123895005.467812732');
      readFIXED12('00002836bbdf0cb243000000', 0).should.eql('1248761728372172128256');
      readFIXED12('1402d88a8ea33bf6a4020000', 5).should.eql('124877419488172231.89012');
      readFIXED12('03e3b5b91f9bfe0ad92f0000', 31).should.eql('0.0000000225954960400013323526915');
      readFIXED16('2a609b4e579f6a1e9b6bcbda88365577', 4).should.eql('15862058282424280059121667078237633.7450');
      readFIXED16('ffffffffffffffffffffffffffffff7f', 8).should.eql('1701411834604692317316873037158.84105727');
      readFIXED16('02000000000000000000000000000000', 21).should.eql('0.000000000000000000002');
    });

    it('should read negative numbers', function () {
      readFIXED8('0037d3fdffffffff', 3).should.eql('-36489.472');
      readFIXED8('0000008afdffffff', 5).should.eql('-105696.46080');
      readFIXED8('7249fd55efe1adf2', 11).should.eql('-9598627.27503951502');
      readFIXED8('151897daffffffff', 12).should.eql('-0.000627632107');
      readFIXED12('1eabe45e3d1ba8f305cb60e1', 5).should.eql('-94770196755916367254674.03490');
      readFIXED12('00000000ab96a7e01dffffff', 17).should.eql('-41712.22831685278105600');
      readFIXED12('c702e1f482fe9dd315ffffff', 22).should.eql('-0.4319736233569990671673');
      readFIXED16('ce8c7580d137e942e72fcc885a55f89c', 16).should.eql('-13163337877988720494258.0388155611575090');
      readFIXED16('00000000000000000000000000000080', 29).should.eql('-1701411834.60469231731687303715884105728');
      readFIXED16('ffffffffffffffffffffffffffffffff', 0).should.eql('-1');
    });
  });

});