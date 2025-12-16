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
var StatementContext = lib.common.StatementContext;

function createStatementContext() {
  var statementContext = new lib.part.StatementContext();
  return statementContext;
}

describe('Part', function () {

  describe('#StatementContext', function () {

    it('create a valid statement context', function (done) {
      var statementContext = createStatementContext();
      var statementSequenceInfo = new Buffer([0, 1, 2, 3, 4, 5, 6,
        7, , 8, 9
      ]);
      var serverExecutionTime = 1234;
      var options = [{
        name: StatementContext.STATEMENT_SEQUENCE_INFO,
        value: statementSequenceInfo
      }, {
        name: StatementContext.SERVER_EXECUTION_TIME,
        value: serverExecutionTime
      }];
      statementContext.setOptions(options);
      statementContext.statementSequenceInfo.should.equal(
        statementSequenceInfo);
      statementContext.serverExecutionTime.should.equal(
        serverExecutionTime);
      statementContext.size.should.equal(32);
      done();
    });

    it('create an initial statement context', function (done) {
      var statementContext = createStatementContext();
      statementContext.setOptions(false);
      (!statementContext.statementSequenceInfo).should.be.ok;
      statementContext.serverExecutionTime.should.equal(0);
      statementContext.size.should.equal(32);
      done();
    });

  });

});