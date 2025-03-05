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
/* jshint expr:true */

var should = require('should');
var lib = require('../lib');
var LobOptions = lib.common.LobOptions;
var LobSourceType = lib.common.LobSourceType;
var bignum = lib.util.bignum;
var lobFactoy = {
  createLob: function createLob(ld) {
    return ld;
  }
};

function createLobBuffer(locatorId, chunk, encoding) {
  /* jshint bitwise:false */
  var buffer, sourceType;
  switch (encoding) {
    case 'utf8':
    case 'utf-8':
      sourceType = LobSourceType.NCLOB;
      break;
    case 'ascii':
      sourceType = LobSourceType.CLOB;
      break;
    default:
      sourceType = LobSourceType.BLOB;
      break;
  }
  if (!chunk || !chunk.length) {
    buffer = new Buffer(2);
    buffer[0] = sourceType;
    buffer[1] = LobOptions.NULL_INDICATOR;
    return buffer;
  }
  buffer = new Buffer(32 + chunk.length);
  buffer[0] = sourceType;
  buffer[1] = LobOptions.DATA_INCLUDED | LobOptions.LAST_DATA;
  buffer[2] = buffer[3] = 0;
  var charLength = encoding ? chunk.toString(encoding).length : 0;
  bignum.writeInt64LE(buffer, charLength, 4);
  bignum.writeInt64LE(buffer, chunk.length, 12);
  locatorId.copy(buffer, 20);
  buffer.writeInt32LE(chunk.length, 28);
  chunk.copy(buffer, 32);
  return buffer;
}

describe('Lib', function () {

  describe('#Reader', function () {

    it('should read a TinyInt', function () {
      var len = 1;
      var offset = 0;
      var buffer = new Buffer(1 + (2 * (len + 1)));
      // null
      buffer[offset++] = 0;
      // 1
      buffer[offset++] = 1;
      buffer.writeUInt8(1, offset);
      offset += len;
      // 255
      buffer[offset++] = 1;
      buffer.writeUInt8(255, offset);
      offset += len;
      var reader = new lib.Reader(buffer);
      should(reader.readTinyInt() === null).ok;
      reader.hasMore().should.equal(true);
      reader.readTinyInt().should.equal(1);
      reader.hasMore().should.equal(true);
      reader.readTinyInt().should.equal(255);
      reader.hasMore().should.equal(false);
    });


    it('should read a SmallInt', function () {
      var len = 2;
      var offset = 0;
      var buffer = new Buffer(1 + (2 * (len + 1)));
      // null
      buffer[offset++] = 0;
      // -1
      buffer[offset++] = 1;
      buffer.writeInt16LE(-1, offset);
      offset += len;
      // 256
      buffer[offset++] = 1;
      buffer.writeInt16LE(256, offset);
      offset += len;
      var reader = new lib.Reader(buffer);
      should(reader.readSmallInt() === null).ok;
      reader.readSmallInt().should.equal(-1);
      reader.readSmallInt().should.equal(256);
      reader.hasMore().should.equal(false);
    });

    it('should read a Int', function () {
      var len = 4;
      var offset = 0;
      var buffer = new Buffer(1 + (2 * (len + 1)));
      // null
      buffer[offset++] = 0;
      // -1
      buffer[offset++] = 1;
      buffer.writeInt32LE(-1, offset);
      offset += len;
      // 32754
      buffer[offset++] = 1;
      buffer.writeInt32LE(32754, offset);
      offset += len;
      var reader = new lib.Reader(buffer);
      should(reader.readInt() === null).ok;
      reader.readInt().should.equal(-1);
      reader.readInt().should.equal(32754);
      reader.hasMore().should.equal(false);
    });

    it('should read a BigInt', function () {
      var len = 8;
      var offset = 0;
      var buffer = new Buffer(1 + (2 * (len + 1)));
      // null
      buffer[offset++] = 0;
      // -1
      buffer[offset++] = 1;
      bignum.writeInt64LE(buffer, -1, offset);
      offset += len;
      // 9007199254740992
      buffer[offset++] = 1;
      bignum.writeInt64LE(buffer, 9007199254740992, offset);
      offset += len;
      var reader = new lib.Reader(buffer);
      should(reader.readBigInt() === null).ok;
      reader.readBigInt().should.equal(-1);
      reader.readBigInt().should.equal(9007199254740992);
      reader.hasMore().should.equal(false);
    });

    it('should read a Double', function () {
      var buffer = new Buffer([
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x7f,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0xff,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf1, 0x7f,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x3f
      ]);
      var reader = new lib.Reader(buffer);
      should(reader.readDouble() === null).ok;
      reader.readDouble().should.equal(Number.POSITIVE_INFINITY);
      reader.readDouble().should.equal(Number.NEGATIVE_INFINITY);
      isNaN(reader.readDouble()).should.be.ok;
      reader.readDouble().should.equal(1);
      reader.hasMore().should.equal(false);
    });

    it('should read a Float', function () {
      var buffer = new Buffer([
        0xff, 0xff, 0xff, 0xff,
        0x00, 0x00, 0x80, 0x7f,
        0x00, 0x00, 0x80, 0xff,
        0x00, 0x00, 0x81, 0x7f,
        0x00, 0x00, 0x80, 0x3f
      ]);
      var reader = new lib.Reader(buffer);
      should(reader.readFloat() === null).ok;
      reader.readFloat().should.equal(Number.POSITIVE_INFINITY);
      reader.readFloat().should.equal(Number.NEGATIVE_INFINITY);
      isNaN(reader.readFloat()).should.be.ok;
      reader.readFloat().should.equal(1);
      reader.hasMore().should.equal(false);
    });

    it('should read a Decimal', function () {
      var buffer = new Buffer(32);
      buffer.fill(0x00);
      buffer[15] = 0x70;
      buffer[16] = 0x01;
      buffer[30] = 0x40;
      buffer[31] = 0x30;
      var reader = new lib.Reader(buffer);
      should(reader.readDecimal(0) === null).ok;
      reader.readDecimal(35).should.equal('1e+0');
      reader.hasMore().should.equal(false);
    });

    it('should read a FIXED8', function () {
      var buffer = new Buffer([
        0x00,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0xc5, 0x38, 0xd2, 0xff, 0xff, 0xff, 0xff, 0xff,
        0x01, 0x7d, 0xf1, 0x77, 0x5b, 0xf9, 0x96, 0xe5, 0x02,
        0x01, 0x5a, 0xfd, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff
      ]);
      var reader = new lib.Reader(buffer);
      should(reader.readFixed8(0) === null).ok;
      reader.readFixed8(6).should.equal('0.000000');
      reader.readFixed8(3).should.equal('-3000.123');
      reader.readFixed8(4).should.equal('20873895546820.6461');
      reader.readFixed8(5).should.equal('-0.00678');
      reader.hasMore().should.equal(false);
    });

    it('should read a FIXED12', function () {
      var buffer = new Buffer([
        0x00,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x27, 0xc2, 0x40, 0x3c, 0x0e, 0x79, 0xfe, 0xb9, 0x2f, 0xbf, 0x8b, 0x0a,
        0x01, 0x00, 0xf2, 0x0d, 0xb2, 0x3f, 0x8a, 0x5f, 0x57, 0x9a, 0x28, 0x8a, 0x07,
        0x01, 0xeb, 0x32, 0xa4, 0xf8, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
      ]);
      var reader = new lib.Reader(buffer);
      should(reader.readFixed12(0) === null).ok;
      reader.readFixed12(6).should.equal('0.000000');
      reader.readFixed12(15).should.equal('3263793639537.366352265265703');
      reader.readFixed12(25).should.equal('233.3418573610039254524490240');
      reader.readFixed12(15).should.equal('-0.000000123456789');
      reader.hasMore().should.equal(false);
    });

    it('should read a FIXED16', function () {
      var buffer = new Buffer([
        0x00,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x9e, 0x5f, 0x70, 0x5c, 0x9c, 0x3a, 0xf1, 0xd2, 0xba, 0xa3, 0x00, 0x20, 0x3e, 0xaf, 0xc8, 0x07,
        0x01, 0xc9, 0x13, 0xbc, 0x33, 0x1d, 0x99, 0xd0, 0x6a, 0x6a, 0x4b, 0xba, 0xeb, 0xfa, 0xc8, 0xfc, 0xfe,
        0x01, 0xa0, 0x53, 0x78, 0xdb, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
      ]);
      var reader = new lib.Reader(buffer);
      should(reader.readFixed16(0) === null).ok;
      reader.readFixed16(6).should.equal('0.000000');
      reader.readFixed16(11).should.equal('103466096859323850690600125.78438143902');
      reader.readFixed16(31).should.equal('-134592.0821303502632246421882052799543');
      reader.readFixed16(20).should.equal('-0.00000000000612871264');
      reader.hasMore().should.equal(false);
    });

    it('should read a String in utf-8 encoding', function () {
      var buffer = new Buffer([0xff, 4, 0xF0, 0xA4, 0xAD, 0xA2]);
      var reader = new lib.Reader(buffer);
      should(reader.readString() === null).ok;
      reader.readString().should.equal('𤭢');
      reader.hasMore().should.equal(false);
    });

    it('should read a String in cesu-8 encoding', function () {
      var buffer = new Buffer([0xff, 6, 0xed, 0xa0, 0xbc, 0xed, 0xbd, 0xa8]);
      var reader = new lib.Reader(buffer, null, { useCesu8: true });
      should(reader.readString() === null).ok;
      reader.readString().should.equal('🍨');
      reader.hasMore().should.equal(false);
    });

    it('should read a Binary', function () {
      var buffer = new Buffer([0xff, 4, 0xF0, 0xA4, 0xAD, 0xA2]);
      var reader = new lib.Reader(buffer);
      should(reader.readBinary() === null).ok;
      reader.readBinary().should.eql(buffer.slice(2));
      reader.hasMore().should.equal(false);
    });

    it('should read 255 Bytes', function () {
      var len = 255;
      var buffer = new Buffer(len + 3);
      buffer[0] = 0xf6;
      buffer.writeInt16LE(len, 1);
      var reader = new lib.Reader(buffer);
      reader.readBinary().should.eql(buffer.slice(3));
      reader.hasMore().should.equal(false);
    });

    it('should read 32787 Bytes', function () {
      var len = 32787;
      var buffer = new Buffer(len + 5);
      buffer[0] = 0xf7;
      buffer.writeInt32LE(len, 1);
      var reader = new lib.Reader(buffer);
      reader.readBinary().should.eql(buffer.slice(5));
      reader.hasMore().should.equal(false);
    });

    it('should read a Date', function () {
      var buffer = new Buffer([
        0xff, 0x7f, 0x00, 0x00,
        0x01, 0x80, 0x00, 0x01,
        0x0f, 0xa7, 0x0b, 0x1f
      ]);
      var reader = new lib.Reader(buffer);
      should(reader.readDate() === null).ok;
      reader.readDate().should.equal('0001-01-01');
      reader.readDate().should.equal('9999-12-31');
      reader.hasMore().should.equal(false);
    });

    it('should read a Time', function () {
      var buffer = new Buffer([
        0x7f, 0xff, 0x00, 0x00,
        0x81, 0x01, 0xe8, 0x03
      ]);
      var reader = new lib.Reader(buffer);
      should(reader.readTime() === null).ok;
      reader.readTime().should.equal('01:01:01');
      reader.hasMore().should.equal(false);
    });

    it('should read a Timestamp', function () {
      var buffer = new Buffer([
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x81, 0x01, 0xe8, 0x03,
        0xde, 0x87, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
        0xde, 0x87, 0x00, 0x01, 0x81, 0x01, 0xe8, 0x03
      ]);
      var reader = new lib.Reader(buffer);
      should(reader.readTimestamp() === null).ok;
      reader.readTimestamp().should.equal('0001-01-01T01:01:01');
      reader.readTimestamp().should.equal('2014-01-01T00:00:00');
      reader.readTimestamp().should.equal('2014-01-01T01:01:01');
      reader.hasMore().should.equal(false);
    });

    it('should read a DayDate', function () {
      var buffer = new Buffer([
        0x00, 0x00, 0x00, 0x00,
        0xde, 0xb9, 0x37, 0x00,
        0x01, 0x00, 0x00, 0x00,
        0x02, 0x00, 0x00, 0x00,
        0x31, 0x45, 0x0B, 0x00,
        0xDD, 0xB9, 0x37, 0x00

      ]);
      var reader = new lib.Reader(buffer);
      should(reader.readDayDate() === null).ok;
      should(reader.readDayDate() === null).ok;
      reader.readDayDate().should.equal('0001-01-01');
      reader.readDayDate().should.equal('0001-01-02');
      reader.readDayDate().should.equal('2023-03-28');
      reader.readDayDate().should.equal('9999-12-31');
      reader.hasMore().should.equal(false);
    });

    it('should read a SecondTime', function () {
      var buffer = new Buffer([
        0x00, 0x00, 0x00, 0x00,
        0x82, 0x51, 0x01, 0x00,
        0x01, 0x00, 0x00, 0x00,
        0x02, 0x00, 0x00, 0x00,
        0x8A, 0xA1, 0x00, 0x00,
        0x80, 0x51, 0x01, 0x00,
      ]);
      var reader = new lib.Reader(buffer);
      should(reader.readSecondTime() === null).ok;
      should(reader.readSecondTime() === null).ok;
      reader.readSecondTime().should.equal('00:00:00');
      reader.readSecondTime().should.equal('00:00:01');
      reader.readSecondTime().should.equal('11:29:13');
      reader.readSecondTime().should.equal('23:59:59');
      reader.hasMore().should.equal(false);
    });

    it('should read a SecondDate', function () {
      var buffer = new Buffer([
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x81, 0xD8, 0x88, 0x77, 0x49, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x81, 0x51, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x86, 0xB6, 0xB7, 0xDB, 0x0E, 0x00, 0x00, 0x00,
        0x80, 0xDB, 0x88, 0x77, 0x49, 0x00, 0x00, 0x00,
      ]);
      var reader = new lib.Reader(buffer);
      should(reader.readSecondDate() === null).ok;
      should(reader.readSecondDate() === null).ok;
      reader.readSecondDate().should.equal('0001-01-01 00:00:00');
      reader.readSecondDate().should.equal('0001-01-01 00:00:01');
      reader.readSecondDate().should.equal('0001-01-02 00:00:00');
      reader.readSecondDate().should.equal('2023-03-28 16:57:41');
      reader.readSecondDate().should.equal('9999-12-31 23:59:59');
      reader.hasMore().should.equal(false);
    });

    it('should read a LongDate', function () {
      var buffer = new Buffer([
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0xC0, 0x0A, 0x49, 0x08, 0x2A, 0xCA, 0x2B,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x81, 0x96, 0x98, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x39, 0x92, 0xE7, 0x9E, 0xDB, 0xA7, 0xD7, 0x08,
        0x00, 0xC0, 0x0A, 0x49, 0x08, 0x2A, 0xCA, 0x2B,
      ]);
      var reader = new lib.Reader(buffer);
      (reader.readLongDate() === null).should.be.ok;
      (reader.readLongDate() === null).should.be.ok;
      reader.readLongDate().should.equal('0001-01-01 00:00:00.000000000');
      reader.readLongDate().should.equal('0001-01-01 00:00:00.000000100');
      reader.readLongDate().should.equal('0001-01-01 00:00:01.000000000');
      reader.readLongDate().should.equal('2020-01-31 12:30:00.186732000');
      reader.readLongDate().should.equal('9999-12-31 23:59:59.999999900');
      reader.hasMore().should.equal(false);
    });

    it('should read an Alphanum', function () {
      var buffer = new Buffer([
        0xFF,
        0x07, 0x06, 0x61, 0x62, 0x63, 0x31, 0x32, 0x33,
        0x04, 0x86, 0x31, 0x32, 0x33,
        0x07, 0x86, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36
      ]);
      var reader = new lib.Reader(buffer);
      (reader.readAlphanum() === null).should.be.ok;
      reader.readAlphanum().should.equal('abc123');
      reader.readAlphanum().should.equal('000123');
      reader.readAlphanum().should.equal('123456');
      reader.hasMore().should.equal(false);
    });

    it('should read a Boolean', function () {
      var buffer = new Buffer([
        0x01,
        0x00,
        0x02,
      ]);
      var reader = new lib.Reader(buffer);
      (reader.readBoolean() === null).should.be.ok;
      reader.readBoolean().should.equal(false);
      reader.readBoolean().should.equal(true);
      reader.hasMore().should.equal(false);
    });

    it('should read a REAL_VECTOR', function () {
      var buffer = new Buffer([
        0xFF,
        0x08, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x10, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x7A, 0x44, 0x00, 0x00, 0xFA, 0xC4, 0x00, 0x80, 0x3B, 0x45,
        0x10, 0x03, 0x00, 0x00, 0x00, 0xBB, 0xEF, 0x66, 0xC2, 0x5A, 0x36, 0x0C, 0xC9, 0x21, 0xF0, 0xD9, 0x3A,
        0x14, 0x04, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x7F, 0xFF, 0x00, 0x00, 0x80, 0x00, 0xFF, 0xFF, 0x7F, 0x7F, 0x00, 0x00, 0x80, 0x80
      ]);
      var reader = new lib.Reader(buffer, null, { vectorOutputType: 'Array' });
      (reader.readRealVector() === null).should.be.ok;
      var expected = [[0], [1000, -2000, 3000], [-57.73411178588867, -574309.625, 0.0016627350123599172],
      [-3.4028234663852886e+38, 1.1754943508222875e-38, 3.4028234663852886e+38, -1.1754943508222875e-38]];
      for (var i = 0; i < expected.length; i++) {
        var result = reader.readRealVector();
        result.should.have.length(expected[i].length);
        result.should.eql(expected[i]);
      }
      reader.hasMore().should.equal(false);
    });

    it('should read a HALF_VECTOR', function () {
      var buffer = new Buffer([
        0xFF,
        0x06, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x0A, 0x03, 0x00, 0x00, 0x00, 0xD0, 0xE3, 0xD0, 0x67, 0xDC, 0xE9,
        0x0C, 0x04, 0x00, 0x00, 0x00, 0x84, 0xF5, 0x33, 0x60, 0x4D, 0x97, 0xC9, 0x3C,
        0x12, 0x07, 0x00, 0x00, 0x00, 0x01, 0x00, 0xFF, 0x83, 0x00, 0x04, 0x00, 0x3C, 0x00, 0xBC, 0xFF, 0x7B, 0xFF, 0xFB,
      ]);
      var reader = new lib.Reader(buffer, null, { vectorOutputType: 'Array' });
      (reader.readHalfVector() === null).should.be.ok;
      var expected = [[0], [-1000, 2000, -3000], [-22592, 537.5, -0.0017824172973632812, 1.1962890625],
      [5.960464477539063e-8, -0.00006097555160522461, 0.00006103515625, 1, -1, 65504, -65504]];
      for (var i = 0; i < expected.length; i++) {
        var result = reader.readHalfVector();
        result.should.have.length(expected[i].length);
        result.should.eql(expected[i]);
      }
      reader.hasMore().should.equal(false);
    });
  });

  it('should read a BLob', function () {
    /* jshint bitwise:false */
    var locatorId = new Buffer([1, 0, 0, 0, 0, 0, 0, 0]);
    var chunk = new Buffer([1, 2, 3, 4, 5, 6, 7, 8]);
    var buffer = createLobBuffer(locatorId, chunk);
    var reader = new lib.Reader(buffer, lobFactoy);
    var lob = reader.readBLob();
    lob.locatorId.should.eql(locatorId);
    lob.options.should.equal(LobOptions.DATA_INCLUDED | LobOptions.LAST_DATA);
    lob.chunk.should.eql(chunk);
    lob.charLength.should.equal(0);
    lob.byteLength.should.equal(chunk.length);
  });

  it('should read a CLob', function () {
    /* jshint bitwise:false */
    var locatorId = new Buffer([1, 0, 0, 0, 0, 0, 0, 0]);
    var chunk = new Buffer('12345678', 'ascii');
    var buffer = createLobBuffer(locatorId, chunk, 'ascii');
    var reader = new lib.Reader(buffer, lobFactoy);
    var lob = reader.readCLob();
    lob.locatorId.should.eql(locatorId);
    lob.options.should.equal(LobOptions.DATA_INCLUDED | LobOptions.LAST_DATA);
    lob.chunk.should.eql(chunk);
    lob.charLength.should.equal(chunk.length);
    lob.byteLength.should.equal(chunk.length);
  });

  it('should have type and defaultType', function () {
    /* jshint bitwise:false */
    var locatorId = new Buffer([1, 0, 0, 0, 0, 0, 0, 0]);
    var chunk = new Buffer('12345678', 'ascii');
    var buffer = createLobBuffer(locatorId, chunk, 'ascii');
    var reader = new lib.Reader(buffer, lobFactoy);
    var lob = reader.readNCLob()
    lob.type.should.eql(LobSourceType.CLOB);
    lob.defaultType.should.eql(LobSourceType.NCLOB);
  });

});
