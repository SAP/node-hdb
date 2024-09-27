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

var tcp = require('../lib/protocol/tcp');
var tls = require('tls');
var createSocket = tcp.createSocket;
var createSecureSocket = tcp.createSecureSocket;
var socket = {
  setNoDelay: function setNoDelay(noDelay) {
    noDelay.should.equal(true);
  },
  setKeepAlive: function setKeepAlive(enable, time) {}
};

describe('Lib', function () {

  describe('#tcp', function () {

    it('should create a secure connection', function (done) {
      tcp.createSecureSocket = function tlsConnect(options, cb) {
        tcp.createSecureSocket = createSecureSocket;
        options.allowHalfOpen.should.equal(false);
        options.servername.should.equal(options.host);
        process.nextTick(cb);
        return socket;
      };
      tcp.connect({
        pfx: true,
        host: 'localhost'
      }, done).should.equal(socket);
    });

    it('should override default servername', function (done) {
      tcp.createSecureSocket = function tlsConnect(options, cb) {
        tcp.createSecureSocket = createSecureSocket;
        options.allowHalfOpen.should.equal(false);
        options.servername.should.equal('customSNI');
        process.nextTick(cb);
        return socket;
      };
      tcp.connect({
        pfx: true,
        host: 'localhost',
        servername: 'customSNI'
      }, done).should.equal(socket);
    });

    it('should create a connection', function (done) {
      tcp.createSocket = function netConnect(options, cb) {
        tcp.createSocket = createSocket;
        options.allowHalfOpen.should.equal(false);
        process.nextTick(cb);
        return socket;
      };
      tcp.connect({}, done).should.equal(socket);
    });

    it('should fallback to default trusted CAs', function (done) {
      var testCase = 0;
      tcp.createSecureSocket = function tlsConnect(options, cb) {
        switch (testCase) {
          case 0:
            (options.ca === undefined).should.equal(true);
            break;
          case 1:
            options.ca[0].should.equal("DummyCert");
            options.ca.length.should.equal(tls.rootCertificates.length + 1);
            for(var i = 0; i < tls.rootCertificates.length; ++i) {
                options.ca[i+1].should.equal(tls.rootCertificates[i]);
            }
            break;
          case 2:
            options.ca[0].should.equal("DummyCert");
            options.ca[1].should.equal("DummyCert2");
            options.ca.length.should.equal(tls.rootCertificates.length + 2);
            for(var i = 0; i < tls.rootCertificates.length; ++i) {
                options.ca[i+2].should.equal(tls.rootCertificates[i]);
            }
            break;
          case 3:
            options.ca.should.equal("DummyCert");
            break;
          default:
            break;
        }
        process.nextTick(cb);
        return socket;
      }
      tcp.connect({useTLS: true}, () => {
        ++testCase; // 1
        tcp.connect({ca: "DummyCert"}, () => {
          ++testCase; // 2
          tcp.connect({ca: ["DummyCert", "DummyCert2"], sslUseDefaultTrustStore: true}, () => {
            ++testCase; // 3
            tcp.connect({ca: "DummyCert", sslUseDefaultTrustStore: false}, () => {
              tcp.createSecureSocket = createSecureSocket;
              done();
            }).should.equal(socket);
          }).should.equal(socket);
        }).should.equal(socket);
      });
    });

  });
});
