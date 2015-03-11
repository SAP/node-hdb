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
var Result = lib.Result;
var Lob = lib.Lob;
var FunctionCode = lib.common.FunctionCode;
var TypeCode = lib.common.TypeCode;
var IoType = lib.common.IoType;

function Stub(args) {
  this.inputArgs = null;
  this.ouputArgs = args;
}

Stub.prototype.readLob = function readLob() {
  this.inputArgs = Array.prototype.slice.call(arguments);
  var cb = this.inputArgs.pop();
  var self = this;
  setImmediate(function () {
    cb.apply(null, self.ouputArgs);
  });
};

function createResultSet(err, rows) {
  return {
    error: err,
    rows: rows,
    fetch: function fetch(cb) {
      setImmediate(function () {
        if (err) {
          return cb(err);
        }
        cb(null, rows);
      });
    },
    close: function close(cb) {
      setImmediate(function () {
        cb(null);
      });
    }
  };
}

function createLob(err, buffer) {
  var lob = new Lob(null, {
    locatorId: 1
  });
  lob.read = function readLob(cb) {
    setImmediate(function () {
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
    outputArgs: [null],
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
  var connection = new Stub(options.ouputArgs);
  var result = new Result(connection, options);
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
      var result = createResult();

      result._connection._readLob = function readLob() {};
      var lob = result.createLob({
        locatorId: 1
      });
      lob.locatorId.should.equal(1);
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