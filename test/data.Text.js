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
var util = require('../lib/util');
var PartKind = lib.common.PartKind;
var Command = lib.data[PartKind.COMMAND];
var ClientId = lib.data[PartKind.CLIENT_ID];
var ClientInfo = lib.data[PartKind.CLIENT_INFO];

describe('Data', function () {

  function createPart(command, useCesu8) {
    var part =  useCesu8 ? { useCesu8: true } : {};
    return util.extend(part, {
      argumentCount: 1,
      buffer: (useCesu8) ? util.convert.encode(command, true) : new Buffer(command, 'utf8')
    });
  }

  describe('#Text', function () {

    var command = 'select * from dummy';
    var commandPart = createPart(command);

    var cesuCommand = "select '🍨' as result from dummy";
    var cesuPart = createPart(cesuCommand, true);

    it('should write a Command part', function () {
      Command.write({}, command).should.eql(commandPart);
      Command.write.call(command).should.eql(commandPart);
    });

    it('should write a Command part using cesu-8 if useCesu8 is enabled', function () {
      Command.write({ useCesu8: true }, cesuCommand).should.eql(cesuPart);
    });

    it('should get the byteLength of a Command part', function () {
      Command.getByteLength(command).should.equal(19);
    });

    it('should read a Command part', function () {
      Command.read(commandPart).should.equal(command);
    });

    it('should read a Command part in cesu8', function () {
      Command.read(cesuPart).should.equal(cesuCommand);
    });

  });

  describe('#Text20', function () {

    var clientId = '1234@localhost';
    var clientIdPart = createPart(' ' + clientId);
    var cesuIdPart = '🍪';
    var cesuClientIdPart = createPart(' ' + cesuIdPart, true);

    it('should write a ClientId part', function () {
      ClientId.write({}, clientId).should.eql(clientIdPart);
      ClientId.write.call(clientId).should.eql(clientIdPart);
    });

    it('should write a ClientId part using cesu-8 if useCesu8 is enabled', function () {
      ClientId.write({ useCesu8: true }, cesuIdPart).should.eql(cesuClientIdPart);
    });

    it('should get the byteLength of a ClientId part', function () {
      ClientId.getByteLength(clientId).should.equal(15);
    });

    it('should read a ClientId part', function () {
      ClientId.read(clientIdPart).should.equal(clientId);
    });

    it('should read a ClientId part in cesu8', function () {
      ClientId.read(cesuClientIdPart).should.equal(cesuIdPart);
    });

  });

  describe('#TextList', function () {

    var textList = ['a', 'b'];
    var clientInfoPart = {
      argumentCount: 2,
      buffer: new Buffer([1, textList[0].charCodeAt(), 1, textList[1].charCodeAt()])
    };

    var cesu8textList = ['🍩', '🍨'];
    var cesu8clientInfoPart = {
      argumentCount: 2,
      buffer: Buffer.concat([
        new Buffer([6]),
        util.convert.encode(cesu8textList[0], true),
        new Buffer([6]),
        util.convert.encode(cesu8textList[1], true)
      ]),
      useCesu8: true
    };

    var largeTextList = [
      Array(256).join('a'),
      Array(256).join('b')
    ];
    var largeClientInfoPart = {
      argumentCount: 2,
      buffer: Buffer.concat([
        new Buffer([0xf6, 0xff, 0]),
        new Buffer(largeTextList[0], 'utf-8'),
        new Buffer([0xf6, 0xff, 0]),
        new Buffer(largeTextList[1], 'utf-8')
      ])
    };

    it('should write a ClientInfo part', function () {
      ClientInfo.write({}, textList).should.eql(clientInfoPart);
      ClientInfo.write.call(textList).should.eql(clientInfoPart);
    });

    it('should write a ClientInfo part in cesu-8', function () {
      ClientInfo.write({ useCesu8: true }, cesu8textList).should.eql(cesu8clientInfoPart);
    });

    it('should write a large ClientInfo part', function () {
      ClientInfo.write({}, largeTextList).should.eql(largeClientInfoPart);
      ClientInfo.write.call(largeTextList).should.eql(largeClientInfoPart);
    });

    it('should get the byteLength of a TextList part', function () {
      ClientInfo.getByteLength(textList).should.equal(4);
    });

    it('should get the byteLength of a TextList part in cesu-8', function () {
      ClientInfo.getByteLength(cesu8textList, true).should.equal(14);
    });
  });
});

