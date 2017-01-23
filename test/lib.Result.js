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
var mock = require('./mock');
var Result = lib.Result;
var Lob = lib.Lob;
var FunctionCode = lib.common.FunctionCode;
var TypeCode = lib.common.TypeCode;
var IoType = lib.common.IoType;

function createResultSet(err, rows) {
  return {
    fetch: function fetch(cb) {
      process.nextTick(function () {
        if (err) {
          return cb(err);
        }
        cb(null, rows);
      });
    },
    close: function close(cb) {
      process.nextTick(function () {
        cb(null);
      });
    }
  };
}

function createLob(err, buffer) {
  var locatorId = new Buffer([1, 0, 0, 0, 0, 0, 0, 0]);
  var lob = new Lob(null, {
    locatorId: locatorId
  });
  lob.read = function read(cb) {
    process.nextTick(function () {
      if (err) {
        return cb(err);
      }
      cb(null, buffer);
    });
  };
  return lob;
}

function createResult(options) {
  options = lib.util.extend({
    readLobReply: undefined,
    parameterMetadata: [{
      dataType: TypeCode.INT,
      ioType: IoType.IN_OUT,
      name: 'X'
    }],
    resultSetMetadata: [{
      dataType: TypeCode.INT,
      columnName: 'Y',
      columnDisplayName: 'Y'
    }]
  }, options);
  var connection = mock.createConnection();
  connection.replies.readLob = options.readLobReply;
  var result = Result.create(connection, options);
  connection.should.equal(result._connection);
  result.setParameterMetadata(options.parameterMetadata);
  result.setResultSetMetadata(options.resultSetMetadata);
  if (typeof options.createResultSet === 'function') {
    result.createResultSet = options.createResultSet.bind(result);
  }
  if (typeof options.createLob === 'function') {
    result.createLob = options.createLob.bind(result);
  }
  return result;
}

describe('Lib', function () {

  describe('#Result', function () {

    it('should handle an execution error', function (done) {
      var result = createResult();
      var execError = new Error('exec error');
      var reply = {};
      result.handle(execError, reply, function (err) {
        execError.should.equal(err);
        done();
      });
    });

    it('should handle an invalid function code', function (done) {
      var result = createResult();
      var reply = {
        functionCode: -42
      };
      result.handle(null, reply, function (err) {
        err.should.be.instanceof(Error);
        done();
      });
    });

    it('should handle an initial function code', function (done) {
      var result = createResult();
      var reply = {
        functionCode: FunctionCode.NIL
      };
      result.handle(null, reply, function (err) {
        (!err).should.be.ok;
        done();
      });
    });

    it('should handle a DDL function code', function (done) {
      var result = createResult();
      var reply = {
        functionCode: FunctionCode.DDL
      };
      result.handle(null, reply, function (err) {
        (!err).should.be.ok;
        done();
      });
    });

    it('should return rowsAffected on insert error', function (done) {
      var result = createResult();
      var insError = new Error('insert error');
      var reply = {
        functionCode: FunctionCode.INSERT,
        rowsAffected: [1, 1, -3]
      };
      result.handle(insError, reply, function (err, rowsAffected) {
        err.should.be.instanceof(Error);
        rowsAffected.should.eql([1, 1, -3]);
        done();
      });
    });

    it('should handle a query with error', function (done) {
      var result = createResult();
      var reply = {
        functionCode: FunctionCode.SELECT,
        resultSets: []
      };
      result.handle(null, reply, function (err) {
        (!err).should.be.ok;
        done();
      });
    });

    it('should return no lob column names', function () {
      var result = createResult({
        parameterMetadata: false
      });
      result.getLobColumnNames().should.have.length(0);
    });

    it('should create output parameters', function () {
      var result = createResult();
      var part = {
        argumentCount: 1,
        buffer: new Buffer('010d000000', 'hex')
      };
      result.createOutputParameters(part).should.eql({
        X: 13
      });
    });

    it('should create a lob', function () {
      var locatorId = new Buffer([1, 0, 0, 0, 0, 0, 0, 0]);
      var result = createResult();

      result._connection._readLob = function readLob() {};
      var lob = result.createLob({
        locatorId: locatorId
      });
      lob.locatorId.should.equal(locatorId);
    });

    it('should handle a db procedure call without auto fetch',
      function (done) {
        var result = createResult({
          autoFetch: false
        });
        var _params = {};
        var _rows = [{
          'DUMMY': 'X'
        }];
        var resultSet = createResultSet(null, _rows);
        result.handleDBCall(function (err, params, rs) {
          (!err).should.be.ok;
          params.should.equal(_params);
          rs.should.equal(resultSet);
          done();
        }, _params, [resultSet]);
      });

    it('should handle a db procedure call with lob instance',
      function (done) {
        var result = createResult({
          autoFetch: true,
          parameterMetadata: [{
            dataType: TypeCode.NCLOB,
            ioType: IoType.OUTPUT,
            name: 'Z'
          }],
        });
        var _buffer = new Buffer('foo', 'utf8');
        var _params = {
          Z: createLob(null, _buffer)
        };
        var _rows = [{
          'DUMMY': 'X'
        }];
        var resultSet = createResultSet(null, _rows);
        result.handleDBCall(
          function (err, params, rows) {
            (!err).should.be.ok;
            params.Z.should.equal(_buffer);
            rows.should.eql(_rows);
            done();
          }, _params, [resultSet]);
      });

    it('should handle a db procedure call with lob buffer',
      function (done) {
        var result = createResult({
          autoFetch: true,
          parameterMetadata: [{
            dataType: TypeCode.NCLOB,
            ioType: IoType.OUTPUT,
            name: 'Z'
          }],
        });
        var _buffer = new Buffer('foo', 'utf8');
        var _params = {
          Z: _buffer
        };
        var _rows = [{
          'DUMMY': 'X'
        }];
        var resultSet = createResultSet(null, _rows);
        result.handleDBCall(
          function (err, params, rows) {
            (!err).should.be.ok;
            params.Z.should.equal(_buffer);
            rows.should.eql(_rows);
            done();
          }, _params, [resultSet]);
      });


    it('should handle a db procedure call with read lob error',
      function (done) {
        var result = createResult({
          autoFetch: true,
          parameterMetadata: [{
            dataType: TypeCode.NCLOB,
            ioType: IoType.OUTPUT,
            name: 'Z'
          }],
        });
        var _err = new Error('Dummy');
        var _params = {
          Z: createLob(_err)
        };
        var _rows = [{
          'DUMMY': 'X'
        }];
        var resultSet = createResultSet(null, _rows);
        result.handleDBCall(
          function (err) {
            err.should.equal(_err);
            done();
          }, _params, [resultSet]);
      });

    it('should handle a db procedure call with error',
      function (done) {
        var result = createResult({
          autoFetch: true
        });
        var _err = new Error('Dummy');
        var resultSet = createResultSet(_err);
        result.handleDBCall(function (err) {
          err.should.equal(_err);
          done();
        }, {}, [resultSet]);
      });


    it('should handle a query with error',
      function (done) {
        var result = createResult({
          autoFetch: true
        });
        var _err = new Error('Dummy');
        var resultSet = createResultSet(_err);
        result.handleQuery(function (err) {
          err.should.equal(_err);
          done();
        }, [resultSet]);
      });
  });
});