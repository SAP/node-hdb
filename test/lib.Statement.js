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
var Statement = lib.Statement;
var FunctionCode = lib.common.FunctionCode;
var TypeCode = lib.common.TypeCode;
var IoType = lib.common.IoType;

function Stub(args) {
  this.inputArgs = null;
  this.ouputArgs = args;
}

Stub.prototype.execute = function execute() {
  this.inputArgs = Array.prototype.slice.call(arguments);
  var cb = this.inputArgs.pop();
  var self = this;
  setImmediate(function () {
    cb.apply(null, self.ouputArgs);
  });
};
Stub.prototype.handle = Stub.prototype.execute;


function createStatement(options) {
  options = lib.util.extend({
    outputArgs: [null, {
      functionCode: FunctionCode.INSERT,
      rowsAffected: 1
    }],
    id: new Buffer([1, 0, 0, 0, 0, 0, 0, 0]),
    functionCode: FunctionCode.INSERT,
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
  var connection = new Stub(options.outputArgs);
  var statement = new Statement(connection);
  connection.should.equal(statement._connection);
  statement.id = options.id;
  statement.functionCode = options.functionCode;
  statement.parameterMetadata = options.parameterMetadata;
  statement.resultSetMetadata = options.resultSetMetadata;
  if (typeof options.createResult === 'function') {
    statement._createResult = options.createResult.bind(statement);
  }
  return statement;
}

describe('Lib', function () {

  describe('#Statement', function () {

    it('should execute a statement', function (done) {
      var statement = createStatement();
      var connection = statement._connection;
      var values = [1];
      statement.execute(values, function (err, rowsAffected) {
        connection.inputArgs.should.have.length(1);
        connection.inputArgs[0].should.eql({
          functionCode: statement.functionCode,
          statementId: statement.id,
          parameters: {
            types: [TypeCode.INT],
            values: values
          }
        });
        rowsAffected.should.equal(1);
        done();
      });
    });

    it('should execute a statement with empty parameter values', function (
      done) {
      var statement = createStatement();
      var values = [];
      statement.execute(values, function (err) {
        err.should.be.instanceof(Error);
        done();
      });
    });

    it('should create an execution result handler', function () {
      var statement = createStatement();
      var result = statement._createResult({
        autoFetch: 1
      });
      result.autoFetch.should.equal(true);
      result.readSize.should.equal(lib.Lob.DEFAULT_READ_SIZE);
      statement._connection.should.equal(result._connection);
      statement.resultSetMetadata.should.equal(result._resultSetMetadata);
      statement.parameterMetadata.should.eql(result._parameterMetadata);
    });

    it('should execute a statement with an options object', function (
      done) {
      var statement = createStatement({
        createResult: function (options) {
          options.autoFetch.should.equal(true);
          return new Stub([null, 1]);
        }
      });
      var values = [1];
      statement.execute(values, {
        autoFetch: true
      }, function (err, rowsAffected) {
        (!err).should.be.ok;
        rowsAffected.should.equal(1);
        done();
      });
    });

    it('should execute a statement with values part of options', function (
      done) {
      var statement = createStatement({
        createResult: function (options) {
          options.autoFetch.should.equal(true);
          return new Stub([null, 1]);
        }
      });
      var values = [1];
      statement.execute({
        values: values,
        autoFetch: true
      }, function (err, rowsAffected) {
        (!err).should.be.ok;
        rowsAffected.should.equal(1);
        done();
      });
    });

    it('should execute a statement with parameters part of options', function (
      done) {
      var statement = createStatement({
        createResult: function (options) {
          options.autoFetch.should.equal(true);
          return new Stub([null, 1]);
        }
      });
      var values = [1];
      statement.execute({
        parameters: values,
        autoFetch: true
      }, function (err, rowsAffected) {
        (!err).should.be.ok;
        rowsAffected.should.equal(1);
        done();
      });
    });

    it('should handle prepare statement with error', function (done) {
      var statement = createStatement();
      var perpareError = new Error('perpare error');
      var reply = {};
      statement.handle(perpareError, reply, function (err) {
        perpareError.should.equal(err);
        done();
      });
    });

    it('should return the name of the first parameter', function () {
      createStatement().getParameterName(0).should.equal('X');
    });

    it('should normalize different kind of parameters', function () {
      var statement = createStatement({
        parameterMetadata: [{
          dataType: TypeCode.TINYINT,
          ioType: IoType.INPUT,
          name: 'A'
        }, {
          dataType: TypeCode.SMALLINT,
          ioType: IoType.OUTPUT,
          name: 'B'
        }, {
          dataType: TypeCode.INT,
          ioType: IoType.IN_OUT,
          name: 'C'
        }, {
          dataType: TypeCode.BIGINT,
          ioType: IoType.INPUT,
          name: 'D'
        }]
      });
      statement._normalizeInputParameters({
        A: 1,
        C: 3
      }).should.eql({
        types: [TypeCode.TINYINT, TypeCode.INT, TypeCode.BIGINT],
        values: [1, 3, null]
      });
    });

    it('should normalize empty parameters ', function () {
      var statement = createStatement({
        parameterMetadata: []
      });
      (!statement._normalizeInputParameters()).should.be.ok;
    });

    it('should raise an error for empty parameters values', function () {
      Statement.prototype._normalizeInputParameters.bind(createStatement(), [])
        .should.throw();
    });

  });
});