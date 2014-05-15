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

var lib = require('./hdb').lib;
var Writer = lib.Writer;

var data = require('./fixtures/parametersData');
var SIZE = data.MAX_PART_SIZE;

describe('Data', function () {

  describe('#Parameters', function () {

    it('should write default parameters', function (done) {
      var test = data.DEFAULT;
      var writer = Writer.create(test.values);
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
      var writer = Writer.create(test.values);
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
      var writer = Writer.create(test.values);
      writer.getParameters(SIZE, function (err, buffer) {
        if (err) {
          return done(err);
        }
        buffer.should.eql(test.part.buffer);
        done();
      });
    });

    it('should write a blob', function (done) {
      var test = data.LOGO;
      var writer = Writer.create(test.values);
      writer.getParameters(SIZE, function (err, buffer) {
        if (err) {
          return done(err);
        }
        buffer.should.eql(test.part.buffer);
        writer.finished.should.equal(false);
        writer._lobs.should.have.length(1);
        var lob = writer._lobs[0];
        lob.stream._readableState.should.have.length(6054);

        lob.locatorId = new Buffer(8);
        lob.locatorId.fill(0x00);
        lob.locatorId[0] = 1;

        writer.getWriteLobRequest(SIZE, function (err, part) {
          if (err) {
            return done(err);
          }
          part.buffer.should.have.length(SIZE);
          var exp = new Buffer(
            '0100000000000000020000000000000000eb030000', 'hex');
          part.buffer.slice(0, 21).should.eql(exp);
          done();
        });
      });
    });

  });

});