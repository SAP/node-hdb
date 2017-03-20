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

var async = require('async');
var lib = require('../lib');
var util = lib.util;
var ResultSetTransform = lib.ResultSetTransform;
var Transform = util.stream.Transform;

function write(rst, str, cb) {
  rst.write(new Buffer(str, 'ascii'), 'buffer', cb);
}

function createResultSetTransform(options) {
  options = options || {};

  if (!options.hasOwnProperty('arrayMode')) {
    options.arrayMode = 3;
  }
  if (!options.hasOwnProperty('threshold')) {
    options.threshold = 2;
  }
  var parseRow = function () {
    /* jshint validthis:true */
    return this.read();
  };
  if (typeof options.parseRow === 'function') {
    parseRow = options.parseRow;
  }
  var resultSet = {};
  if (util.isObject(options.resultSet)) {
    resultSet = options.resultSet;
  }
  var resultSetTransform = new ResultSetTransform(parseRow, resultSet, options);
  resultSetTransform._createReader = function _createSimpleReader(chunk) {
    return {
      buffer: chunk,
      offset: 0,
      read: function read() {
        if (this.hasMore()) {
          return this.buffer[this.offset++];
        }
        return null;
      },
      hasMore: function hasMore() {
        return this.offset < this.buffer.length;
      }
    };
  };
  return resultSetTransform;
}
describe('Lib', function () {

  describe('#ResultSetTransform', function () {

    it('should create a simple ResultSetTransform', function () {
      var rst = createResultSetTransform({
        arrayMode: 0
      });
      rst.should.be.instanceof(Transform);
      rst._objectBuffer.should.equal(rst);
    });

    it('should create a ResultSetTransform with flushLength 3', function () {
      var rst = createResultSetTransform({
        arrayMode: 3
      });
      rst._objectBuffer.flushLength.should.equal(3);
    });

    it('should create a ResultSetTransform with flushLength -1', function () {
      var rst = createResultSetTransform({
        arrayMode: true
      });
      rst._objectBuffer.flushLength.should.equal(-1);
    });

    it('should create a Reader', function () {
      function parseRow() {}
      var resultSet = {};
      var chunk = new Buffer(0);
      var rst = new ResultSetTransform(parseRow, resultSet, {
        arrayMode: true
      });
      var reader = rst._createReader(chunk);
      reader.buffer.should.equal(chunk);
      reader.lobFactory.should.equal(resultSet);
    });

    it('should handle a parse error', function (done) {
      var parseError = new Error('PARSE_ERROR');
      var rst = new ResultSetTransform(function parseRow() {
        throw parseError;
      }, {}, {
        arrayMode: false
      });
      rst.on('error', function (err) {
        err.should.equal(parseError);
        done();
      });
      write(rst, 'foo');
    });

    it('should transform without collecting results', function (done) {
      var rst = createResultSetTransform({
        arrayMode: false
      });
      var chunks = [];
      rst.on('readable', function () {
        var value = rst.read();
        if (value !== null) {
          chunks.push(new Buffer([value]));
        }
      });
      rst.on('end', function () {
        Buffer.concat(chunks).toString('ascii').should.equal('foobar');
        done();
      });
      async.series([
        async.apply(write, rst, 'foo'),
        async.apply(write, rst, 'bar')
      ], function () {
        rst.end();
      });
    });

    it('should transform and collect all results', function (done) {
      var rst = createResultSetTransform({
        arrayMode: 4
      });
      var chunks = [];
      rst.on('readable', function () {
        var value = rst.read();
        if (value !== null) {
          chunks.push(new Buffer(value));
        }
      });
      rst.on('end', function () {
        rst._objectBuffer.empty.should.be.true;
        Buffer.concat(chunks).toString('ascii').should.equal('foobar');
        done();
      });
      async.series([
        async.apply(write, rst, 'foo'),
        async.apply(write, rst, 'bar')
      ], function () {
        rst.end();
      });
    });

    it('should transform and collect results per write', function (done) {
      var rst = createResultSetTransform({
        arrayMode: true
      });
      var chunks = [];
      rst.on('readable', function () {
        var value = rst.read();
        if (value !== null) {
          chunks.push(new Buffer(value));
        }
      });
      rst.on('end', function () {
        rst._objectBuffer.empty.should.be.true;
        Buffer.concat(chunks).toString('ascii').should.equal('foobar');
        done();
      });
      async.series([
        async.apply(write, rst, 'foo'),
        async.apply(write, rst, 'bar')
      ], function () {
        rst.end();
      });
    });

  });
});