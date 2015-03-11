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
var createSocket = tcp.createSocket;
var createSecureSocket = tcp.createSecureSocket;
var socket = {
  setNoDelay: function setNoDelay(noDelay) {
    noDelay.should.equal(true);
  }
};

describe('Lib', function () {

  describe('#tcp', function () {

    it('should create a secure connection', function (done) {
      tcp.createSecureSocket = function tlsConnect(options, cb) {
        tcp.createSecureSocket = createSecureSocket;
        options.allowHalfOpen.should.equal(false);
        process.nextTick(cb);
        return socket;
      };
      tcp.connect({
        pfx: true
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

  });
});