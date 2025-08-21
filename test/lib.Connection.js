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
var mock = require('./mock');
var util = lib.util;
var Connection = lib.Connection;
var MessageType = lib.common.MessageType;
var FunctionCode = lib.common.FunctionCode;
var SegmentKind = lib.common.SegmentKind;
var ErrorLevel = lib.common.ErrorLevel;
var PartKind = lib.common.PartKind;
const Compressor = lib.Compressor;
const DataFormatVersion = lib.common.DataFormatVersion;
const assert = require('assert');

function connect(options, connectListener) {
  var socket = mock.createSocket(options);
  util.setImmediate(connectListener);
  return socket;
}

function createConnection(options) {
  var settings = {};
  var connection = new Connection(util.extend(settings, options));
  connection._connect = connect;
  connection._settings.should.equal(settings);
  (!!connection._socket).should.be.not.ok;
  return connection;
}

function getAuthenticationPart(req) {
  return req.parts
    .filter(function (part) {
      return part.kind === PartKind.AUTHENTICATION;
    })
    .shift().args;
}

function sendAuthenticationRequest(req, done) {
  var reply = {
    authentication: getAuthenticationPart(req),
  };
  if (reply.authentication instanceof Error) {
    return done(reply.authentication);
  }
  if (reply.authentication === 'FINAL') {
    reply.connectOptions = [];
  }
  done(null, reply);
}

describe('Lib', function () {
  describe('#Connection', function () {
    it('should create a connection without any options', function () {
      var connection = new Connection();
      connection._settings.should.eql({});
    });

    it('should create client info without options', function () {
      var connection = new Connection();
      connection.getClientInfo().getUpdatedProperties().should.eql([]);
    });

    it('should send client info parts for execute requests', function (done) {
      var connection = createConnection();
      connection.open({}, function () {
        connection.getClientInfo().setProperty('LOCALE', 'en_US');
        connection.getClientInfo().shouldSend(MessageType.EXECUTE).should.eql(true);
        connection.send(new lib.request.Segment(MessageType.EXECUTE), null);
        connection.getClientInfo().shouldSend(MessageType.EXECUTE).should.eql(false);
        connection.getClientInfo().getProperty('LOCALE').should.eql('en_US');
        done();
      });
    });

    it('should create a connection with a custom clientId', function () {
      var clientId = 'myClientId';
      var connection = new Connection({
        clientId: clientId,
      });
      connection.clientId.should.equal(clientId);
    });

    it('should create a connection', function () {
      var connection = createConnection();
      var state = connection._state;
      connection.clientId.should.equal(util.cid);
      connection.setAutoCommit(true);
      connection.autoCommit = true;
      connection.autoCommit.should.be.true;
      connection.holdCursorsOverCommit = true;
      connection.holdCursorsOverCommit.should.be.true;
      connection.scrollableCursor = true;
      connection.scrollableCursor.should.be.true;
      connection.readyState.should.equal('new');
      connection._socket = {
        readyState: 'open',
      };
      connection.readyState.should.equal('opening');
      connection.protocolVersion = {
        major: 4,
        minor: 1,
      };
      connection.readyState.should.equal('disconnected');
      state.messageType = MessageType.AUTHENTICATE;
      connection.readyState.should.equal('connecting');
      state.messageType = MessageType.CONNECT;
      connection.readyState.should.equal('connecting');
      state.messageType = MessageType.NIL;
      state.sessionId = 1;
      connection.readyState.should.equal('connected');
      state.messageType = MessageType.DISCONNECT;
      connection.readyState.should.equal('disconnecting');
      connection._socket.readyState = 'readOnly';
      connection.readyState.should.equal('closed');
      connection._state = undefined;
      connection.readyState.should.equal('closed');
    });

    it('should close an already closed Connection', function () {
      var connection = createConnection();
      connection._state = undefined;
      connection.close();
      connection.readyState.should.equal('closed');
    });

    it('#_closeSilently - should do nothing if there is no socket', function () {
      var connection = createConnection();
      connection.readyState.should.equal('new');
      connection._closeSilently();
      connection.readyState.should.equal('new');
    });

    it('#_closeSilently - should close the socket of a connection, but keep the state', function () {
      var connection = createConnection();
      var listenersRemoved = false;
      var socketDestroyed = false;
      connection._socket = {
        readyState: 'open',
        destroy: function () {
          socketDestroyed = true;
        },
        removeAllListeners: function (eventName) {
          eventName.should.equal('close');
          listenersRemoved = true;
        },
      };

      connection.on('close', function () {
        throw new Error('Close vent should not have been emitted');
      });

      connection._closeSilently();
      connection._state.should.be.instanceof(Object);
      listenersRemoved.should.equal(true);
      socketDestroyed.should.equal(true);
    });

    it('should open and close a Connection', function (done) {
      var connection = createConnection();
      connection.open({}, function (err) {
        (!!err).should.be.not.ok;
        connection._socket.readyState.should.equal('open');
        connection.protocolVersion.major.should.equal(4);
        connection.protocolVersion.minor.should.equal(1);
        connection.readyState.should.equal('disconnected');
        connection.close();
      });
      connection.on('close', function (hadError) {
        hadError.should.be.false;
        connection.readyState.should.equal('closed');
        done();
      });
      connection.readyState.should.equal('opening');
    });

    it('should replace socket and move error listener during open()', function (done) {
      const connection = createConnection();
      const oldSocket = mock.createSocket({});
      const newSocket = mock.createSocket({});
      connection._connect = function (options, cb) {
        process.nextTick(() => cb(null, newSocket));
        return oldSocket;
      };
      connection.open({}, function (err) {
        (!!err).should.be.not.ok;
        oldSocket.listeners('error').length.should.equal(0);
        oldSocket.listeners('data').length.should.equal(0);
        const errorListeners = newSocket.listeners('error');
        errorListeners.length.should.equal(1);
        errorListeners[0].should.be.a.Function();
        const dataListeners = newSocket.listeners('data');
        dataListeners.length.should.equal(1);
        dataListeners[0].should.be.a.Function();
        done();
      });
    });

    it('should fail to open a Connection with an invalid reply', function (done) {
      var connection = createConnection();
      connection.open(
        {
          invalidInitializationReply: true,
        },
        function (err) {
          err.code.should.equal('EHDBINIT');
          done();
        },
      );
    });

    it('should fail to open a Connection with an initialization timeout', function (done) {
      var connection = createConnection({
        initializationTimeout: 20,
      });
      connection.open(
        {
          delay: 30,
        },
        function (err) {
          err.code.should.equal('EHDBTIMEOUT');
          connection._socket.readable.should.be.false;
          done();
        },
      );
    });

    it('should fail to open a Connection with a socket error', function (done) {
      var connection = createConnection();
      connection.open(
        {
          initializationErrorCode: 'SOCKET_ERROR',
        },
        function (err) {
          err.code.should.equal('SOCKET_ERROR');
          done();
        },
      );
    });

    it('should destroy socket after disconnect', function (done) {
      var connection = createConnection();
      connection.enqueue = function enqueue(msg, cb) {
        msg.type.should.equal(MessageType.DISCONNECT);
        setImmediate(function () {
          cb();
        });
      };
      connection.open({}, function (err) {
        (!!err).should.be.not.ok;
        connection._socket.readyState.should.equal('open');
        connection.disconnect(function () {
          connection.readyState.should.equal('closed');
          done();
        });
      });
    });

    it('should destroy itself on transaction error', function (done) {
      var connection = createConnection();
      connection.open({}, function (err) {
        (!!err).should.be.not.ok;
        connection.readyState.should.equal('disconnected');
        connection._socket.end();
        connection.readyState.should.equal('closed');
        connection.setTransactionFlags({
          sessionClosingTransactionErrror: true,
        });
        connection.readyState.should.equal('closed');
        done();
      });
    });

    it('should dispatch a socket error', function (done) {
      var connection = createConnection();
      var socketError = new Error('SOCKET_ERROR');
      connection.open({}, function (err) {
        (!!err).should.be.not.ok;
        connection._socket.emit('error', socketError);
      });
      connection.once('error', function (err) {
        err.should.equal(socketError);
        done();
      });
    });

    it('should get the available message buffer size', function () {
      var totalHeaderLength = 32 + 24 + 16; // PACKET_HEADER_LENGTH + SEGMENT_HEADER_LENGTH + PART_HEADER_LENGTH
      var packetSizeMin = Math.pow(2, 16);
      var packetSizeMax = Math.pow(2, 30) - 1;
      var packetSizeDefault = Math.pow(2, 17);
      var c1 = createConnection();
      c1._statementContext = {
        size: 32,
      };
      c1.getAvailableSize().should.equal(packetSizeDefault - totalHeaderLength - 32);
      c1.getAvailableSize(true).should.equal(packetSizeDefault - totalHeaderLength - 32);

      // packetSize defined, packetSizeLimit undefined
      var ps = Math.pow(2, 18);
      var psl = undefined;
      var c2 = createConnection({ packetSize: ps, packetSizeLimit: psl });
      c2.getAvailableSize(false).should.equal(ps - totalHeaderLength);
      c2.getAvailableSize(true).should.equal(ps - totalHeaderLength);

      // packetSize undefined, packetSizeLimit defined
      ps = undefined;
      psl = Math.pow(2, 19);
      var c3 = createConnection({ packetSize: ps, packetSizeLimit: psl });
      c3.getAvailableSize(false).should.equal(psl - totalHeaderLength);
      c3.getAvailableSize(true).should.equal(packetSizeDefault - totalHeaderLength);

      // packetSizeLimit is larger than packetSize
      ps = Math.pow(2, 20);
      psl = Math.pow(2, 21);
      var c4 = createConnection({ packetSize: ps, packetSizeLimit: psl });
      c4.getAvailableSize(false).should.equal(psl - totalHeaderLength);
      c4.getAvailableSize(true).should.equal(ps - totalHeaderLength);

      // packetSizeLimit is smaller than packetSize
      ps = Math.pow(2, 20);
      psl = Math.pow(2, 19);
      var c4 = createConnection({ packetSize: ps, packetSizeLimit: psl });
      c4.getAvailableSize(false).should.equal(ps - totalHeaderLength);
      c4.getAvailableSize(true).should.equal(ps - totalHeaderLength);

      // packetSize below minimum
      ps = Math.pow(2, 10);
      psl = Math.pow(2, 20);
      var c5 = createConnection({ packetSize: ps, packetSizeLimit: psl });
      c5.getAvailableSize(false).should.equal(psl - totalHeaderLength);
      c5.getAvailableSize(true).should.equal(packetSizeMin - totalHeaderLength);

      // packetSizeLimit above maximum
      ps = Math.pow(2, 20);
      psl = Math.pow(2, 31);
      var c6 = createConnection({ packetSize: ps, packetSizeLimit: psl });
      c6.getAvailableSize(false).should.equal(packetSizeMax - totalHeaderLength);
      c6.getAvailableSize(true).should.equal(ps - totalHeaderLength);

      // packetSize and packetSizeLimit below minimum
      ps = Math.pow(2, 10);
      psl = Math.pow(2, 9);
      var c7 = createConnection({ packetSize: ps, packetSizeLimit: psl });
      c7.getAvailableSize(false).should.equal(packetSizeMin - totalHeaderLength);
      c7.getAvailableSize(true).should.equal(packetSizeMin - totalHeaderLength);

      // packetSize and packetSizeLimit above maximum
      ps = Math.pow(2, 32);
      psl = Math.pow(2, 31);
      var c8 = createConnection({ packetSize: ps, packetSizeLimit: psl });
      c8.getAvailableSize(false).should.equal(packetSizeMax - totalHeaderLength);
      c8.getAvailableSize(true).should.equal(packetSizeMax - totalHeaderLength);
    });

    it('should parse a reply', function () {
      var connection = createConnection();
      var segment = new lib.reply.Segment();
      segment.kind = SegmentKind.REPLY;
      var reply = connection._parseReplySegment(segment.toBuffer(0));
      reply.kind.should.equal(SegmentKind.REPLY);
      reply.functionCode.should.equal(FunctionCode.NIL);
    });

    it('should receive different kind of replies', function () {
      var connection = createConnection();
      var replies = {
        errorSegment: {
          kind: SegmentKind.ERROR,
          error: new Error('ERROR_SEGMENT'),
        },
        transactionError: {
          kind: SegmentKind.REPLY,
          transactionFlags: {
            sessionClosingTransactionErrror: true,
          },
        },
        parseError: new Error('PARSE_ERROR'),
        noError: {
          kind: SegmentKind.REPLY,
        },
      };
      connection._parseReplySegment = function parseReplySegment(buffer) {
        var reply = replies[buffer.toString()];
        if (reply instanceof Error) {
          throw reply;
        }
        return reply;
      };
      connection.receive(new Buffer('noError'), function (err, reply) {
        (!!err).should.be.not.ok;
        reply.should.equal(replies.noError);
      });
      connection.receive(new Buffer('errorSegment'), function (err) {
        err.should.equal(replies.errorSegment.error);
      });
      connection.receive(new Buffer('parseError'), function (err) {
        err.should.equal(replies.parseError);
      });
      connection.receive(new Buffer('transactionError'), function (err) {
        err.code.should.equal('EHDBTX');
      });
    });

    it('should enqueue a mesage', function () {
      var connection = createConnection();
      connection._socket = {
        readyState: 'open',
      };
      connection._queue.pause();
      connection.enqueue(function firstTask() {});
      connection.enqueue(new lib.request.Segment(MessageType.EXECUTE));
      connection.enqueue({
        name: 'thirdTask',
        run: function () {},
      });
      connection.close();
      var taskNames = connection._queue.queue.map(function taskName(task) {
        return task.name;
      });
      taskNames.should.eql(['firstTask', 'EXECUTE', 'thirdTask']);
    });

    it('should report error in enqueue when connection is invalid', function (done) {
      var connection = createConnection();
      connection._queue.pause();
      connection.enqueue(
        function firstTask() {},
        function (err) {
          err.code.should.equal('EHDBCLOSE');
          done();
        },
      );
    });

    it('should rollback a transaction', function () {
      var connection = createConnection();
      connection.enqueue = function enqueue(msg, done) {
        done(msg);
      };

      function cb(msg) {
        msg.type.should.equal(MessageType.ROLLBACK);
      }
      connection.rollback(cb);
      connection.rollback({}, cb);
    });

    it('should commit a transaction', function () {
      var connection = createConnection();
      connection.enqueue = function enqueue(msg, done) {
        done(msg);
      };

      function cb(msg) {
        msg.type.should.equal(MessageType.COMMIT);
      }
      connection.commit(cb);
      connection.commit({}, cb);
    });

    it('should execute a statement', function () {
      var connection = createConnection();
      connection.enqueue = function enqueue(msg, done) {
        done(msg);
      };

      function cb(msg) {
        msg.type.should.equal(MessageType.EXECUTE);
      }
      connection.execute({}, cb);
    });

    describe('DB_CONNECT_INFO', function () {
      var DATA = require('./mock/data/dbConnectInfo');

      function prepareConnection(segmentData) {
        var connection = createConnection();
        connection._socket = {
          readyState: 'open',
        };
        connection.send = function (msg, cb) {
          var segment = new lib.reply.Segment(segmentData.kind, segmentData.functionCode);
          var part = segmentData.parts[0];
          segment.push(
            new lib.reply.Part(part.kind, part.attributes, part.argumentCount, part.buffer),
          );
          cb(null, segment.getReply());
        };

        return connection;
      }

      it('should fetch DB_CONNECT_INFO with an error (no state)', function (done) {
        var connection = prepareConnection(DATA.NOT_CONNECTED);
        connection._state = undefined;
        connection.fetchDbConnectInfo({}, function (err, info) {
          err.code.should.equal('EHDBCLOSE');
          done();
        });
      });

      it('fetch DB_CONNECT_INFO with an error (send error)', function (done) {
        var connection = createConnection();
        connection._socket = {
          readyState: 'open',
        };
        connection.send = function (msg, cb) {
          cb(new Error('Request was not successful'));
        };

        connection.fetchDbConnectInfo({}, function (err) {
          err.message.should.equal('Request was not successful');
          done();
        });
      });

      it('should fetch DB_CONNECT_INFO (connected)', function (done) {
        var connection = prepareConnection(DATA.CONNECTED);
        connection.fetchDbConnectInfo({}, function (err, info) {
          info.isConnected.should.equal(true);
          (!!info.host).should.be.not.ok;
          (!!info.port).should.be.not.ok;
          done();
        });
      });
    });

    it('should connect to the database', function (done) {
      var connection = createConnection();
      var settings = connection._settings;
      var credentials = {};
      connection._createAuthenticationManager = function createManager(options) {
        options.should.equal(credentials);
        var manager = mock.createManager(options);
        manager.sessionCookie = 'cookie';
        return manager;
      };
      connection.send = sendAuthenticationRequest;
      connection.connect(credentials, function (err, reply) {
        (!!err).should.be.not.ok;
        reply.authentication.should.equal('FINAL');
        settings.sessionCookie.should.equal('cookie');
        done();
      });
    });

    it('should fail to create the authentication manager', function (done) {
      var connection = createConnection();
      var authError = new Error('AUTHENTICATION_ERROR');
      connection._createAuthenticationManager = function createManager() {
        throw authError;
      };

      connection.connect({}, function (err) {
        err.should.equal(authError);
        done();
      });
    });

    it('should receive an authentication error', function (done) {
      var connection = createConnection();
      var error = new Error('AUTHENTICATION_ERROR');
      connection._createAuthenticationManager = mock.createManager;
      connection.send = sendAuthenticationRequest;
      connection.connect(
        {
          initialDataError: error,
        },
        function (err) {
          err.should.equal(error);
          done();
        },
      );
    });

    it('should receive a connect error', function (done) {
      var connection = createConnection();
      var error = new Error('CONNECT_ERROR');
      connection._createAuthenticationManager = mock.createManager;
      connection.send = sendAuthenticationRequest;
      connection.connect(
        {
          finalDataError: error,
        },
        function (err) {
          err.should.equal(error);
          done();
        },
      );
    });

    it('should fail to initialize authentication manager', function (done) {
      var connection = createConnection();
      var error = new Error('INITIALIZE_ERROR');
      connection._createAuthenticationManager = mock.createManager;
      connection.send = sendAuthenticationRequest;
      connection.connect(
        {
          initializeError: error,
        },
        function (err) {
          err.should.equal(error);
          done();
        },
      );
    });

    it('should fail to disconnect from the database', function (done) {
      var connection = createConnection();
      var error = new Error('DISCONNECT_ERROR');
      connection.enqueue = function enqueue(msg, cb) {
        msg.type.should.equal(MessageType.DISCONNECT);
        setImmediate(function () {
          cb(error);
        });
      };
      var queue = connection._queue;
      queue.pause();
      var queueable = queue.createTask(
        function (cb) {
          cb();
        },
        function () {},
      );
      queueable.name = 'dummy';
      queue.push(queueable);
      connection.disconnect(function (err) {
        err.should.equal(error);
        done();
      });
      queue.resume();
    });

    it('should receive a warning', function () {
      var connection = createConnection();
      var replySegment = {
        kind: SegmentKind.ERROR,
        error: new Error('WARNING'),
      };
      replySegment.error.level = ErrorLevel.WARNING;
      connection._parseReplySegment = function parseReplySegment() {
        return replySegment;
      };
      connection.receive(new Buffer(0), function (err, reply) {
        (!!err).should.be.not.ok;
        reply.should.equal(replySegment);
      });
      connection.once('warning', function onwarning(warning) {
        warning.should.equal(replySegment.error);
        done();
      });
    });

    context('cesu-8 support', function () {
      it('should create a connection with a useCesu8 set correctly', function () {
        var connection = new Connection({ useCesu8: true });
        connection.useCesu8.should.eql(true);
        connection = new Connection({ useCesu8: false });
        connection.useCesu8.should.eql(false);
      });

      function cesuTestConnection(options, done) {
        var connection = createConnection(options);
        connection.enqueue = function (statement) {
          statement.useCesu8.should.eql(true);
          done();
        };
        return connection;
      }

      it('should prepare statement with cesu-8 support', function (done) {
        cesuTestConnection({ useCesu8: true }, done).prepare();
      });

      it('should fetchNext with cesu-8 support', function (done) {
        cesuTestConnection({ useCesu8: true }, done).fetchNext({});
      });

      it('should dropStatement with cesu-8 support', function (done) {
        cesuTestConnection({ useCesu8: true }, done).dropStatement({});
      });

      it('should authenticate with cesu-8 support', function (done) {
        var connection = createConnection({ useCesu8: true });
        connection.send = function (statement) {
          statement.useCesu8.should.eql(true);
          done();
        };
        connection.connect({ user: 'user', password: 'pass' }, function (err) {
          if (err) {
            throw err;
          }
        });
      });
    });

    function testConnectionOptions(options, cb) {
      let connection = createConnection();
      // Add authentication method so that the mock connection will go through
      connection._createAuthenticationManager = function createManager(options) {
        let manager = mock.createManager(options);
        manager.sessionCookie = 'cookie';
        return manager;
      };
      connection.send = sendAuthenticationRequest;
      connection.connect(options, function (err) {
        cb(err, connection);
      });
    }

    context('data format support', function () {
      it('should set valid data format support version', function (done) {
        testConnectionOptions({ dataFormatSupport: 4 }, function (err, connection) {
          if (err) {
            throw err;
          }
          connection.connectOptions.should.have.property('dataFormatVersion', 4);
          connection.connectOptions.should.have.property('dataFormatVersion2', 4);
          done();
        });
      });

      it('should not overwrite with invalid data format version', function (done) {
        testConnectionOptions({ dataFormatSupport: -2 }, function (err, connection) {
          err.should.be.an.instanceOf(Error);
          err.message.should.equal(
            util.format(
              'Data format -2 is invalid. Supported values are 1 to %d',
              DataFormatVersion.MAX_VERSION,
            ),
          );
          done();
        });
      });

      it('should not overwrite with data format version past max support', function (done) {
        testConnectionOptions({ dataFormatSupport: 99 }, function (err, connection) {
          err.should.be.an.instanceOf(Error);
          err.message.should.equal(
            util.format(
              'Maximum driver supported data format %d is less than client requested 99',
              DataFormatVersion.MAX_VERSION,
            ),
          );
          done();
        });
      });
    });

    let lz4Available = true;
    try {
      require('lz4-wasm-nodejs');
    } catch (err) {
      lz4Available = false;
    }

    if (lz4Available) {
      context('compression support', function () {
        it('should set compressionEnabled to true when compress=true', function (done) {
          testConnectionOptions({ compress: true }, function (err, connection) {
            connection.connectOptions.should.have.property('compressionLevelAndFlags', 768);
            connection._compressionEnabled.should.be.true();
            done();
          });
        });

        it('should set compressionEnabled to false when compress=false', function (done) {
          testConnectionOptions({ compress: false }, function (err, connection) {
            connection.connectOptions.should.not.have.property('compressionLevelAndFlags');
            connection._compressionEnabled.should.be.false();
            done();
          });
        });

        context('Connection#send compression behaviour', function () {
          let originalCompress;
          const compresssedBuffer = Buffer.from('compressed');

          beforeEach(() => {
            originalCompress = Compressor.compress;
          });

          afterEach(() => {
            Compressor.compress = originalCompress;
          });

          function createMessage(type, packetSize) {
            const packet = Buffer.alloc(packetSize);
            return {
              type,
              toBuffer: (size) => {
                size.should.be.a.Number();
                return packet;
              },
            };
          }

          function createConnectionSpy(shouldCompress, compressionEnabled, done) {
            const connection = new Connection();
            connection._compressionEnabled = compressionEnabled;

            let compressCalled = false;

            Compressor.compress = function (input) {
              compressCalled = true;
              input.length.should.be.above(10 * 1024);
              return compresssedBuffer; // The compressed buffer
            };

            connection._socket = {
              write: function (buf) {
                if (shouldCompress) {
                  compressCalled.should.be.true();
                  buf.equals(compresssedBuffer).should.be.true();
                } else {
                  compressCalled.should.be.false();
                }
                done();
              },
            };
            return connection;
          }

          it('should compress if compression is enabled and packet is large and type is EXECUTE', function (done) {
            const message = createMessage(MessageType.EXECUTE, 11 * 1024);
            const connection = createConnectionSpy(true, true, done);
            connection.send(message, null);
          });

          it('should not compress if message type is AUTHENTICATE', function (done) {
            const message = createMessage(MessageType.AUTHENTICATE, 11 * 1024);
            const connection = createConnectionSpy(false, true, done);
            connection.send(message, null);
          });

          it('should not compress if message type is CONNECT', function (done) {
            const message = createMessage(MessageType.CONNECT, 11 * 1024);
            const connection = createConnectionSpy(false, true, done);
            connection.send(message, null);
          });

          it('should not compress if compression is disabled', function (done) {
            const message = createMessage(MessageType.EXECUTE, 11 * 1024);
            const connection = createConnectionSpy(false, false, done);
            connection.send(message, null);
          });

          it('should not compress if packet is too small', function (done) {
            const message = createMessage(MessageType.EXECUTE, 1024); // 1 KB
            const connection = createConnectionSpy(false, true, done);
            connection.send(message, null);
          });
        });
        context('Connection#receive compression behaviour', function () {
          const fakeCompressedBuffer = Buffer.from('compressed');
          const fakeDecompressedBuffer = Buffer.from('decompressed');
        
          function createPacket({
            packetLength,
            compressionFlag,
            compressionVarpartLength,
            segmentHeader = Buffer.alloc(24),
            compressedBuffer = fakeCompressedBuffer,
          }) {
            const messageHeader = Buffer.alloc(32);
            messageHeader.writeUInt32LE(packetLength, 12); // VARPARTLENGTH
            messageHeader.writeUInt8(compressionFlag, 22); // PACKET OPTIONS
            messageHeader.writeUInt32LE(compressionVarpartLength, 24); // COMPRESSIONVARPARTLENGTH
          
            const currentBody = Buffer.concat([segmentHeader, compressedBuffer]);
            const paddedBody = currentBody.length < packetLength
              ? Buffer.concat([currentBody, Buffer.alloc(packetLength - currentBody.length)])
              : currentBody.slice(0, packetLength);
          
            return Buffer.concat([messageHeader, paddedBody]);
          }
          
          function testReceiveBehaviour({
            packetLength = fakeCompressedBuffer.length + 24,
            compressionFlag = 2,
            compressionVarpartLength = fakeDecompressedBuffer.length + 24,
            expectDecompress,
            shouldThrow = false,
            done,
          }) {
            const segmentHeader = Buffer.alloc(24);
            const packet = createPacket({ packetLength, compressionFlag, compressionVarpartLength, segmentHeader });
            let decompressCalled = false;
          
            Compressor.decompress = (input, length) => {
              decompressCalled = true;
              input.should.eql(Buffer.concat([segmentHeader, fakeCompressedBuffer]));
              length.should.equal(fakeDecompressedBuffer.length + 24);
              return Buffer.concat([segmentHeader, fakeDecompressedBuffer]);
            };
          
            const connection = new Connection();
            const fakeSocket = mock.createSocket(1);
            connection._addListeners(fakeSocket);
          
            if (shouldThrow) {
              try {
                assert.throws(() => {
                  fakeSocket.emit('data', packet);
                }, /Packet decompression failed/);
                done();
              } catch (err) {
                done(err);
              }
            } else {
              connection.receive = (buf, cb) => {
                try {
                  if (expectDecompress) {
                    decompressCalled.should.be.true();
                    buf.should.eql(Buffer.concat([segmentHeader, fakeDecompressedBuffer]));
                  } else {
                    decompressCalled.should.be.false();
                    buf.should.eql(Buffer.concat([segmentHeader, fakeCompressedBuffer]));
                  }
                  if (cb) cb(null);
                  done();
                } catch (err) {
                  done(err);
                }
              };
              fakeSocket.emit('data', packet);
            }
          }          
        
          it('should decompress if compression flag is 2', function (done) {
            testReceiveBehaviour({
              expectDecompress: true,
              done,
            });
          });
        
          it('should not decompress if compression flag is 0', function (done) {
            testReceiveBehaviour({
              compressionFlag: 0,
              expectDecompress: false,
              done,
            });
          });
        
          it('should throw error if packet.header.length <= 0', function (done) {
            testReceiveBehaviour({
              packetLength: 0,
              expectDecompress: false,
              shouldThrow: true,
              done,
            });
          });
        
          it('should throw error if packet.header.length >= compressionVarpartLength', function (done) {
            const compLen = fakeDecompressedBuffer.length + 24;
            testReceiveBehaviour({
              packetLength: compLen,
              compressionVarpartLength: compLen,
              expectDecompress: false,
              shouldThrow: true,
              done,
            });
          });
        
          it('should throw error if packet.header.length > packetSizeLimit', function (done) {
            const connection = new Connection();
            const packetSizeLimit = connection.packetSizeLimit;
            testReceiveBehaviour({
              packetLength: packetSizeLimit + 1,
              expectDecompress: false,
              shouldThrow: true,
              done,
            });
          });
        });  
      });
    }
  });
});
