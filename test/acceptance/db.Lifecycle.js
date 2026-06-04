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
const getOptions = require('../db').getOptions;

describe('db', function () {

  describe('readyState and lifecycle', function () {

    it('client.readyState is "new" immediately after createClient', function () {
      const client = hdb.createClient(getOptions());
      client.readyState.should.equal('new');
      // end() on a 'new' client is a no-op — must not throw
      client.end();
    });

    it('client.readyState is "connected" after successful connect', function (done) {
      const client = hdb.createClient(getOptions());
      client.connect(function (err) {
        if (err) return done(err);
        client.readyState.should.equal('connected');
        client.disconnect(function () {
          client.end();
          done();
        });
      });
    });

    it('client.readyState is "closed" after disconnect', function (done) {
      const client = hdb.createClient(getOptions());
      client.connect(function (err) {
        if (err) return done(err);
        client.disconnect(function (disconnectErr) {
          client.readyState.should.equal('closed');
          client.end();
          done(disconnectErr);
        });
      });
    });

    it('exec before connect returns an error', function (done) {
      const client = hdb.createClient(getOptions());
      client.exec('SELECT * FROM DUMMY', function (err) {
        done();
      });
    });

    it('disconnect when already disconnected is safe', function (done) {
      const client = hdb.createClient(getOptions());
      client.connect(function (err) {
        if (err) return done(err);
        client.disconnect(function () {
          // Second disconnect on a closed client must not crash.
          // It may deliver a Connection-closed error; that is acceptable.
          client.disconnect(function (err) {
            err.should.be.instanceof(Error);
            err.code.should.equal('EHDBCLOSE');
            client.end();
            done();
          });
        });
      });
    });

    it('connect after disconnect reconnects successfully', function (done) {
      this.timeout(5000);
      const client = hdb.createClient(getOptions());
      client.connect(function (err) {
        if (err) return done(err);
        client.disconnect(function (err) {
          if (err) return done(err);
          client.connect(function (err) {
            if (err) return done(err);
            client.readyState.should.equal('connected');
            client.exec('SELECT * FROM DUMMY', function (err, rows) {
              if (err) return done(err);
              rows.should.have.length(1);
              client.disconnect(function () {
                client.end();
                done();
              });
            });
          });
        });
      });
    });

    it('connect with explicit credential override reconnects on same client', function (done) {
      this.timeout(10000);
      const adminClient = hdb.createClient(getOptions());
      const user2Client = hdb.createClient(getOptions());

      async.waterfall([
        function connectAdminConn(cb) {
          adminClient.connect(cb);
        },
        function dropExistingUser(cb) {
          adminClient.exec('DROP USER MYUSER2 CASCADE', function () {
            cb(); // ignore any error — user may not exist
          });
        },
        function createUser(cb) {
          const sql = 'CREATE USER MYUSER2 PASSWORD "myUser2pwd" NO FORCE_FIRST_PASSWORD_CHANGE';
          adminClient.exec(sql, cb);
        },
        function connectUser2DefaultCredentials(cb) {
          user2Client.connect(cb); // initially connect with default credentials
        },
        function disconnectUser2(cb) {
          user2Client.disconnect(cb);
        },
        function reconnectUser2AsMYUSER2(cb) {
          user2Client.connect({ user: 'MYUSER2', password: 'myUser2pwd' }, cb);
        },
        function checkReadyState(cb) {
          user2Client.readyState.should.equal('connected');
          cb();
        },
        function checkCurrentUser(cb) {
          user2Client.exec('SELECT CURRENT_USER FROM DUMMY', cb);
        },
        function verifyUser(rows, cb) {
          rows.should.have.length(1);
          rows[0].CURRENT_USER.should.equal('MYUSER2');
          cb();
        },
        function disconnectUser2Again(cb) {
          user2Client.disconnect(cb);
        },
      ], function finish(err) {
        adminClient.exec('DROP USER MYUSER2 CASCADE', function () {
          user2Client.end();
          adminClient.end();
          done(err);
        });
      });
    });

    it('end() terminates the connection; subsequent exec produces an error', function (done) {
      const client = hdb.createClient(getOptions());
      client.connect(function (err) {
        if (err) return done(err);
        client.end();
        client.exec('SELECT * FROM DUMMY', function (err) {
          err.should.be.instanceof(Error);
          done();
        });
      });
    });

  });

});
