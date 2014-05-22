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

var lib = require('./hdb').lib;
var PartKind = lib.common.PartKind;
var ReadLobReply = lib.data[PartKind.READ_LOB_REPLY];
var ReadLobRequest = lib.data[PartKind.READ_LOB_REQUEST];

describe('Data', function () {

  var reqPart = {
    argumentCount: 1,
    buffer: new Buffer([
      0x00, 0x00, 0x00, 0x00, 0xf0, 0x18, 0x03, 0x00,
      0x01, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x40, 0x0d, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00
    ])
  };

  var reqOptions = {
    locatorId: 871844001349632,
    offset: 1025,
    length: 200000
  };

  var replyPart = {
    argumentCount: 1,
    buffer: new Buffer([
      0x00, 0x00, 0x00, 0x00, 0xf0, 0x18, 0x03, 0x00,
      0x01, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x60, 0x61, 0x62, 0x63, 0x00, 0x00, 0x00, 0x00
    ])
  };

  var replyOptions = {
    locatorId: new Buffer([0x00, 0x00, 0x00, 0x00, 0xf0, 0x18, 0x03, 0x00]),
    options: 1,
    chunk: new Buffer([0x60, 0x61, 0x62, 0x63])
  };

  describe('#ReadLob', function () {

    it('should write a ReadLob request', function () {
      var part = ReadLobRequest.write({}, reqOptions);
      part.should.eql(reqPart);
    });

    it('should read a ReadLob reply', function () {
      var options = ReadLobReply.read(replyPart);
      options.should.eql(replyOptions);
    });

  });

});