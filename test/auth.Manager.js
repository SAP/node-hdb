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
var fs = require('fs');
var path = require('path');
var lib = require('../lib');
var auth = lib.auth;
var PartKind = lib.common.PartKind;
var Fields = lib.data[PartKind.AUTHENTICATION];

var user = 'SYSTEM';
var emptyBuffer = new Buffer(0);

describe('Auth', function () {

  describe('#SCRAMSHA256', function () {

    var method0 = 'LDAP'
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

    var ldapClientChallenge = new Buffer(
      '0200' +
      // client nonce = clientChallenge
      '40' +
      'edbd7cc8b2f26489d65a7cd51e27f2e73fca227d1ab6aafcac0f428ca4d8e10c' +
      '19e3e38f3aac51075e67bbe52fdb6103a7c34c8a70908ed5be0b3542705f738c' +
      // supported capabilities
      '08' +
      '0100000000000000',
      'hex');
    var ldapServerChallenge = new Buffer(
      '0400' +
      // client nonce = clientChallenge
      '40' +
      'edbd7cc8b2f26489d65a7cd51e27f2e73fca227d1ab6aafcac0f428ca4d8e10c' +
      '19e3e38f3aac51075e67bbe52fdb6103a7c34c8a70908ed5be0b3542705f738c' +
      // server nonce
      '40' +
      'a16fc718d5fd20aa3febeeeebe34270565ad3818894c6e3b3b674ee71b440c07' +
      'd6b9329d1860d4e693d9312aaece14bf3eb86d604670c571f2d7445a97949310' +
      // public key pem
      'ff01c4' +
      '2d2d2d2d2d424547494e205055424c4943204b45592d2d2d2d2d0a' +
      '4d494942496a414e42676b71686b6947397730424151454641414f43415138414d49494243674b43415145416f4e736d494777763554583558473051697076620a' +
      '435342576645773678546d3230596c555559516262316d5863764831575153475877424c5078313449556b584e67545350435177314a4f7361513075364843680a' +
      '6e35773063786f4e78367a386e694b3838676c774a476167714c32356536506d47354d586264784d74496c5863736336465a55364a4370384538496d313362650a' +
      '7776584c4b6c6d7536304238762b462b5877582b5a6b6f693735662f6758626e2f366a723679737a554c4b512f586151524a69535766567468575a71533967540a' +
      '53645676686e736d4e306261744c7a70705376706c79356447423735596961754b4f66672b753531684e2b4b4d4a5a532f392f415172716d71637678675835740a' +
      '79624a6b6138796e437164694e4b6d32764d6174766d6f656a4f446d7a61474b5553514754627042357a35654a544636625172796877666850645263692b7a760a' +
      '7a514944415141420a' +
      '2d2d2d2d2d454e44205055424c4943204b45592d2d2d2d2d0a00' +
      // capability to use
      '01' +
      '01',
      'hex');
/*
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoNsmIGwv5TX5XG0Qipvb
CSBWfEw6xTm20YlUUYQbb1mXcvH1WQSGXwBLPx14IUkXNgTSPCQw1JOsaQ0u6HCh
n5w0cxoNx6z8niK88glwJGagqL25e6PmG5MXbdxMtIlXcsc6FZU6JCp8E8Im13be
wvXLKlmu60B8v+F+XwX+Zkoi75f/gXbn/6jr6yszULKQ/XaQRJiSWfVthWZqS9gT
SdVvhnsmN0batLzppSvply5dGB75YiauKOfg+u51hN+KMJZS/9/AQrqmqcvxgX5t
ybJka8ynCqdiNKm2vMatvmoejODmzaGKUSQGTbpB5z5eJTF6bQryhwfhPdRci+zv
zQIDAQAB
-----END PUBLIC KEY-----
*/
    var ldapSessionKey = new Buffer(
      '568bdf7b9d8930ea937279326c92f72fc0769205e91d864b7a44868984e2cbb2',
      'hex');
    // can't check client proof as RSA encypt has a random factor
    // so only check the encrypted password
    var ldapEncryptedPassword = new Buffer('7d78f690a5cff122e72f62f6c07dfea1259098a2ccfa938f42031f2644dba8954aa10d1c0665d7b8ac763353acfd0792cea2a6dea423c85c62efb8448f398bc9425aee548b1cdb22cbb4d6d3a95eaf70', 'hex');

    it('should get the corresponding authentication method instances', function () {
      var manager = auth.createManager({
        user: user,
        password: new Buffer(password, 'utf8'),
        clientChallenge: clientChallenge
      });
      var authMethod0 = manager.getMethod(method0);
      Buffer.isBuffer(authMethod0.password).should.be.true;
      authMethod0.password.toString('utf8').should.equal(password);

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
      manager._authMethods.should.have.length(3);
      var authMethod = manager._authMethods[2];
      authMethod.name.should.equal(method2);
      authMethod.password.should.be.instanceof(Buffer);
      authMethod.password.toString('utf8').should.eql(password);
      authMethod.clientChallenge.should.equal(clientChallenge);
      // initial data
      var initialData = authMethod.initialData();
      initialData.should.equal(clientChallenge);
      initialData = manager.initialData();
      initialData.should.eql([user, method0, ldapClientChallenge, method1, clientChallenge, method2, clientChallenge]);
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
      manager._authMethods.should.have.length(3);
      var authMethod = manager._authMethods[1];
      authMethod.name.should.equal(method1);
      authMethod.password.should.be.instanceof(Buffer);
      authMethod.password.toString('utf8').should.eql(password);
      authMethod.clientChallenge.should.equal(clientChallenge);
      // initial data
      var initialData = authMethod.initialData();
      initialData.should.equal(clientChallenge);
      initialData = manager.initialData();
      initialData.should.eql([user, method0, ldapClientChallenge, method1, clientChallenge, method2, clientChallenge]);
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

    it('should authenticate and connect successfully with LDAP', function (done) {
      var manager = auth.createManager({
        user: user,
        password: password,
        clientChallenge: clientChallenge,
        sessionKey: ldapSessionKey
      });
      manager.user.should.equal(user);
      manager._authMethods.should.have.length(3);
      var authMethod = manager._authMethods[0];
      authMethod.name.should.equal(method0);
      authMethod.password.should.be.instanceof(Buffer);
      authMethod.password.toString('utf8').should.eql(password);
      authMethod.clientNonce.should.equal(clientChallenge);
      authMethod.sessionKey.should.equal(ldapSessionKey);
      // initial data
      var initialData = authMethod.initialData();
      initialData.should.eql(ldapClientChallenge);
      initialData = manager.initialData();
      initialData.should.eql([user, method0, ldapClientChallenge, method1, clientChallenge, method2, clientChallenge]);
      // initialize manager
      manager.initialize([method0, ldapServerChallenge], function(err) {
        manager._authMethod.should.equal(authMethod);
        // clientProof
        var ldapClientProof = authMethod.clientProof;
        var clientProofFields = Fields.read({ buffer: ldapClientProof });
        clientProofFields.length.should.eql(2);
        clientProofFields[1].should.eql(ldapEncryptedPassword);
        // final data
        var finalData = authMethod.finalData();
        finalData.should.eql(ldapClientProof);
        finalData = manager.finalData();
        finalData.should.eql([user, method0, ldapClientProof]);
        // finalize manager
        manager.finalize([method0, null]);
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
      buffer.readUInt16LE(offset).should.equal(7);
      offset += 2;
      // validate user
      length = buffer[offset];
      offset += 1;
      field = buffer.toString('utf8', offset, offset + length);
      offset += length;
      length.should.equal(Buffer.byteLength(user));
      field.should.equal(user);
      // validate method0 name
      length = buffer[offset];
      offset += 1;
      field = buffer.toString('utf8', offset, offset + length);
      offset += length;
      length.should.equal(Buffer.byteLength(method0));
      field.should.equal(method0);
      // validate clientChallenge #0
      length = buffer[offset];
      offset += 1;
      field = buffer.slice(offset, offset + length);
      offset += length;
      length.should.equal(ldapClientChallenge.length);
      field.should.eql(ldapClientChallenge);
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
    var assertion = new Buffer('<saml:Assertion></saml:Assertion>', 'ascii');
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

  describe('#JWT', function () {

    var method = 'JWT';
    var token = new Buffer('eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.eu3buOdtT84lHs90LfmC3MJ_17Qg0FfgBke2qnW5yE-wDlEdKWWEURFoneCzMmdGtJcnVqINmZD1X8XbvoAWeWq_tH75fSKcg_1RaooYaARdtpQGF_BtjXJ9jMJHoJ9kgjO8cv06GobNaoydu2v6C8fsSIBDVw9zEApGZIwNCJztkgmEGmkQKXHHxKRISi55DgCowVYk1Obgp55KMjRqmMkAvw8qoMsAU109n26NGQNI19wOaGiPrSGKpENkgq6lWFY6visswoA8X3pYn6EXdAqEGjuFH0ADuvqUoRyrrIaaem30JgVny8LQ-t2ms7gck8jPdxS7TUjiB2hHKjRwBw', 'ascii');
    var sessionCookie = new Buffer('420facfc', 'hex');

    it('should get the corresponding authentication method instance', function () {
      var manager = auth.createManager({
        user: null,
        password: token
      });
      var authMethod = manager.getMethod(method);
      authMethod.token.should.equal(token);
    });

    it('should authenticate and connect successfully', function () {
      var manager = auth.createManager({
        token: token
      });
      manager.user.should.equal('');
      manager._authMethods.should.have.length(1);
      var authMethod = manager._authMethods[0];
      authMethod.name.should.equal(method);
      authMethod.token.should.equal(token);
      // initial data
      var initialData = authMethod.initialData();
      initialData.should.equal(token);
      initialData = manager.initialData();
      initialData.should.eql(['', method, token]);
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

  describe('#X.509', function () {
    var method = 'X509';
    var dirname = path.join(__dirname, 'fixtures', 'auth', 'x509');
    var clientPem = fs.readFileSync(path.join(dirname, 'test_x509_user.pem'), 'utf8');
    var clientKey = fs.readFileSync(path.join(dirname, 'c1a_test.key'), 'utf8');

    var serverNonce = Buffer.from('8e9204f25b077dc1b4ab5ef650faea10f345157873e68e2a28989c00342e9634' +
                                  '54ae0a90f2339368efcf8c7806c28edba206c329c306d7aba98b23d3f1be3755', 'hex');
    // To decrease the size of the precomputed buffer text in this test file, the certificate DERs are computed
    // in real time (PEM -> DER is simply base64 to binary conversion)
    var clientCert = fs.readFileSync(path.join(dirname, 'c1a_test.crt'), 'utf8');
    var interCert = fs.readFileSync(path.join(dirname, 'c1a_inter.crt'), 'utf8');
    var rootCert = fs.readFileSync(path.join(dirname, 'c1_rootCA.crt'), 'utf8');
    var certificateList = [clientCert, interCert, rootCert];
    var derList = certificateList.map(function (certStr) {
      certStr = certStr.replace('-----BEGIN CERTIFICATE-----', '');
      certStr = certStr.replace('-----END CERTIFICATE-----', '');
      return Buffer.from(certStr, 'base64');
    });
    var clientProof = Buffer.from(
      '0300' + // number of fields
      'f69903' + // length indicator for client cert (921 bytes)
      derList[0].toString('hex') + // client cert
      'f6600d' + // length indicator for cert chain subparameters (3424 bytes)
      '0300' + // number of fields
      'f69903' + // length indicator for client cert (921 bytes)
      derList[0].toString('hex') + // client cert
      'f67d04' + // length indicator for inter cert (1149 bytes)
      derList[1].toString('hex') + // inter cert
      'f63f05' + // length indicator for root cert (1343 bytes)
      derList[2].toString('hex') + // root cert
      'f60001' + // length indicator for signature (256 bytes)
      '19772d14464da2b229e94f9daa8197a422d1fe87efa7cedfb51960cd9f06da28f5c74ada75a75e3594d7d1b18f0fafc9d8018' +
      '6b9f6269e5c8173b9a4f8f36fef9b104780c880dee509eff21a23566e5fa902868aba2cbaefa711c8a32a0d2ba012aca26db1' +
      '3c4566821a520643c10e495737e66adc21fba58df4d12d70d9bbe3b9ba5767cbe430a0bf5bafbaa947a1b579e185645bd8a28' +
      'acb60e5e897d8c798235d5b2902ccc6dfcca9ad207dda3aaee1a2735c5fee7089f7b5d5cc0dc3a496f7210edd8386b99c0b8b' +
      'd5b4e15ac6950b0280f5980767ee0958b9fe039c84d781108a230d63c00e955ac66c85c87c9f0763a832e67d2646b88e65bb0' +
      '04eacff', // signature
    'hex');
    var sessionCookie = new Buffer('fcac0f42', 'hex');

    it('should get the corresponding authentication method instance', function () {
      var manager = auth.createManager({
        user: null,
        password: Buffer.from(clientPem)
      });
      var authMethod = manager.getMethod(method);
      // Unlike the other authentication methods, X.509 certificate data is stored as strings
      // so that it can be parsed to extract the certificate chain
      (typeof authMethod.authenticationX509 === 'string').should.be.true;
      authMethod.authenticationX509.should.equal(clientPem);
    });

    it('should authenticate and connect successfully', function (done) {
      var manager = auth.createManager({
        authenticationX509: clientPem
      });
      manager.user.should.equal('');
      manager._authMethods.should.have.length(1);
      var authMethod = manager._authMethods[0];
      authMethod.name.should.equal(method);
      authMethod.authenticationX509.should.equal(clientPem);
      // initial data
      var initialData = authMethod.initialData();
      initialData.should.eql(emptyBuffer);
      initialData = manager.initialData();
      initialData.should.eql(['', method, emptyBuffer]);
      // initialize manager
      manager.initialize([method, serverNonce], function(err) {
        if (err) done(err);
        manager._authMethod.should.equal(authMethod);
        // final data
        var finalData = authMethod.finalData();
        finalData.should.eql(clientProof);
        finalData = manager.finalData();
        finalData.should.eql(['', method, clientProof]);
        // finalize manager
        manager.finalize([method, sessionCookie]);
        manager.sessionCookie.should.equal(sessionCookie);
        done();
      });
    });

    it('should allow some authentication methods to fail if another succeeds', function () {
      var clientChallenge = Buffer.from('e488a0e8bb46052bacf97c37b64da426bdaba4f0549f9d376791203d6f017a6a'
        + 'fb187f2484ad4082ff2cac5fd81d1d01c4668410a2381d1bd9942ec6def53836', 'hex');
      var ldapClientChallenge = new Buffer(
        '0200' +
        // client nonce = clientChallenge
        '40' +
        'e488a0e8bb46052bacf97c37b64da426bdaba4f0549f9d376791203d6f017a6a' +
        'fb187f2484ad4082ff2cac5fd81d1d01c4668410a2381d1bd9942ec6def53836' +
        // supported capabilities
        '08' +
        '0100000000000000',
        'hex');
      var manager = auth.createManager({
        authenticationX509: clientCert, // no private key, will cause an error
        user: 'user',
        password: 'password',
        clientChallenge: clientChallenge
      });
      manager.user.should.equal('user');
      manager._authMethods.should.have.length(3);
      // initial data
      var initialData = manager.initialData();
      initialData.should.eql(['user', 'LDAP', ldapClientChallenge, 'SCRAMPBKDF2SHA256', clientChallenge,
        'SCRAMSHA256', clientChallenge]);
    });

    it('should raise an error with invalid X.509 certificates', function (done) {
      var invalidClientPem = clientPem;
      // Replace first BEGIN CERTIFICATE header
      invalidClientPem = invalidClientPem.replace('-----BEGIN CERTIFICATE-----', '----- BEGIN CERTIFICATE -----');
      var manager = auth.createManager({
        authenticationX509: invalidClientPem
      });
      manager.initialize([method, serverNonce], function (err) {
        err.should.be.instanceof(Error);
        err.message.should.equal('Invalid X.509 certificate in certificate chain');
        done();
      });
    });

    it('should raise an error if the authenticationX509 property is invalid', function () {
      var errMessage = 'No authentication method found. X.509: Invalid value for connect property ' +
        'authenticationX509: Please ensure you have supplied a valid X.509 certificate or file name';
      auth.createManager.bind(null, {authenticationX509: 'fileNotFound.pem'}).should.throw(errMessage);
    });

    it('should raise an error when only provided public key', function () {
      var errMessage = "No authentication method found. X.509: Could not load private key";
      auth.createManager.bind(null, {authenticationX509: rootCert}).should.throw(errMessage);
    });

    it('should raise an error when only provided private key', function () {
      var errMessage = "No authentication method found. X.509: No X.509 certificate found";
      auth.createManager.bind(null, {authenticationX509: clientKey}).should.throw(errMessage);
    });

    it('should raise an error with incorrect private key password', function () {
      var encryptedClientKey = fs.readFileSync(path.join(dirname, 'c1a_test_encrypted.key'), 'utf8');
      var encryptedClientPem = encryptedClientKey + clientCert + interCert + rootCert;
      var connectOptions = {
        authenticationX509: encryptedClientPem,
        authenticationX509Password: 'wrong'
      };
      var errData = {
        message: "No authentication method found. X.509: Could not load private key "
        + "(likely wrong password to decrypt private key)",
        'X.509': {
          code: 'ERR_OSSL_BAD_DECRYPT'
        }
      };
      auth.createManager.bind(null, connectOptions).should.throw(errData);
    });

    it('should raise an error with an expired certificate', function () {
      var expiredClientCert = fs.readFileSync(path.join(dirname, 'c1a_test_expired.crt'), 'utf8');
      var expiredClientPem = clientKey + expiredClientCert + interCert + rootCert;
      var errMessage = "No authentication method found. X.509: X.509 certificate has expired";
      auth.createManager.bind(null, {authenticationX509: expiredClientPem}).should.throw(errMessage);
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
