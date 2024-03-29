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

});
