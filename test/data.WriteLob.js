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
var WriteLobReply = lib.data[PartKind.WRITE_LOB_REPLY];

describe('Data', function () {

  var replyPart = {
    argumentCount: 3,
    buffer: new Buffer([
      0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ])
  };

  describe('#WriteLob', function () {

    it('should read a WriteLob reply', function () {
      /* jshint expr: true */
      var writeLobReply = WriteLobReply.read(replyPart);
      writeLobReply[0].readUInt8(0).should.equal(1);
      writeLobReply[1].readUInt8(0).should.equal(2);
      writeLobReply[2].readUInt8(0).should.equal(3);
      var argumentCount = WriteLobReply.getArgumentCount(writeLobReply);
      argumentCount.should.equal(replyPart.argumentCount);
    });

  });

});