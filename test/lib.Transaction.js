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

var lib = require('../lib');

describe('Lib', function () {

  describe('#Transaction', function () {

    it('should create a transaction', function () {
      var transaction = new lib.Transaction();
      transaction.autoCommit.should.be.true;
      transaction.setAutoCommit(false);
      transaction.autoCommit.should.be.false;
    });

    it('should emit a transaction errror', function (done) {
      var transaction = new lib.Transaction();
      transaction.on('error', function (err) {
        err.should.be.an.Error;
        err.level.should.equal(lib.common.ErrorLevel.FATAL);
        done();
      });
      transaction.setFlags({
        sessionClosingTransactionErrror: true
      });
    });

    it('should start a new read transaction', function (done) {
      var transaction = new lib.Transaction();
      transaction.on('new', function (kind) {
        kind.should.equal('read');
        transaction.setFlags({
          committed: true
        });
      });
      transaction.on('end', function (success) {
        success.should.equal(true);
        done();
      });
      transaction.setFlags({
        noWriteTransactionStarted: true
      });
    });

    it('should start a new write transaction', function (done) {
      var transaction = new lib.Transaction();
      transaction.on('new', function (kind) {
        kind.should.equal('write');
        transaction.setFlags({
          rolledBack: true
        });
      });
      transaction.on('end', function (success) {
        success.should.equal(false);
        done();
      });
      transaction.setFlags({
        writeTransactionStarted: true
      });
    });

  });

});