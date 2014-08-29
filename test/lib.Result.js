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

var lib = require('./hdb').lib;
var Result = lib.Result;
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

    it('should handle an exec error', function (done) {
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
        functionCode: FunctionCode.NIL
      };
      result.handle(null, reply, function (err) {
        err.should.be.instanceof(Error);
        done();
      });
    });

    it('should return no lob column names', function () {
      var result = createResult({
        parameterMetadata: false
      });
      result.getLobColumnNames().should.have.length(0);
    });

  });
});