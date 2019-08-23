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
var request = lib.request;
var common = lib.common;
var MAX_SEGMENT_SIZE = common.MAX_PACKET_SIZE - common.PACKET_HEADER_LENGTH;
var auth = lib.auth;

describe('Req', function () {

  var segmentHeader = Buffer.from([
    0x48, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x01, 0x00,
    0x01,
    0x41,
    0x00,
    0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);

  var partHeader = Buffer.from([
    0x21,
    0x00,
    0x01, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x1a, 0x00, 0x00, 0x00,
    0xc8, 0xff, 0x01, 0x00
  ]);


  var partBuffer = Buffer.from([
    0x03, 0x00,
    0x06, 0x53, 0x59, 0x53, 0x54, 0x45, 0x4d,
    0x0b, 0x53, 0x43, 0x52, 0x41, 0x4d, 0x53, 0x48, 0x41, 0x32, 0x35,
    0x36,
    0x04, 0x01, 0x02, 0x03, 0x04,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00 // filler
  ]);

  var buffer = Buffer.concat([segmentHeader, partHeader, partBuffer]);

  var options = {
    user: 'SYSTEM',
    password: 'secret',
    clientChallenge: Buffer.from([0x01, 0x02, 0x03, 0x04])
  };

  describe('#authenticate', function () {

    it('should create an authenticate request',
      function () {
        var manager = auth.createManager(options);
        var req = request.authenticate({
          authentication: manager.initialData()
        });
        req.parts.should.have.length(1);
        req.parts[0].kind.should.equal(lib.common.PartKind.AUTHENTICATION);
        var fields = [options.user, 'SCRAMSHA256', options.clientChallenge];
        req.parts[0].args.should.eql(fields);
        req.toBuffer(MAX_SEGMENT_SIZE).should.eql(buffer);
      });

  });

});