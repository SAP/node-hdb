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

    it('should initialize useCesu8 to "true" by default', function() {
      new TestClient()._connection._settings.useCesu8.should.eql(true);
      new TestClient({ useCesu8: ''})._connection._settings.useCesu8.should.eql(true);
    });

    it('should initialize useCesu8 to accordign to provided options', function() {
      new TestClient({ useCesu8: true})._connection._settings.useCesu8.should.eql(true);
      new TestClient({ useCesu8: false})._connection._settings.useCesu8.should.eql(false);
    });

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

      client.connect(function (err) {
        err.message.should.equal('Could not connect to any host: [ localhost:30015 - open ]');
        err.code.should.equal('EHDBOPENCONN');
        done();
      });
    });

    it('should emit an error if there is an error listener attached', function (done) {
      var client = new TestClient();
      client._connection = createConn();
      function createConn() {
        var connection = new lib.Connection();
        connection._connect = function (options, connectListener) {
          var socket = mock.createSocket(options);
          util.setImmediate(connectListener);
          return socket;
        };
        return connection;
      }

      client.connect(function (err) {
        client._connection._socket.emit('error');
        client.on('error', done.bind());
        client._connection._socket.emit('error');
      });
    });

    it('should report error if server gently closes the connection (with a FIN packet)', function (done) {
      var client = new lib.Client();
      client._connection = createConn();
      client._connection._createAuthenticationManager = function () {
        return { initialData: function () { return 'some data'; } };
      };

      function createConn() {
        var connection = new lib.Connection();
        connection._connect = function (options, connectListener) {
          var socket = mock.createSocket(options);
          util.setImmediate(connectListener);
          return socket;
        };
        return connection;
      }

      client.on('error', function (err) {
        done(err);
      });

      client.connect(function (err) {
        err.message.should.equal('Connection closed by server');
        err.code.should.equal('EHDBCLOSE');
        done();
      });
    });

    describe('#secure connection', function () {
      var tcp = require('../lib/protocol/tcp');
      var originalCreateSocket = tcp.createSocket;
      var originalCreateSecureSocket = tcp.createSecureSocket;

      var socketStub;
      var createSocketCalled;
      var createSecureSocketCalled;

      var createSocketStub = function () {
        createSocketCalled = true;
        return socketStub;
      };
      var createSecureSocketStub = function () {
        createSecureSocketCalled = true;
        return socketStub;
      };

      function assertSecureConnection() {
        should(createSocketCalled).be.false();
        should(createSecureSocketCalled).be.true();
      }

      function assertPlainConnection() {
        should(createSocketCalled).be.true();
        should(createSecureSocketCalled).be.false();
      }

      beforeEach(function () {
        createSocketCalled = false;
        createSecureSocketCalled = false;
        socketStub = new mock.createSocket({});
        socketStub.setNoDelay = function () {
          process.nextTick(function () {
            socketStub.write();
          });
        };
        tcp.createSocket = createSocketStub;
        tcp.createSecureSocket = createSecureSocketStub;
      });

      afterEach(function () {
        tcp.createSocket = originalCreateSocket;
        tcp.createSecureSocket = originalCreateSecureSocket;
      });

      it('should connect using plain connection if useTLS is not specified', function (done) {
        var client = new lib.Client();
        client.connect(function (err) {
          assertPlainConnection();
          done();
        });
      });

      it('should connect using plain connection if useTLS is not true', function (done) {
        var client = new lib.Client({
          useTLS: false
        });
        client.connect(function (err) {
          assertPlainConnection();
          done();
        });
      });

      it('should connect using TLS if useTLS is true', function (done) {
        var client = new lib.Client({
          useTLS: true
        });
        client.connect(function (err) {
          assertSecureConnection();
          done();
        });
      });

    });

    describe('#TCP keepalive', function () {

      var tcp = require('../lib/protocol/tcp');
      var originalCreateSocket = tcp.createSocket;
      var socketStub;

      beforeEach(function () {
        socketStub = new mock.createSocket({});
        socketStub.setNoDelay = function () {
          process.nextTick(function () {
            socketStub.write();
          });
        };
        tcp.createSocket = function () {
            return socketStub;
        };
      });

      afterEach(function () {
        tcp.createSocket = originalCreateSocket;
      });

      it('should set tcpKeepAliveIdle by default', function (done) {
        var client = new lib.Client({});
        client.connect(function (err) {
          should(client._connection._socket.keepAlive).be.true();
          should(client._connection._socket.keepAliveIdle).be.equal(200000);
          done();
        });
      });

      it('should set tcpKeepAliveIdle via numeric connect option', function (done) {
        var client = new lib.Client({
          tcpKeepAliveIdle: 300
        });
        client.connect(function (err) {
          should(client._connection._socket.keepAlive).be.true();
          should(client._connection._socket.keepAliveIdle).be.equal(300000);
          done();
        });
      });

      it('should set tcpKeepAliveIdle via string connect option', function (done) {
        var client = new lib.Client({
          tcpKeepAliveIdle: '300'
        });
        client.connect(function (err) {
          should(client._connection._socket.keepAlive).be.true();
          should(client._connection._socket.keepAliveIdle).be.equal(300000);
          done();
        });
      });

      it('should disable tcp keepalive', function (done) {
        var client = new lib.Client({
          tcpKeepAliveIdle: false
        });
        client.connect(function (err) {
          should(client._connection._socket.keepAlive).be.false();
          done();
        });
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
      client._addListeners(client._connection);
      client.once('close', function (hadError) {
        hadError.should.be.false;
        done();
      });
      client.destroy();
    });

    it('should destroy a client with error', function (done) {
      var client = new TestClient();
      client._addListeners(client._connection);
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

    describe('#connecting to a host from list', function () {

      function connectClient(client, hostToErrMapping, cb) {
        var connOpenCount = 0;
        client._connection.open = function (options, cb) {
          ++connOpenCount;
          options.should.be.an.Object;
          options.should.have.property('host');
          options.should.have.property('port');
          util.setImmediate(function () {
            cb(hostToErrMapping[connOpenCount]);
          });
        };

        client.connect(function (err) {
          cb({ err: err, connOpenCount: connOpenCount });
        });
      }

      it('should connect to the first host from the list', function (done) {
        var client = new TestClient({
          hosts: [{ host: 'host.1', port: 30215 }, { host: 'host.2', port: 30215 }]
        });
        var hostToErrMapping = { '1': null, '2': null };

        connectClient(client, hostToErrMapping, function (result) {
          should(result.err).be.equal(null);
          result.connOpenCount.should.equal(1);
          done();
        });
      });

      it('should connect to the last host from the list', function (done) {
        var client = new TestClient({
          hosts: [{ host: 'host.1', port: 30215 }, { host: 'host.2', port: 30215 }]
        });
        var hostToErrMapping = { '1': new Error('Connection refused'), '2': null };

        connectClient(client, hostToErrMapping, function (result) {
          should(result.err).be.equal(null);
          result.connOpenCount.should.equal(2);
          done();
        });
      });

      it('should not connect to any of the given hosts', function (done) {
        var client = new TestClient({
          hosts: [{ host: 'host.1', port: 30215 }, { host: 'host.2', port: 30215 }]
        });
        var hostToErrMapping = { '1': new Error('Connection refused to host #1'), '2': new Error('Connection refused to host #2') };

        connectClient(client, hostToErrMapping, function (result) {
          result.err.message.should.equal('Could not connect to any host: [ host.1:30215 - Connection refused to host #1 ] [ host.2:30215 - Connection refused to host #2 ]');
          result.connOpenCount.should.equal(2);
          done();
        });
      });

    });

    describe('#MultiDB support', function () {
      var DB_CONNECT_INFO = {
        CONNECTED: { isConnected: true },
        NOT_CONNECTED: { isConnected: false, host: '127.0.0.1', port: 30041 }
      };

      it('should accept an integer as instance number', function (done) {
        var client = new TestClient({
          host: 'localhost',
          port: undefined, instanceNumber: 2,
          databaseName: 'DB0'
        });

        client._connection.replies.dbConnectInfo = DB_CONNECT_INFO.CONNECTED;
        client._connection.open = function (options, cb) {
          options.port.should.equal(30213);
          cb();
        };

        client.connect(done);
      });

      it('should accept a string as instance number', function (done) {
        var client = new TestClient({
          host: 'localhost',
          port: undefined, instanceNumber: '00',
          databaseName: 'DB0'
        });

        client._connection.replies.dbConnectInfo = DB_CONNECT_INFO.CONNECTED;
        client._connection.open = function (options, cb) {
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
          err.message.should.be.equal('Could not connect to any host: [ localhost:NaN - Instance Number is not valid ]');
          done();
        });
      });

      it('should report an error if error event has occurred during fetching DB_CONNECT_INFO', function (done) {
        var client = new TestClient({
          host: 'localhost',
          port: 30013,
          databaseName: 'DB0'
        });

        client._connection.fetchDbConnectInfo = function (options, cb) {
          cb(new Error('Network error'));
        };

        client.connect(function (err) {
          err.message.should.equal('Could not connect to any host: [ localhost:30013 - Network error ]');
          done();
        });
      });

      it('should close the connection to system-db in case of error during opening it', function (done) {
        var client = new TestClient({
          host: 'localhost',
          port: 30013,
          databaseName: 'DB0'
        });
        client._connection.errors.open = true;

        var connClosed = false;

        client._connection.on('close', function () {
          connClosed = true;
        });

        client.connect(function (err) {
          err.message.should.equal('Could not connect to any host: [ localhost:30013 - open ]');
          connClosed.should.equal(true);
          done();
        });
      });

      it('should close the connection to system-db in case fetching DB_CONNECT_INFO fails', function (done) {
        var client = new TestClient({
          host: 'localhost',
          port: 30013,
          databaseName: 'DB0'
        });
        client._connection.errors.dbConnectInfo = true;

        var connClosed = false;

        client._connection.on('close', function () {
          connClosed = true;
        });

        client.connect(function (err) {
          err.message.should.equal('Could not connect to any host: [ localhost:30013 - dbConnectInfo ]');
          connClosed.should.equal(true);
          done();
        });
      });

      it('should not open a second connection if already connected to the target tenant-db', function (done) {
        var client = new TestClient({
          host: 'localhost',
          port: 30041,
          databaseName: 'DB0'
        });
        client._connection.replies.dbConnectInfo = DB_CONNECT_INFO.CONNECTED;

        var tenantDbConnOpened = false;
        client._connection.open = function (options, cb) {
          options.host.should.equal('localhost');
          options.port.should.equal(30041);
          tenantDbConnOpened = true;
          cb();
        };

        var standardConnectionListenersAdded = false;

        client._addListeners = function (conn) {
          conn.should.equal(client._connection);
          standardConnectionListenersAdded = true;
        };

        client.connect(function (err) {
          standardConnectionListenersAdded.should.equal(true);
          tenantDbConnOpened.should.equal(true);
          done(err);
        });
      });

      it('should open a connection to the target tenant-db (through call to system-db first)', function (done) {
        var client = new TestClient({ host: 'localhost', port: 30013, databaseName: 'DB0' });
        client._connection.replies.dbConnectInfo = DB_CONNECT_INFO.NOT_CONNECTED;

        var connOpenCount = 0;

        var systemDbConnOpened = false;
        var systemDbConnClosed = false;
        var tenantDbConnOpened = false;

        client._connection.open = function (options, cb) {
          ++connOpenCount;
          if (connOpenCount === 1) {
            options.host.should.equal('localhost');
            options.port.should.equal(30013);
            systemDbConnOpened = true;
            cb();
          } else if (connOpenCount === 2) {
            options.host.should.equal('127.0.0.1');
            options.port.should.equal(30041);
            tenantDbConnOpened = true;
            cb();
          } else {
            cb(new Error('Test error. Open method called on the connection ' + connOpenCount + ' times.'));
          }
        };

        client._connection._closeSilently = function () {
          connOpenCount.should.equal(1);
          systemDbConnClosed = true;
        };

        client.connect(function (err) {
          systemDbConnOpened.should.equal(true);
          systemDbConnClosed.should.equal(true);
          tenantDbConnOpened.should.equal(true);
          done(err);
        });

      });

      it('should use the same set of certificates for both connection to system-db and tenant-db', function (done) {
        var certificates = ['certificate for system-db', 'certificate for tenant-db'];
        var client = new TestClient({
          host: 'localhost',
          port: 30013,
          databaseName: 'DB0',
          ca: certificates
        });
        client._connection.replies.dbConnectInfo = DB_CONNECT_INFO.NOT_CONNECTED;

        var connOpenCount = 0;

        client._connection.open = function (options, cb) {
          ++connOpenCount;
          options.ca.should.deepEqual(certificates);
          cb();
        };

        client.connect(function (err) {
          connOpenCount.should.equal(2);
          done(err);
        });
      });

      it('should be possible to overwrite MultiDB settings in the connect method', function (done) {
        var client = new TestClient({
          host: 'localhost',
          port: undefined, instanceNumber: 0,
          databaseName: 'DB0'
        });

        client._connection.open = function (options, cb) {
          options.port.should.equal(31113);
          cb();
        };

        client._connection.fetchDbConnectInfo = function (options, cb) {
          options.databaseName.should.equal('DB1');
          cb(null, DB_CONNECT_INFO.CONNECTED);
        };

        client.connect({ instanceNumber: 11, databaseName: 'DB1' }, done);
      });

      it('should display correct port number when hosts and instanceNumber are provided', function (done) {
        var client = new TestClient({
          hosts: [{ host: 'host.1' }],
          port: undefined,
          instanceNumber: 4,
          databaseName: 'DB0'
        });
        client._connection.errors.open = true;

        client.connect(function (err) {
          err.message.should.equal('Could not connect to any host: [ host.1:30413 - open ]');
          done();
        });
      });

    });

  });
});
