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

var db = require('../db')();
var RemoteDB = require('../db/RemoteDB');
var describeRemoteDB = db instanceof RemoteDB ? describe : describe.skip;

describe('db', function () {

  describe('events', function () {
    var client;

    beforeEach(function (done) {
      db.init(function (err) {
        if (err) {
          return done(err);
        }

        client = db.client;
        done();
      });
    });

    after(function () {
      if (client && client.readyState !== 'closed') {
        client.close();
      }
    });

    it('should invoke pending callback', function (done) {
      client.close();

      client.exec('SELECT * FROM DUMMY', function (err) {
        err.should.be.an.instanceOf(Error);
        done();
      });
    });

    it('should fail to execute prepared statement after client closed', function (done) {
      client.prepare('select * from dummy where dummy = ?', function(err, stmt) {
        client.close();
        setTimeout(function () {
          stmt.execute(["test"], function(err, res) {
            err.message.should.equal("Connection closed");
            done();
          });
        }, 0);
      });
    });
  });

  describeRemoteDB('isValid', function () {
    before(db.init.bind(db));
    after(function (done) {
      if (client.readyState !== 'closed') {
        db.end(done);
      } else {
        done();
      }
    });
    var client = db.client;

    it('should be valid when connected', function (done) {
      client.isValid(0, function (err, ret) { // no timeout
        if (err) done(err);
        ret.should.be.true();
        done();
      })
    });

    it('should be valid with timeout when connected', function (done) {
      client.isValid(1, function (err, ret) { // 1 second timeout
        if (err) done(err);
        ret.should.be.true();
        done();
      });
    });

    it('should be invalid when disconnected', function (done) {
      client.exec('SELECT CURRENT_CONNECTION FROM DUMMY', function (err, res) {
        var connId = res[0].CURRENT_CONNECTION;
        var adminDB = require('../db')();
        adminDB.init(function (err) {
          if (err) done(err);
          var adminClient = adminDB.client;
          var disconnectSQL = "ALTER SYSTEM DISCONNECT SESSION '" + connId + "'";
          adminClient.exec(disconnectSQL, function (err) {
            if (err) done(err);
            client.isValid(0, function (err, ret) { // disconnected
              if (err) done(err);
              ret.should.be.false();
              adminDB.end(done);
            });
          });
        });
      });
    });
  });

});
