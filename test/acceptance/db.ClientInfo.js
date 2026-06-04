// Copyright 2026 SAP AG.
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
/* jshint undef:false, expr:true */

const async = require('async');
const hdb = require('../../lib');
const db = require('../db')();
const RemoteDB = require('../db/RemoteDB');
const getOptions = require('../db').getOptions;

const describeRemoteDB = db instanceof RemoteDB ? describe : describe.skip;

describe('db', function () {
  before(db.init.bind(db));
  after(db.end.bind(db));
  const client = db.client;

  describe('Client Information', function () {

    it('client.get("user") returns the connected username after connect', function (done) {
      const expectedUser = getOptions().user;
      client.get('user').should.equal(expectedUser);
      done();
    });

    it('setClientInfo rejects an empty string value', function () {
      let threw = false;
      try {
        // note that SQLDBC and other drivers allow setting empty client info values
        client.setClientInfo('MYKEY', '');
      } catch (e) {
        threw = true;
        e.should.be.instanceof(Error);
        e.message.should.equal('Invalid arguments for Client.setClientInfo()');
      }
      threw.should.be.true();
    });

  });

  describeRemoteDB('Client Information - session variables', function () {

    it('SESSIONVARIABLE: option at createClient time is visible via SESSION_CONTEXT', function (done) {
      const svKey = 'TESTCREATEKEY';
      const svValue = 'TESTCREATEVALUE';
      const opts = {};
      opts['SESSIONVARIABLE:' + svKey] = svValue;
      const svClient = hdb.createClient(getOptions(opts));
      async.waterfall([
        function connect(cb) {
          svClient.connect(cb);
        },
        function query(cb) {
          svClient.exec("SELECT SESSION_CONTEXT('" + svKey + "') AS VAL FROM DUMMY", cb);
        },
        function verify(rows, cb) {
          rows.should.have.length(1);
          rows[0].VAL.should.equal(svValue);
          cb();
        }
      ], function finish(err) {
        svClient.disconnect(function () {
          svClient.end();
          done(err);
        });
      });
    });

    it('setClientInfo propagates to the server on the next exec call', function (done) {
      const svKey = 'TESTSETKEY1';
      const svValue = 'TESTSETVALUE1';
      client.setClientInfo(svKey, svValue);
      client.exec("SELECT SESSION_CONTEXT('" + svKey + "') AS VAL FROM DUMMY", function (err, rows) {
        if (err) return done(err);
        rows.should.have.length(1);
        rows[0].VAL.should.equal(svValue);
        done();
      });
    });

    it('multiple setClientInfo calls before exec accumulate into one update', function (done) {
      const key1 = 'TESTACCKEY1';
      const key2 = 'TESTACCKEY2';
      const val1 = 'TESTACCVAL1';
      const val2 = 'TESTACCVAL2';
      client.setClientInfo(key1, val1);
      client.setClientInfo(key2, val2);
      async.waterfall([
        function queryKeys(cb) {
          client.exec("SELECT SESSION_CONTEXT('" + key1 + "') AS VAL1, SESSION_CONTEXT('" + key2 + "') AS VAL2 FROM DUMMY", cb);
        },
        function verifyKeys(rows, cb) {
          rows[0].VAL1.should.equal(val1);
          rows[0].VAL2.should.equal(val2);
          cb();
        },
      ], done);
    });

    it('setting the reserved APPLICATION key works and is visible via SESSION_CONTEXT', function (done) {
      client.setClientInfo('APPLICATION', 'node-hdb-test-app');
      client.exec("SELECT SESSION_CONTEXT('APPLICATION') AS VAL FROM DUMMY", function (err, rows) {
        if (err) return done(err);
        rows.should.have.length(1);
        rows[0].VAL.should.equal('node-hdb-test-app');
        done();
      });
    });

    it('session variables are isolated per connection', function (done) {
      this.timeout(5000);
      const isoKey = 'TESTISOKEY';
      const isoVal1 = 'ISOVAL1';
      const isoVal2 = 'ISOVAL2';
      const client2 = hdb.createClient(getOptions());

      async.waterfall([
        function connect2(cb) {
          client2.connect(cb);
        },
        function setAndQueryClient1(cb) {
          client.setClientInfo(isoKey, isoVal1);
          client.exec("SELECT SESSION_CONTEXT('" + isoKey + "') AS VAL FROM DUMMY", cb);
        },
        function verifyClient1(rows, cb) {
          rows[0].VAL.should.equal(isoVal1);
          cb();
        },
        function setAndQueryClient2(cb) {
          client2.setClientInfo(isoKey, isoVal2);
          client2.exec("SELECT SESSION_CONTEXT('" + isoKey + "') AS VAL FROM DUMMY", cb);
        },
        function verifyClient2(rows, cb) {
          rows[0].VAL.should.equal(isoVal2);
          cb();
        },
        function crossCheckClient1(cb) {
          client.exec("SELECT SESSION_CONTEXT('" + isoKey + "') AS VAL FROM DUMMY", cb);
        },
        function verifyNoBleed(rows, cb) {
          rows[0].VAL.should.equal(isoVal1);
          cb();
        }
      ], function finish(err) {
        client2.disconnect(function () {
          client2.end();
          done(err);
        });
      });
    });

  });

});
