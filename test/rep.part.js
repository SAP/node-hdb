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
var PART_HEADER_LENGTH = lib.common.PART_HEADER_LENGTH;
var PartKind = lib.common.PartKind;
var Part = lib.reply.Part;

describe('Rep', function () {

  describe('#Part', function () {

    var data = new Buffer(
      '0c000100000000000400000000000000' +
      '0100000000000000', 'hex');
    var dataBigArg = new Buffer(
      '0c00ffff020000000400000000000000' +
      '0100000000000000', 'hex');
    var buffer = data.slice(PART_HEADER_LENGTH, PART_HEADER_LENGTH + 4);

    it('should create a new Part', function () {
      /* jshint expr: true */

      var part = new Part();
      part.kind.should.equal(PartKind.NIL);
      part.attributes.should.equal(0);
      part.argumentCount.should.equal(0);
      should(part.buffer).not.be.ok;
      part.byteLength.should.equal(PART_HEADER_LENGTH);

      part = new Part(PartKind.ROWS_AFFECTED, 1, 1, buffer);
      part.kind.should.equal(PartKind.ROWS_AFFECTED);
      part.attributes.should.equal(1);
      part.argumentCount.should.equal(1);
      part.buffer.should.equal(buffer);
      part.byteLength.should.equal(PART_HEADER_LENGTH + 8);

      part = new Part(PartKind.ROWS_AFFECTED, 1, 1, buffer.toString('hex'));
      part.buffer.should.eql(buffer);
      part.byteLength.should.equal(PART_HEADER_LENGTH + 8);
    });

    it('should create a Part from buffer', function () {
      var part = Part.create(data, 0);
      part.kind.should.equal(PartKind.ROWS_AFFECTED);
      part.attributes.should.equal(0);
      part.argumentCount.should.equal(1);
      part.buffer.should.eql(buffer);
      part.byteLength.should.equal(PART_HEADER_LENGTH + 8);
    });


    it('should read a Part with big argument count', function () {
      var part = new Part();
      Part.read.call(part, dataBigArg, 0);
      part.argumentCount.should.equal(2);
    });

    it('should write a Part to buffer', function () {
      var part = new Part(PartKind.ROWS_AFFECTED, 0, 1, buffer);
      part.toBuffer(0).should.eql(data);
    });

    it('should inspect a Part', function () {
      var part = new Part(PartKind.ROWS_AFFECTED, 0, 1, buffer);
      part.inspect().should.equal([
        '{',
        '  kind: PartKind.ROWS_AFFECTED,',
        '  argumentCount: 1,',
        '  attributes: 0,',
        '  buffer: new Buffer(',
        '    \'01000000\', \'hex\')',
        '}'
      ].join('\n'));
    });

    it('should inspect a empty Part', function () {
      var part = new Part(PartKind.ROWS_AFFECTED, 0, 1, null);
      part.inspect().should.equal([
        '{',
        '  kind: PartKind.ROWS_AFFECTED,',
        '  argumentCount: 1,',
        '  attributes: 0,',
        '  buffer: null',
        '}'
      ].join('\n'));
    });

  });

});