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
var TypeCode = lib.common.TypeCode;
var Writer = lib.Writer;
var EventEmitter = require('events').EventEmitter;

var data = require('./fixtures/parametersData');
var lorem = require('./fixtures/lorem');
var SIZE = data.MAX_PART_SIZE;

describe('Lib', function () {

  describe('#Writer', function () {

    it('should write default parameters', function (done) {
      var test = data.DEFAULT;
      var writer = Writer.create(test);
      writer.getParameters(SIZE, function (err, buffer) {
        if (err) {
          return done(err);
        }
        buffer.should.eql(test.part.buffer);
        done();
      });
    });

    it('should write all types', function (done) {
      var test = data.ALL_TYPES;
      var writer = Writer.create(test);
      writer.getParameters(SIZE, function (err, buffer) {
        if (err) {
          return done(err);
        }
        buffer.should.eql(test.part.buffer);
        done();
      });
    });

    it('should write a string in cesu-8 encoding when useCesu8 is enabled', function (done) {
      var test = data.EMOJI;
      var writer = Writer.create(test, true);
      writer.getParameters(SIZE, function (err, buffer) {
        if (err) {
          return done(err);
        }
        buffer.should.eql(test.part.buffer);
        done();
      });
    });

    it('should write binary types', function (done) {
      var test = data.BINARY;
      var writer = Writer.create(test);
      writer.getParameters(SIZE, function (err, buffer) {
        if (err) {
          return done(err);
        }
        buffer.should.eql(test.part.buffer);
        done();
      });
    });

    it('should write a BLOB', function (done) {
      var test = data.LOGO;
      var writer = Writer.create(test);
      writer.getParameters(SIZE, function (err, buffer) {
        if (err) {
          return done(err);
        }
        buffer.should.eql(test.part.buffer);
        writer.finished.should.equal(false);
        writer._lobs.should.have.length(1);
        var stream = writer._lobs[0];
        stream._readableState.should.have.length(6054);

        var locatorId = new Buffer('0100000000000000', 'hex');
        writer.update([locatorId]);

        writer.getWriteLobRequest(SIZE, function (err, part) {
          if (err) {
            return done(err);
          }
          part.buffer.should.have.length(SIZE);
          var exp = new Buffer(
            '0100000000000000020000000000000000eb030000',
            'hex');
          part.buffer.slice(0, 21).should.eql(exp);
          done();
        });
      });
    });

    it('should get WriteLobRequest', function (done) {
      var writer = new Writer([TypeCode.BLOB]);
      var stream = new lib.util.stream.Readable();
      stream._chunks = [
        new Buffer('Lorem ', 'ascii'),
        new Buffer('ipsum ', 'ascii'),
        new Buffer('dolor ', 'ascii'),
        new Buffer('sit ', 'ascii'),
        new Buffer('amet.', 'ascii'),
        null
      ];
      stream._read = function () {
        this.push(this._chunks.shift());
      };
      writer._lobs.push(stream);
      stream._locatorId = new Buffer([1, 2, 3, 4, 5, 6, 7, 8]);
      writer.getWriteLobRequest(1024, function (err, part) {
        if (err) {
          return done(err);
        }
        part.buffer.should.have.length(48);
        part.buffer.slice(0, 8).should.eql(stream._locatorId);
        part.buffer[8].should.eql(6);
        part.buffer.readUInt32LE(17).should.equal(27);
        part.buffer.slice(21).toString('ascii').should.equal(
          'Lorem ipsum dolor sit amet.');
        done();
      });
    });

    it('should propertly round DATETIME ms value', function() {
      var writer = new Writer([TypeCode.TIMESTAMP]);
      var dt = '2018-05-17T12:38:02.002Z';
      writer.setValues([dt]);
      writer._buffers[0][7].should.equal(210);
    });

    it('should propertly round TIME ms value', function() {
      var writer = new Writer([TypeCode.TIME]);
      var dt = '12:38:02.002Z';
      writer.setValues([dt]);
      writer._buffers[0][3].should.equal(210);
    });

    it('should set a BLOB value', function () {
      var writer = new Writer([TypeCode.BLOB]);
      var buf = new Buffer([0x48, 0x4B]);
      // write buffer
      writer.setValues([buf]);
      writer.length.should.equal(10);
      writer._lobs[0].read().should.eql(buf);
      // write Readable
      var readable = new lib.util.stream.Readable();
      readable._buffer = buf;
      readable._read = function () {
        this.push(this._buffer);
        this._buffer = null;
      };
      writer.setValues([readable]);
      writer.length.should.equal(10);
      writer._lobs[0].read().should.eql(buf);
      // write Stream
      var stream = new EventEmitter();
      stream.readable = true;
      writer.setValues([stream]);
      stream.emit('data', buf);
      stream.emit('end');
      writer.length.should.equal(10);
      writer._lobs[0].read().should.eql(buf);
    });

    it('should set a CLOB value', function () {
      var writer = new Writer([TypeCode.CLOB]);
      var buf = new Buffer('EUR', 'ascii');
      // write buffer
      writer.setValues([buf]);
      writer.length.should.equal(10);
      writer._lobs[0].read().should.eql(buf);
      // write string
      writer.setValues([buf.toString('ascii')]);
      writer.length.should.equal(10);
      writer._lobs[0].read().should.eql(buf);
    });

    it('should set a NCLOB value', function () {
      var writer = new Writer([TypeCode.NCLOB]);
      var buf = new Buffer([0xe2, 0x82, 0xac]);
      // write buffer
      writer.setValues([buf]);
      writer.length.should.equal(10);
      writer._lobs[0].read().should.eql(buf);
      // write string
      writer.setValues([buf.toString('utf8')]);
      writer.length.should.equal(10);
      writer._lobs[0].read().should.eql(buf);
    });

    it('should set a STRING value', function () {
      var writer = new Writer([TypeCode.STRING]);
      var value, length;
      // tiny
      value = 'tiny';
      length = Buffer.byteLength(value, 'ascii');
      writer.setValues([value]);
      writer.length.should.equal(length + 2);
      writer._buffers[0][1].should.equal(length);
      // short
      length = lorem.SHORT.length;
      value = lorem.SHORT.toString('ascii');
      writer.setValues([value]);
      writer.length.should.equal(length + 4);
      writer._buffers[0][1].should.equal(246);
      // long
      length = lorem.LONG.length;
      value = lorem.LONG.toString('ascii');
      writer.setValues([value]);
      writer.length.should.equal(length + 6);
      writer._buffers[0][1].should.equal(247);
      // unicode char
      value = 'ä';
      length = value.length;
      writer.setValues([value]);
      writer.length.should.equal(4); 
      writer._buffers[0][2].should.equal(0xC3);
      writer._buffers[0][3].should.equal(0xA4);
    });

    it('should set a BINARY value', function () {
      var writer = new Writer([TypeCode.BINARY]);
      var value, length;
      // tiny
      value = new Buffer('tiny', 'ascii');
      length = value.length;
      writer.setValues([value]);
      writer.length.should.equal(length + 2);
      writer._buffers[0][1].should.equal(length);
      // short
      value = lorem.SHORT;
      length = value.length;
      writer.setValues([value]);
      writer.length.should.equal(length + 4);
      writer._buffers[0][1].should.equal(246);
      // long
      value = lorem.LONG;
      length = value.length;
      writer.setValues([value]);
      writer.length.should.equal(length + 6);
      writer._buffers[0][1].should.equal(247);
    });

    it('should get Parameters where buffer excatly fits', function (
      done) {
      var writer = new Writer([TypeCode.BLOB]);
      var stream = new lib.util.stream.Readable();
      var buffer = new Buffer('blob', 'ascii');
      var size = 10 + buffer.length;
      stream.push(buffer);
      stream.push(null);
      writer.setValues([stream]);
      writer.getParameters(size, function (err, buffer) {
        buffer.should.have.length(size);
        buffer.slice(10).toString('ascii').should.equal(
          'blob');
        EventEmitter.listenerCount(stream, 'readable').should
          .equal(0);
        EventEmitter.listenerCount(stream, 'error').should.equal(
          0);
        EventEmitter.listenerCount(stream, 'end').should.equal(
          0);
        done();
      });
    });

    it('should get WriteLobRequest where buffer excatly fits',
      function (
        done) {
        var writer = new Writer([TypeCode.BLOB]);
        var stream = new lib.util.stream.Readable();
        var buffer = new Buffer('blob', 'ascii');
        var size = 21 + buffer.length;
        stream.push(buffer);
        stream.push(null);
        stream._locatorId = new Buffer([1, 2, 3, 4, 5, 6, 7, 8]);
        writer._lobs.push(stream);
        writer.getWriteLobRequest(size, function (err, part) {
          part.argumentCount.should.equal(1);
          part.buffer.should.have.length(size);
          part.buffer.slice(21).toString('ascii').should.equal(
            'blob');
          EventEmitter.listenerCount(stream, 'readable').should
            .equal(0);
          EventEmitter.listenerCount(stream, 'error').should.equal(
            0);
          EventEmitter.listenerCount(stream, 'end').should.equal(
            0);
          done();
        });
      });

    it('should emit a stream error while getting Parameters',
      function (done) {
        var streamError = new Error('stream error');
        var writer = new Writer([TypeCode.BLOB]);
        var stream = new EventEmitter();
        stream.readable = true;
        writer.setValues([stream]);
        writer.getParameters(64, function (err) {
          streamError.should.equal(err);
          done();
        });
        stream.emit('error', streamError);
      });

    it('should emit an internal error while getting Parameters',
      function (done) {
        var writer = new Writer([TypeCode.BLOB]);
        var stream = new lib.util.stream.Readable();
        stream.read = function (size) {
          return new Buffer(size + 1);
        };
        writer.setValues([stream]);
        writer.getParameters(64, function (err) {
          /* jshint expr: true */
          should(err).be.ok;
          done();
        });
      });

    it('should emit a stream error while getting WriteLobRequest',
      function (done) {
        var streamError = new Error('stream error');
        var writer = new Writer([TypeCode.BLOB]);
        var stream = new EventEmitter();
        stream._locatorId = new Buffer([1, 2, 3, 4, 5, 6, 7, 8]);
        stream.read = function () {
          return null;
        };
        writer._lobs.push(stream);
        writer.getWriteLobRequest(64, function (err) {
          streamError.should.equal(err);
          done();
        });
        stream.emit('error', streamError);
      });

    it('should emit an internal error while getting WriteLobRequest',
      function (done) {
        var writer = new Writer([TypeCode.BLOB]);
        var stream = new EventEmitter();
        stream._locatorId = new Buffer([1, 2, 3, 4, 5, 6, 7, 8]);
        stream.read = function (size) {
          return new Buffer(size + 1);
        };
        writer._lobs.push(stream);
        writer.getWriteLobRequest(64, function (err) {
          /* jshint expr: true */
          should(err).be.ok;
          done();
        });
      });

    ['TINYINT', 'SMALLINT', 'INT', 'BIGINT', 'REAL', 'DOUBLE', 'BINARY'].forEach(function (type) {
      it('should raise wrong input type error for ' + type, function () {
        var writer = new Writer([TypeCode[type]]);
        Writer.prototype.setValues.bind(writer, 'wrong').should.throw();
      });
    });

    it('should raise wrong input type error for LOB', function () {
      var writer = new Writer([TypeCode.CLOB]);
      Writer.prototype.setValues.bind(writer, [false]).should.throw();
    });

    it('should raise wrong input type error for DECIMAL', function () {
      var writer = new Writer([TypeCode.DECIMAL]);
      Writer.prototype.setValues.bind(writer, [false]).should.throw();
      // Regex does not match
      Writer.prototype.setValues.bind(writer, ['1^6']).should.throw();
    });

    it('should raise wrong input type error for DATE', function () {
      var writer = new Writer([TypeCode.DATE]);
      Writer.prototype.setValues.bind(writer, [false]).should.throw();
      // Regex does not match
      Writer.prototype.setValues.bind(writer, ['2014+10+11']).should
        .throw();
    });

    it('should raise wrong input type error for TIME', function () {
      var writer = new Writer([TypeCode.TIME]);
      Writer.prototype.setValues.bind(writer, [false]).should.throw();
      // Regex does not match
      Writer.prototype.setValues.bind(writer, ['12.00.00']).should
        .throw();
    });

    it('should raise wrong input type error for TIMESTAMP', function () {
      var writer = new Writer([TypeCode.TIMESTAMP]);
      Writer.prototype.setValues.bind(writer, [false]).should.throw();
      // Regex does not match
      Writer.prototype.setValues.bind(writer, [
          '2014-08-21|14:02:34'
        ]).should
        .throw();
    });

    it('should raise not implemented error for DAYDATE', function () {
      var writer = new Writer([TypeCode.DAYDATE]);
      Writer.prototype.setValues.bind(writer, [1]).should.throw();
    });

    it('should raise not implemented error for SECONDDATE', function () {
      var writer = new Writer([TypeCode.SECONDDATE]);
      Writer.prototype.setValues.bind(writer, [1]).should.throw();
    });

    it('should raise not implemented error for LONGDATE', function () {
      var writer = new Writer([TypeCode.LONGDATE]);
      Writer.prototype.setValues.bind(writer, [1]).should.throw();
    });

    it('should raise not implemented error for SECONDTIME', function () {
      var writer = new Writer([TypeCode.SECONDTIME]);
      Writer.prototype.setValues.bind(writer, [1]).should.throw();
    });

  });

});
