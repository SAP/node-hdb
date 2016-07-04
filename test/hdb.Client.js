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
var lib = require('../lib');
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

    it('should directly connect without constructor', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      connection.readyState = 'connected';
      client.connect(function (err) {
        err.code.should.equal('EHDBCONNECT');
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
          return this.connect();
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
        this.close();
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
      client.execute({
        sql: 'sql'
      }, function (err, reply) {
        should(err === null).be.ok;
        reply.should.equal(connection.replies.executeDirect);
        done();
      });
    });

    it('should execute a command with autoFetch', function (done) {
      var client = new TestClient();
      var connection = client._connection;
      connection.replies.executeDirect = {};
      var command = 'sql';
      client.execute(command, {
        autoFetch: true
      }, function (err, reply) {
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
        (err === null).should.be.ok;
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

    describe('MultiDB support', function () {
      var DB_CONNECT_INFO = {
        CONNECTED: { isConnected: true },
        NOT_CONNECTED: { isConnected: false, host: '127.0.0.1', port: 30041 }
      };

      function prepare(clientOptions) {
        var options = clientOptions || { host: 'localhost', port: 30013, databaseName: 'DB0' };
        var client = new TestClient(options);

        var tempConn = mock.createConnection();
        client._createConnection = function () {
          return tempConn;
        };

        return { client: client, tempConn: tempConn };
      }

      it('should accept an integer as instance number', function (done) {
        var obj = prepare({
          host: 'localhost',
          port: undefined,
          instanceNumber: 2,
          databaseName: 'DB0'
        });
        var client = obj.client;
        var tempConn = obj.tempConn;
        tempConn.replies.dbConnectInfo = DB_CONNECT_INFO.NOT_CONNECTED;

        tempConn.open = function (options, cb) {
          options.port.should.equal(30213);
          cb();
        };
        client.connect(done);
      });

      it('should accept a string as instance number', function (done) {
        var obj = prepare({
          host: 'localhost',
          port: undefined,
          instanceNumber: '00',
          databaseName: 'DB0'
        });
        var client = obj.client;
        var tempConn = obj.tempConn;
        tempConn.replies.dbConnectInfo = DB_CONNECT_INFO.NOT_CONNECTED;

        tempConn.open = function (options, cb) {
          options.port.should.equal(30013);
          cb();
        };
        client.connect(done);
      });

      it('should report an error if instance number string is not valid', function (done) {
        var client = new TestClient({
          host: 'localhost',
          port: undefined,
          instanceNumber: [],
          databaseName: 'DB0'
        });

        client.connect(function (err) {
          err.message.should.be.equal('Instance Number is not valid');
          done();
        });
      });

      it('should emit error if error event has occurred on the temporary connection', function (done) {
        var obj = prepare();
        var client = obj.client;
        var tempConn = obj.tempConn;
        tempConn.errors.open = true;

        client.on('error', function (err) {
          err.message.should.equal('open');
          done();
        });

        client.connect();
      });

      it('should close the temporary connection in case of error during opening it', function (done) {
        var obj = prepare();
        var client = obj.client;
        var tempConn = obj.tempConn;
        tempConn.errors.open = true;

        var tempConnClosed = false;
        var errorEmitted = false;

        tempConn.on('close', function () {
          tempConnClosed = true;
        });
        client.on('error', function (err) {
          errorEmitted = true;
        });

        client.connect(function (err) {
          err.message.should.equal('open');
          tempConnClosed.should.equal(true);
          errorEmitted.should.equal(true);
          done();
        });
      });

      it('should close the temporary connection in case fetching DB_CONNECT_INFO fails', function (done) {
        var obj = prepare();
        var client = obj.client;
        var tempConn = obj.tempConn;
        tempConn.errors.dbConnectInfo = true;

        var tempConnClosed = false;

        tempConn.on('close', function () {
          tempConnClosed = true;
        });

        client.connect(function (err) {
          err.message.should.equal('dbConnectInfo');
          tempConnClosed.should.equal(true);
          done();
        });
      });

      it('should reuse the temporary connection if the client has connected to the target tenant-db', function (done) {
        var obj = prepare({
          host: 'localhost',
          port: 30041,
          databaseName: 'DB0'
        });
        var client = obj.client;
        var tempConn = obj.tempConn;
        tempConn.replies.dbConnectInfo = DB_CONNECT_INFO.CONNECTED;

        tempConn.open = function (options, cb) {
          options.host.should.equal('localhost');
          options.port.should.equal(30041);
          cb();
        };

        client._connection.open = function () {
          done(new Error('Open method of the current client connection should not be invoked'));
        };


        var currentClientConnectionClosed = false;
        var standardConnectionListenersAdded = false;

        client._connection.close = function () {
          client._connection.should.not.equal(tempConn);
          currentClientConnectionClosed = true;
          standardConnectionListenersAdded.should.equal(false);
        };
        client._addListeners = function () {
          currentClientConnectionClosed.should.equal(true);
          standardConnectionListenersAdded = true;
        };

        client.connect(function (err) {
          client._connection.should.equal(tempConn);
          standardConnectionListenersAdded.should.equal(true);
          done(err);
        });
      });

      it('should open a connection to the target tenant-db', function (done) {
        var obj = prepare();
        var client = obj.client;
        var tempConn = obj.tempConn;
        tempConn.replies.dbConnectInfo = DB_CONNECT_INFO.NOT_CONNECTED;

        tempConn.open = function (options, cb) {
          options.host.should.equal('localhost');
          options.port.should.equal(30013);
          cb();
        };

        client._connection.open = function (options, cb) {
          options.host.should.equal('127.0.0.1');
          options.port.should.equal(30041);
          cb();
        };

        var tempConnClosed = false;

        tempConn.on('close', function () {
          tempConnClosed = true;
        });

        client.connect(function (err) {
          tempConnClosed.should.equal(true);
          client._connection.should.not.equal(tempConn);
          done(err);
        });

      });

      it('should use the same set of certificates for both connection to system-db and tenant-db', function (done) {
        var certificates = ['certificate for system-db', 'certificate for tenant-db'];
        var obj = prepare({
          host: 'localhost',
          port: 30013,
          databaseName: 'DB0',
          ca: certificates
        });
        var client = obj.client;
        var tempConn = obj.tempConn;
        tempConn.replies.dbConnectInfo = DB_CONNECT_INFO.NOT_CONNECTED;

        tempConn.open = function (options, cb) {
          options.ca.should.deepEqual(certificates);
          cb();
        };

        client._connection.open = function (options, cb) {
          options.ca.should.deepEqual(certificates);
          cb();
        };

        client.connect(done);
      });

      it('should be possible to overwrite MultiDB settings in the connect method', function (done) {
        var obj = prepare({
          host: 'localhost',
          port: undefined,
          instanceNumber: 0,
          databaseName: 'DB0'
        });
        var client = obj.client;
        var tempConn = obj.tempConn;

        tempConn.open = function (options, cb) {
          options.port.should.equal(31113);
          cb();
        };

        tempConn.fetchDbConnectInfo = function (options, cb) {
          options.databaseName.should.equal('DB1');
          cb(null, DB_CONNECT_INFO.NOT_CONNECTED);
        };

        client.connect({ instanceNumber: 11, databaseName: 'DB1' }, done);
      });

    });

  });
});