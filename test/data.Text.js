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

var lib = require('../lib');
var PartKind = lib.common.PartKind;
var Command = lib.data[PartKind.COMMAND];
var ClientId = lib.data[PartKind.CLIENT_ID];

describe('Data', function () {

  describe('#Text', function () {

    var command = 'select * from dummy';
    var commandPart = {
      argumentCount: 1,
      buffer: new Buffer(command, 'utf8')
    };

    it('should write a Command part', function () {
      Command.write({}, command).should.eql(commandPart);
      Command.write.call(command).should.eql(commandPart);
    });

    it('should get the byteLength of a Command part', function () {
      Command.getByteLength(command).should.equal(19);
    });

    it('should read a Command part', function () {
      Command.read(commandPart).should.equal(command);
    });

  });

  describe('#Text20', function () {

    var clientId = '1234@localhost';
    var clientIdPart = {
      argumentCount: 1,
      buffer: new Buffer(' ' + clientId, 'utf8')
    };

    it('should write a ClientId part', function () {
      ClientId.write({}, clientId).should.eql(clientIdPart);
      ClientId.write.call(clientId).should.eql(clientIdPart);
    });

    it('should get the byteLength of a ClientId part', function () {
      ClientId.getByteLength(clientId).should.equal(15);
    });

    it('should read a ClientId part', function () {
      ClientId.read(clientIdPart).should.equal(clientId);
    });

  });

});