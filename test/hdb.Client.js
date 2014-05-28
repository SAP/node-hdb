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

var should = require('should');
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
  this._result = undefined;
}

TestClient.prototype._createConnection = mock.createConnection;
TestClient.prototype._createResult = function _createResult() {
  this._result = mock.createResult.apply(this, arguments);
  return this._result;
};

describe('hdb', function () {

  describe('#Client', function () {

    it('should create, connect and close a client', function (done) {
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

    // connect
    it('should not connect with invalid state error', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      connection.readyState = 'connected';
      client.connect(function (err) {
        err.code.should.equal('EHDBCONNECT');
        done();
      });
    });

    it('should not connect because of network error', function (done) {
      var client = new TestClient();
      client._connection.errors.open = true;
      var openError = null;
      client.on('error', function (err) {
        err.message.should.equal('open');
        openError = err;
      });
      client.connect(function (err) {
        err.should.equal(openError);
        done();
      });
    });

    it('should connect with saml assertion', function (done) {
      var client = new TestClient({
        assertion: 'assertion'
      });
      client.connect(function (err) {
        should(err === null).be.ok;
        should(client.get('assertion')).not.be.ok;
        done();
      });
    });

    it('should connect after disconnect', function (done) {
      var client = new TestClient();
      client._connection.readyState = 'disconnected';
      // open should not be called
      client._connection.errors.open = true;
      client.connect(function (err) {
        should(err === null).be.ok;
        done();
      });
    });

    it('should automatically reconnect after network error', function (done) {
      var client = new TestClient({
        autoReconnect: true
      });
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

      function onconnect() {
        connectCount += 1;
        if (connectCount === 1) {
          connection.destroy(new Error('reconnect'));
          return;
        }
        client.close();
      }
      client.on('connect', onconnect);
      client.connect();
    });

    // set and get
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

    // disconnect
    it('should disconnect a client', function (done) {
      var client = new TestClient();
      client.disconnect(function (err) {
        done(err);
      });
    });

    // destroy
    it('should destroy a client without error', function (done) {
      var client = new TestClient();
      client.once('close', function (hadError) {
        hadError.should.be.false;
        done();
      });
      client.destroy();
    });

    it('should destroy a client with error', function (done) {
      var client = new TestClient();
      client.once('error', function (err) {
        err.message.should.equal('destroy');
      });
      client.once('close', function (hadError) {
        hadError.should.be.true;
        done();
      });
      client.destroy(new Error('destroy'));
    });

    // exec
    it('should exec a command', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      connection.replies.executeDirect = {};
      var options = {
        autoFetch: false
      };
      client.exec('sql', options, function (err, reply) {
        should(err === null).be.ok;
        client._connection.options.should.eql({
          command: 'sql'
        });
        reply.should.equal(connection.replies.executeDirect);
        done();
      });
    });

    // execute
    it('should execute a command', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      connection.replies.executeDirect = {};
      client.execute('sql', function (err, reply) {
        should(err === null).be.ok;
        reply.should.equal(connection.replies.executeDirect);
        done();
      });
    });

    it('should execute a command with autoFetch', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      connection.replies.executeDirect = {};
      var autoFetch = true;
      var command = 'sql';
      client.execute(command, autoFetch, function (err, reply) {
        should(err === null).be.ok;
        connection.options.should.eql({
          command: command
        });
        client._result.options.autoFetch.should.be.true;
        reply.should.equal(connection.replies.executeDirect);
        done();
      });
    });

    it('should execute a command with error', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      connection.errors.executeDirect = true;
      client.execute('sql', function (err) {
        err.should.be.an.Error;
        done();
      });
    });

    // prepare
    it('should prepare a statement', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      var options = {
        command: 'sql'
      };
      client.prepare(options.command, function (err, statement) {
        should(err === null).be.ok;
        connection.options.should.eql(options);
        statement.parameterMetadata.should.equal('parameterMetadata');
        statement.resultSetMetadata.should.equal('metadata');
        done();
      });
    });

    it('should prepare a statement with options argument', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      var options = {
        command: 'sql'
      };
      client.prepare(options, function (err, statement) {
        should(err === null).be.ok;
        connection.options.should.eql(options);
        statement.parameterMetadata.should.equal('parameterMetadata');
        statement.resultSetMetadata.should.equal('metadata');
        done();
      });
    });

    // commit   
    it('should commit without error', function (done) {
      var client = new TestClient();
      client.commit(function (err) {
        done(err);
      });
    });

    it('should not commit signaled by transaction flags', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      connection._transactionFlags.committed = false;
      client.commit(function (err) {
        if (err) {
          return done();
        }
        done(new Error('commit'));
      });
    });

    it('should commit with protocol error', function (done) {
      var client = new TestClient();
      client._connection.errors.commit = true;
      client.commit(function (err) {
        err.message.should.equal('commit');
        done();
      });
    });

    // rollback
    it('should roolback without error', function (done) {
      var client = new TestClient();
      client.rollback(function (err) {
        done(err);
      });
    });

    it('should not roolback signaled by transaction flags', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      connection._transactionFlags.rolledBack = false;
      client.rollback(function (err) {
        if (err) {
          return done();
        }
        done(new Error('roolback'));
      });
    });

    it('should rollback with protocol error', function (done) {
      var client = new TestClient();
      client._connection.errors.rollback = true;
      client.rollback(function (err) {
        err.message.should.equal('rollback');
        done();
      });
    });

  });
});