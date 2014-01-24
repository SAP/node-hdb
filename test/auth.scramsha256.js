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

var lib = require('./lib');
var auth = lib.auth;
var PartKind = lib.common.PartKind;
var Fields = lib.data[PartKind.AUTHENTICATION];

describe('Authentication', function () {

  describe('#SCRAMSHA256', function () {

    it('should write an authentication request', function () {
      var user = 'SYSTEM';
      var password = 'secret';
      var clientChallenge = new Buffer(
        'edbd7cc8b2f26489d65a7cd51e27f2e73fca227d1ab6aafcac0f428ca4d8e10c' +
        '19e3e38f3aac51075e67bbe52fdb6103a7c34c8a70908ed5be0b3542705f738c',
        'hex');
      var clientProof = new Buffer(
        '000120e47d8f244855b92dc966395d0d282547b54dfd09614d44374df94f293c1a020e',
        'hex');
      var salt = new Buffer('80964fa85428ae3a81acd3e686a27933', 'hex');
      var serverChallenge = new Buffer(
        '41065150117e455fec2f03f6f47c19d405ade50dd65731dc0fb3f7954db62c8a' +
        'a67a7e825e1300bee975e74518238c9a', 'hex');
      var serverChallengeData = Fields.write({}, [salt, serverChallenge])
        .buffer;
      var algorithm = auth.createAlgorithm({
        user: user,
        password: password,
        clientChallenge: clientChallenge
      });
      algorithm.name.should.equal('SCRAMSHA256');
      algorithm.user.should.equal(user);
      algorithm.password.should.be.instanceof(Buffer);
      algorithm.password.toString('utf8').should.eql(password);
      algorithm.clientChallenge.should.equal(clientChallenge);
      algorithm.getInitialData().should.equal(clientChallenge);
      // initial fields
      var initialFields = algorithm.getInitialFields();
      initialFields.should.eql([user, algorithm.name, clientChallenge]);
      // validate part serialization
      var part = Fields.write({}, algorithm.getInitialFields());
      part.argumentCount.should.equal(1);
      var buffer = part.buffer;
      var offset = 0;
      var field, length;
      buffer.readUInt16LE(offset).should.equal(3);
      offset += 2;
      // user
      length = buffer[offset];
      offset += 1;
      field = buffer.toString('utf8', offset, offset + length);
      offset += length;
      length.should.equal(Buffer.byteLength(algorithm.user));
      field.should.equal(algorithm.user);
      // name
      length = buffer[offset];
      offset += 1;
      field = buffer.toString('utf8', offset, offset + length);
      offset += length;
      length.should.equal(Buffer.byteLength(algorithm.name));
      field.should.equal(algorithm.name);
      // clientChallenge
      length = buffer[offset];
      offset += 1;
      field = buffer.slice(offset, offset + length);
      offset += length;
      length.should.equal(algorithm.clientChallenge.length);
      field.should.eql(algorithm.clientChallenge);
      // clientProof
      algorithm.getClientProof([salt], serverChallenge).should.eql(
        clientProof);
      // final fields
      var finalFields = algorithm.getFinalFields([
        algorithm.name,
        serverChallengeData
      ]);
      finalFields.should.eql([user, algorithm.name, clientProof]);

    });

    it('should read an authentication reply', function () {
      //var options = Authentication.read(replyPart);
      //options.should.eql(replyOptions);
    });

  });

});