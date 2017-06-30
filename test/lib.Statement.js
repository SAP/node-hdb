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
var Statement = lib.Statement;
var FunctionCode = lib.common.FunctionCode;
var TypeCode = lib.common.TypeCode;
var IoType = lib.common.IoType;
var EMPTY_BUFFER = lib.common.EMPTY_BUFFER;

function createStatement(options) {
  options = lib.util.extend({
    executeReply: {
      functionCode: FunctionCode.INSERT,
      rowsAffected: 1
    },
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
  var connection = mock.createConnection();
  connection.replies.execute = options.executeReply;
  var statement = new Statement(connection);
  connection.should.equal(statement._connection);
  statement.id = options.id;
  statement.functionCode = options.functionCode;
  statement.parameterMetadata = options.parameterMetadata;
  statement.resultSetMetadata = options.resultSetMetadata;
  if (typeof options.createResult === 'function') {
    statement._createResult = options.createResult;
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
        connection.options.should.eql({
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

    it('should generate an error on statements with empty parameter values', function (
      done) {
      var statement = createStatement();
      var values = [];
      statement.execute(values, function (err) {
        err.should.be.instanceof(Error);
        done();
      });
    });

    it('should generate an error on statements with unbound input parameters (array)', function (
      done) {
      var statement = createStatement();
      var values = { 'bad': 1 };
      statement.execute(values, function (err) {
        err.should.be.instanceof(Error);
        done();
      });
    });

    it('should generate an error on statements with unbound input parameters (object)', function (
      done) {
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

      var statement = createStatement();
      var values = [1, 2];
      statement.execute(values, function (err) {
        err.should.be.instanceof(Error);
        done();
      });
    });

    it('should execute a statement with an options object', function (
      done) {
      var replies = null;
      var statement = createStatement({
        createResult: function (connection, options) {
          replies = connection.replies;
          options.autoFetch.should.equal(true);
          return mock.createResult(connection, options);
        }
      });
      var values = [1];
      statement.execute(values, {
        autoFetch: true
      }, function (err, reply) {
        (!!err).should.be.not.ok;
        reply.should.equal(replies.execute);
        done();
      });
    });

    it('should execute a statement with values part of options', function (
      done) {
      var replies = null;
      var statement = createStatement({
        createResult: function (connection, options) {
          replies = connection.replies;
          options.autoFetch.should.equal(true);
          return mock.createResult(connection, options);
        }
      });
      var values = [1];
      statement.execute({
        values: values,
        autoFetch: true
      }, function (err, rowsAffected) {
        (!err).should.be.ok;
        rowsAffected.should.equal(replies.execute);
        done();
      });
    });

    it('should execute a statement with parameters part of options', function (
      done) {
      var replies = null;
      var statement = createStatement({
        createResult: function (connection, options) {
          replies = connection.replies;
          options.autoFetch.should.equal(true);
          return mock.createResult(connection, options);
        }
      });
      var values = [1];
      statement.execute({
        parameters: values,
        autoFetch: true
      }, function (err, rowsAffected) {
        (!err).should.be.ok;
        rowsAffected.should.equal(replies.execute);
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
        }, {
          dataType: TypeCode.BIGINT,
          ioType: IoType.INPUT,
          name: 'E'
        }]
      });
      statement._normalizeInputParameters({
        A: 1,
        C: 3,
        D: null,
        E: undefined
      }).should.eql({
        types: [TypeCode.TINYINT, TypeCode.INT, TypeCode.BIGINT, TypeCode.BIGINT],
        values: [1, 3, null, undefined]
      });
    });

    it('should normalize empty parameters ', function () {
      var statement = createStatement({
        parameterMetadata: []
      });
      statement._normalizeInputParameters().should.equal(EMPTY_BUFFER);
    });

    it('should return undefined for non-bound parameters', function () {
      (Statement.prototype._normalizeInputParameters.bind(createStatement(), [])() === undefined).should.be.true;
    });

  });
});