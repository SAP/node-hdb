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
var scramsha256 = lib.auth.SCRAMSHA256;
var Authentication = scramsha256.Authentication;
var PartKind = lib.common.PartKind;
var Fields = lib.data[PartKind.AUTHENTICATION];

describe('Authentication', function () {

  describe('#SCRAMSHA256', function () {

    var reqOptions = {
      user: 'SYSTEM',
      algorithm: 'SCRAMSHA256',
      clientChallenge: new Buffer([0x01, 0x02, 0x03, 0x04])
    };
    var reqPart = {
      argumentCount: 1,
      buffer: new Buffer([
        0x03, 0x00,
        0x06, 0x53, 0x59, 0x53, 0x54, 0x45, 0x4d,
        0x0b, 0x53, 0x43, 0x52, 0x41, 0x4d, 0x53, 0x48,
        0x41, 0x32, 0x35, 0x36,
        0x04, 0x01, 0x02, 0x03, 0x04
      ])
    };

    var replyOptions = {
      algorithm: 'SCRAMSHA256',
      salt: new Buffer([
        0x80, 0x96, 0x4f, 0xa8, 0x54, 0x28, 0xae, 0x3a,
        0x81, 0xac, 0xd3, 0xe6, 0x86, 0xa2, 0x79, 0x33
      ]),
      serverChallenge: new Buffer([
        0x41, 0x06, 0x51, 0x50, 0x11, 0x7e, 0x45, 0x5f,
        0xec, 0x2f, 0x03, 0xf6, 0xf4, 0x7c, 0x19, 0xd4,
        0x05, 0xad, 0xe5, 0x0d, 0xd6, 0x57, 0x31, 0xdc,
        0x0f, 0xb3, 0xf7, 0x95, 0x4d, 0xb6, 0x2c, 0x8a,
        0xa6, 0x7a, 0x7e, 0x82, 0x5e, 0x13, 0x00, 0xbe,
        0xe9, 0x75, 0xe7, 0x45, 0x18, 0x23, 0x8c, 0x9a
      ])
    };

    var replyPart = Fields.write({}, [
      replyOptions.algorithm, [replyOptions.salt, replyOptions.serverChallenge]
    ]);
    it('should write an authentication request', function () {
      var part = Authentication.write({}, reqOptions);
      part.should.eql(reqPart);
    });

    it('should read an authentication reply', function () {
      var options = Authentication.read(replyPart);
      options.should.eql(replyOptions);
    });

  });

});