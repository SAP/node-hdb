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

var fs = require('fs');
var path = require('path');
var db = require('../db')();
var RemoteDB = require('../db/RemoteDB');
var describeRemoteDB = db instanceof RemoteDB ? describe : describe.skip;
var isRemoteDB = db instanceof RemoteDB;

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

  describeRemoteDB('communicationTimeout', function () {
    var client = db.client;

    describeRemoteDB('no timeout', function () {
      describeRemoteDB('execute option', function () {
        before(db.init.bind(db));
        after(db.end.bind(db));

        it('should client exec with no timeout set', function (done) {
          client.exec('SELECT * FROM DUMMY', {communicationTimeout: 0}, function (err, rows) {
            if (err) done(err);
            rows.should.have.length(1);
            done();
          });
        });
  
        it('should prepare and exec with a timeout set', function (done) {
          client.prepare('SELECT * FROM DUMMY', {communicationTimeout: 2000}, function (err, stmt) {
            if (err) done(err);
            stmt.exec([], {communicationTimeout: 2000}, function (err, rows) {
              if (err) done(err);
              rows.should.have.length(1);
              done();
            });
          });
        });
      });

      describeRemoteDB('connect option', function () {
        before(function (done) {
          client.set('communicationTimeout', 2000);
          db.init(done);
        });
        after(db.end.bind(db));

        it('should prepare and execute with a timeout set', function (done) {
          client.prepare('SELECT 1 AS A FROM DUMMY', function (err, stmt) {
            if (err) done(err);
            stmt.execute([], function (err, rs) {
              if (err) done(err);
              rs.fetch(function (err, rows) {
                if (err) done(err);
                rows.should.eql([{A: 1}])
                done();
              });
            });
          });
        });
      });
    });

    describeRemoteDB('timeout', function () {
      // Setup a db connection which will delay packet sends when delayCountdown equals 0.
      // When delayCountdown < 0, there is no delay.
      var delayCountdown = -1;
      var delayedDB, delayedClient;

      // When the client disconnects, reconnecting will create a new connection which will
      // overwrite the _connect we made to delay, so we have to make a new client
      function createDelayedDB(packetDelay) {
        delayedDB = require('../db')();
        delayedClient = delayedDB.client;
        var originalConnect = delayedClient._connection._connect;
        delayedClient._connection._connect = function (options, cb) {
          var socket = originalConnect(options, cb);
          var originalWrite = socket.write;

          socket.write = function (data) {
            if (delayCountdown == 0) {
              setTimeout(function () {
                originalWrite.call(socket, data);
              }, packetDelay);
            } else {
              if (delayCountdown > 0) {
                delayCountdown--;
              }
              originalWrite.call(socket, data);
            }
          }
          return socket;
        }
      }

      // Since delayedDB is undefined to begin, we encapsulate the end in a function
      function endDelayedDB(done) {
        delayedDB.end(done);
      }

      // Tests that a timeout error was raised, currently timeouts are 25ms
      function validateTimeout(timeout, done) {
        // Return a closure which is the callback to check the timeout error
        return function (err) {
          err.should.be.an.instanceOf(Error);
          err.message.should.equal("Socket receive timeout (receive took longer than " + timeout + " ms)");
          done();
        }
      }

      // Reset the delay countdown after each test
      afterEach(function () {
        delayCountdown = -1;
      });

      it('should timeout a connect', function (done) {
        createDelayedDB(1000); // 1000ms packet delay
        // Initialization request timeout is set by initializationTimeout, communicationTimeout
        // will trigger a timeout in the authentication packet and connect packet (3rd packet)
        // Here we test the timeout case on the 3rd packet, unit test will test 2nd packet
        delayCountdown = 2;
        delayedClient.set('communicationTimeout', 500);
        delayedDB.init(function (err) { // Connect errors are overwritten to match hana-client
          err.should.be.an.instanceOf(Error);
          err.message.should.equal("Connect failed (connect timeout expired)");
          delayedClient.readyState.should.equal('closed');
          done();
        });
      });

      describeRemoteDB('execute option', function () {
        before(function (done) {
          createDelayedDB(120);
          delayedClient.set('communicationTimeout', 2000);
          delayedDB.init(done);
        });
        after(endDelayedDB);
        

        it('should timeout a client exec', function (done) {
          delayCountdown = 0; // Delay immediately
          delayedClient.exec('SELECT * FROM DUMMY', {communicationTimeout: 100}, validateTimeout(100, done));
        });

        it('should timeout a client execute', function (done) {
          delayCountdown = 0;
          delayedClient.execute('SELECT * FROM DUMMY', {communicationTimeout: 100}, validateTimeout(100, done));
        });

        it('should timeout a prepare', function (done) {
          delayCountdown = 0;
          delayedClient.prepare('SELECT * FROM DUMMY', {communicationTimeout: 100}, validateTimeout(100, done));
        });

        it('should timeout a statement exec', function (done) {
          delayedClient.prepare('SELECT * FROM DUMMY', function (err, stmt) {
            if (err) done(err);
            delayCountdown = 0;
            stmt.exec([], {communicationTimeout: 100}, validateTimeout(100, done));
          });
        });

        it('should timeout a statement execute', function (done) {
          delayedClient.prepare('SELECT * FROM DUMMY', function (err, stmt) {
            if (err) done(err);
            delayCountdown = 0;
            stmt.execute([], {communicationTimeout: 100}, validateTimeout(100, done));
          });
        });

        it('should give the correct query result after a timeout', function (done) {
          delayedClient.exec('SELECT 1 AS A FROM DUMMY', {communicationTimeout: 25}, validateTimeout(25, function () {
            setTimeout(function () {
              delayedClient.exec('SELECT 2 AS A FROM DUMMY', function (err, rows) {
                if (err) done(err);
                rows.should.eql([{A: 2}]);
                done();
              });
            }, 25); // Wait the rest of the time so that the first request is sent
          }));
        });
      });

      describeRemoteDB('write lob', function () {
        before(function (done) {
          if (isRemoteDB) {
            createDelayedDB(300);
            delayedClient.set('communicationTimeout', 2000);
            delayedDB.init(function (err) {
              if (err) done(err);
              delayedDB.createTable.bind(delayedDB)('BLOB_TABLE', ['A BLOB'], null, done);
            });
          } else {
            done();
          }
        });
        after(function (done) {
          if (isRemoteDB) {
            delayedDB.dropTable.bind(delayedDB)('BLOB_TABLE', function () {
              endDelayedDB(done);
            });
          } else {
            done();
          }
        });

        var dirname = path.join(__dirname, '..', 'fixtures', 'img');

        function testWriteLob(lobPacketDelay, done) {
          delayedClient.prepare('INSERT INTO BLOB_TABLE VALUES (?)', function (err, stmt) {
            if (err) done(err);
            delayCountdown = lobPacketDelay;
            stmt.execute([fs.createReadStream(path.join(dirname, 'lobby.jpg'))],
              {communicationTimeout: 250}, validateTimeout(250, function () {
                delayCountdown = -1;
                delayedClient.rollback(done);
              }));
          });
        }

        it('should timeout a lob initial execute request', function (done) {
          testWriteLob(0, done);
        });

        it('should timeout a write lob request', function (done) {
          // Wait for first execute packet to be sent before delaying write lob
          testWriteLob(1, done);
        });
      });

      describeRemoteDB('connect option', function () {
        before(function (done) {
          createDelayedDB(1000);
          // Packets should receive replies within 750ms or these test can fail.
          // The timeout can be increased but the packetDelay passed into createDelayedDB
          // in the line above should also be increased to a number at least as large.
          // 750ms was chosen to prevent this test from waiting too long for the timeout
          delayedClient.set('communicationTimeout', 750);
          delayedDB.init(done);
        });
        after(function (done) {
          endDelayedDB(done);
        });

        it('should timeout a client exec', function (done) {
          delayCountdown = 0;
          delayedClient.exec('SELECT * FROM DUMMY', validateTimeout(750, done));
        });

        it('should timeout fetch packets', function (done) {
          delayedClient.execute('SELECT TOP 33 * FROM OBJECTS', function (err, rs) {
            if (err) done(err);
            delayCountdown = 0;
            rs.fetch(validateTimeout(750, done));
          });
        });

        it('should timeout commit packets', function (done) {
          delayCountdown = 0;
          delayedClient.commit(validateTimeout(750, done));
        })
      });
    });
  });
});
