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
/*jshint expr:true*/

var lib = require('./hdb').lib;
var util = lib.util;
var mock = require('./mock');

util.inherits(TestClient, lib.Client);

function TestClient(options) {
  options = util.extend({
    host: 'localhost',
    port: 30015,
    user: 'TEST_USER',
    password: 'secret'
  }, options);
  lib.Client.call(this, options);
}

TestClient.prototype._createConnection = mock.createConnection;

describe('hdb', function () {

  describe('#Client', function () {

    it('should create a Client', function (done) {
      var client = new TestClient();
      var connection = client._connection;

      connection.constructor.name.should.equal('MockConnection');
      client.connectOptions.should.equal(connection.connectOptions);
      client.clientId.should.equal(connection.clientId);
      client.readyState.should.equal('new');

      connection.autoCommit.should.be.true;
      client.setAutoCommit(false);
      connection.autoCommit.should.be.false;

      function cleanup() {
        client.removeListener('error', onerror);
        client.removeListener('close', onclose);
      }

      function onerror(err) {
        cleanup();
        done(err);
      }
      client.on('error', onerror);

      function onclose(hadError) {
        cleanup();
        hadError.should.be.false;
        done();
      }
      client.on('close', onclose);

      client.connect(function (err) {
        if (err) {
          cleanup();
          return done(err);
        }
        client.close();
      });
    });


    it('should reconnect on error', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      var errorCount = 0;
      var closeCount = 0;
      var connectCount = 0;

      function cleanup() {
        client.removeListener('error', onerror);
        client.removeListener('close', onclose);
        client.removeListener('connect', onconnect);
      }

      function onerror(err) {
        errorCount += 1;
        if (errorCount === 1) {
          err.message.should.equal('reconnect');
          return;
        }
        cleanup();
        done(err);
      }
      client.on('error', onerror);

      function onclose(hadError) {
        closeCount += 1;
        if (closeCount === 1) {
          hadError.should.be.true;
          return;
        }
        cleanup();
        hadError.should.be.false;
        done();
      }
      client.on('close', onclose);

      function onconnect(err) {
        connectCount += 1;
        if (connectCount === 1) {
          connection.setError('reconnect');
          return;
        }
        client.close();
      }
      client.on('connect', onconnect);
      client.connect();
    });

    it('should roolback without error', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      client.rollback(function (err) {
        done(err);
      });
    });

    it('should roolback with error', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      connection._transactionFlags.rolledBack = false;
      client.rollback(function (err) {
        if (err) {
          return done();
        }
        done(new Error('roolback'))
      });
    });

    it('should commit without error', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      client.commit(function (err) {
        done(err);
      });
    });

    it('should commit with error', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      connection._transactionFlags.committed = false;
      client.commit(function (err) {
        if (err) {
          return done();
        }
        done(new Error('commit'))
      });
    });

    it('should get and set an option', function () {
      var client = new TestClient();
      var connection = client._connection;
      client.set('foo', true).should.equal(client);
      client.get('foo').should.equal(connection._settings.foo);
      client.set({
        bar: 1
      });
      client.get().should.equal(connection._settings);
    });

  });
});