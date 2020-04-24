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
var os = require('os');
var lib = require('../lib');
var auth = lib.auth;
var PartKind = lib.common.PartKind;
var Fields = lib.data[PartKind.AUTHENTICATION];

var user = 'SYSTEM';
var emptyBuffer = new Buffer(0);

describe('Auth', function () {

  describe('#SCRAMSHA256', function () {

    var method1 = 'SCRAMPBKDF2SHA256';
    var method2 = 'SCRAMSHA256';
    var password = 'secret';
    var clientChallenge = new Buffer(
      'edbd7cc8b2f26489d65a7cd51e27f2e73fca227d1ab6aafcac0f428ca4d8e10c' +
      '19e3e38f3aac51075e67bbe52fdb6103a7c34c8a70908ed5be0b3542705f738c',
      'hex');
    var clientProofNoPBKDF2 = new Buffer(
      '000120e47d8f244855b92dc966395d0d282547b54dfd09614d44374df94f293c1a020e',
      'hex');
    var clientProofWithPBKDF2 = new Buffer(
      '000120c19eab8d5eaf34b45f5d25d09615003679a3b1a53192fd12ff58779567ad37f1',
      'hex');
    var salt = new Buffer('80964fa85428ae3a81acd3e686a27933', 'hex');
    var serverChallenge = new Buffer(
      '41065150117e455fec2f03f6f47c19d405ade50dd65731dc0fb3f7954db62c8a' +
      'a67a7e825e1300bee975e74518238c9a', 'hex');
    var serverChallengeDataNoPBKDF2 =
      Fields.write({}, [salt, serverChallenge]).buffer;
    var iterations = new Buffer(4);
    iterations.writeUInt32BE(15000, 0);
    var serverChallengeDataWithPBKDF2 =
      Fields.write({}, [salt, serverChallenge, iterations]).buffer;
    var serverProof = new Buffer(
      '01002093cae8d0d3fd8ea7e67da4a09678d504429e67a1cb6197ed3a6a70afbd757a96',
      'hex');
    var wrongServerProof = new Buffer(
      '01002093cae8d0d3fd9ea7e67da4a09678d504429e67a1cb6197ed3a6a70afbd757a96',
      'hex');

    it('should get the corresponding authentication method instances', function () {
      var manager = auth.createManager({
        user: user,
        password: new Buffer(password, 'utf8'),
        clientChallenge: clientChallenge
      });
      var authMethod1 = manager.getMethod(method1);
      Buffer.isBuffer(authMethod1.password).should.be.true;
      authMethod1.password.toString('utf8').should.equal(password);

      var authMethod2 = manager.getMethod(method2);
      Buffer.isBuffer(authMethod2.password).should.be.true;
      authMethod2.password.toString('utf8').should.equal(password);
    });

    it('should authenticate and connect successfully without PBKDF2', function (done) {
      var manager = auth.createManager({
        user: user,
        password: password,
        clientChallenge: clientChallenge
      });
      manager.user.should.equal(user);
      manager._authMethods.should.have.length(2);
      var authMethod = manager._authMethods[1];
      authMethod.name.should.equal(method2);
      authMethod.password.should.be.instanceof(Buffer);
      authMethod.password.toString('utf8').should.eql(password);
      authMethod.clientChallenge.should.equal(clientChallenge);
      // initial data
      var initialData = authMethod.initialData();
      initialData.should.equal(clientChallenge);
      initialData = manager.initialData();
      initialData.should.eql([user, method1, clientChallenge, method2, clientChallenge]);
      // initialize manager
      manager.initialize([method2, serverChallengeDataNoPBKDF2], function(err) {
        manager._authMethod.should.equal(authMethod);
        // clientProof
        authMethod.clientProof.should.eql(clientProofNoPBKDF2);
        // final data
        var finalData = authMethod.finalData();
        finalData.should.eql(clientProofNoPBKDF2);
        finalData = manager.finalData();
        finalData.should.eql([user, method2, clientProofNoPBKDF2]);
        // finalize manager
        manager.finalize([method2, null]);
        done();
      });
    });

    it('should authenticate and connect successfully with PBKDF2', function (done) {
      var manager = auth.createManager({
        user: user,
        password: password,
        clientChallenge: clientChallenge
      });
      manager.user.should.equal(user);
      manager._authMethods.should.have.length(2);
      var authMethod = manager._authMethods[0];
      authMethod.name.should.equal(method1);
      authMethod.password.should.be.instanceof(Buffer);
      authMethod.password.toString('utf8').should.eql(password);
      authMethod.clientChallenge.should.equal(clientChallenge);
      // initial data
      var initialData = authMethod.initialData();
      initialData.should.equal(clientChallenge);
      initialData = manager.initialData();
      initialData.should.eql([user, method1, clientChallenge, method2, clientChallenge]);
      // initialize manager
      manager.initialize([method1, serverChallengeDataWithPBKDF2], function(err) {
        manager._authMethod.should.equal(authMethod);
        // clientProof
        authMethod.clientProof.should.eql(clientProofWithPBKDF2);
        // final data
        var finalData = authMethod.finalData();
        finalData.should.eql(clientProofWithPBKDF2);
        finalData = manager.finalData();
        finalData.should.eql([user, method1, clientProofWithPBKDF2]);
        // finalize manager
        manager.finalize([method1, serverProof]);
        var errorMessage = '';
        try {
            manager.finalize([method1, wrongServerProof]);
        } catch(err) {
            errorMessage = err.message;
        }
        errorMessage.should.eql("Server couldn't be authenticated");
        done();
      });
    });

    it('should write initial data fields part', function () {
      var part = Fields.write({}, auth.createManager({
        user: user,
        password: password,
        clientChallenge: clientChallenge
      }).initialData());
      part.argumentCount.should.equal(1);
      var buffer = part.buffer;
      var offset = 0;
      var field, length;
      buffer.readUInt16LE(offset).should.equal(5);
      offset += 2;
      // validate user
      length = buffer[offset];
      offset += 1;
      field = buffer.toString('utf8', offset, offset + length);
      offset += length;
      length.should.equal(Buffer.byteLength(user));
      field.should.equal(user);
      // validate method1 name
      length = buffer[offset];
      offset += 1;
      field = buffer.toString('utf8', offset, offset + length);
      offset += length;
      length.should.equal(Buffer.byteLength(method1));
      field.should.equal(method1);
      // validate clientChallenge #1
      length = buffer[offset];
      offset += 1;
      field = buffer.slice(offset, offset + length);
      offset += length;
      length.should.equal(clientChallenge.length);
      field.should.eql(clientChallenge);
      // validate method2 name
      length = buffer[offset];
      offset += 1;
      field = buffer.toString('utf8', offset, offset + length);
      offset += length;
      length.should.equal(Buffer.byteLength(method2));
      field.should.equal(method2);
      // validate clientChallenge #2
      length = buffer[offset];
      offset += 1;
      field = buffer.slice(offset, offset + length);
      offset += length;
      length.should.equal(clientChallenge.length);
      field.should.eql(clientChallenge);
    });

  });

  describe('#SAML', function () {

    var method = 'SAML';
    var assertion = new Buffer('3fca227d', 'hex');
    var sessionCookie = new Buffer('fcac0f42', 'hex');

    it('should get the corresponding authentication method instance', function () {
      var manager = auth.createManager({
        user: null,
        password: assertion
      });
      var authMethod = manager.getMethod(method);
      authMethod.assertion.should.equal(assertion);
    });

    it('should authenticate and connect successfully', function () {
      var manager = auth.createManager({
        assertion: assertion
      });
      manager.user.should.equal('');
      manager._authMethods.should.have.length(1);
      var authMethod = manager._authMethods[0];
      authMethod.name.should.equal(method);
      authMethod.assertion.should.equal(assertion);
      // initial data
      var initialData = authMethod.initialData();
      initialData.should.equal(assertion);
      initialData = manager.initialData();
      initialData.should.eql(['', method, assertion]);
      // initialize manager
      manager.initialize([method, new Buffer(user, 'utf8')], function(err) {
        manager._authMethod.should.equal(authMethod);
        // user
        manager.userFromServer.should.equal(user);
        // final data
        var finalData = authMethod.finalData();
        finalData.should.eql(emptyBuffer);
        finalData = manager.finalData();
        finalData.should.eql([user, method, emptyBuffer]);
        // finalize manager
        manager.finalize([method, sessionCookie]);
        manager.sessionCookie.should.equal(sessionCookie);
      });
    });

  });

  describe('#SessionCookie', function () {

    var method = 'SessionCookie';
    var sessionCookie = new Buffer('fcac0f42', 'hex');

    it('should get the corresponding authentication method instance', function () {
      var pid = lib.util.pid;
      lib.util.pid = undefined;
      var manager = auth.createManager({
        user: user,
        sessionCookie: sessionCookie
      });
      lib.util.pid = pid;
      var authMethod = manager.getMethod(method);
      var length = sessionCookie.length;
      authMethod.sessionCookie.slice(0, length).should.eql(sessionCookie);
    });

    it('should authenticate and connect successfully', function () {
      var manager = auth.createManager({
        user: user,
        sessionCookie: sessionCookie
      });
      manager.user.should.equal(user);
      manager._authMethods.should.have.length(1);
      var authMethod = manager._authMethods[0];
      authMethod.name.should.equal(method);
      var length = sessionCookie.length;
      var cookie = authMethod.sessionCookie.slice(0, length);
      cookie.should.eql(sessionCookie);
      var termId = authMethod.sessionCookie.slice(length);
      termId = termId.toString('ascii').split('@');
      termId.should.have.length(2);
      if (termId[0] !== 'nodejs') {
        parseInt(termId[0]).should.equal(process.pid);
      }
      termId[1].should.equal(os.hostname());
      // initial data
      var initialData = authMethod.initialData();
      initialData.should.equal(authMethod.sessionCookie);
      // initialize manager
      manager.initialize([method, emptyBuffer], function(err) {
        manager._authMethod.should.equal(authMethod);
        // final data
        var finalData = authMethod.finalData();
        finalData.should.eql(emptyBuffer);
        // finalize manager
        manager.finalize([method, emptyBuffer]);
      });
    });

  });


  describe('#Mananger', function () {

    it('should not find an authentication method', function () {
      /* jshint immed:false */
      (function () {
        auth.createManager(null);
      }).should.throwError();
      (function () {
        auth.createManager({
          user: user
        });
      }).should.throwError();
      var manager = auth.createManager({
        user: user,
        password: 'secret',
        clientChallenge: new Buffer(4)
      });

      (function () {
        manager.initialize(['chuck', emptyBuffer]);
      }).should.throwError();
    });

  });

});
