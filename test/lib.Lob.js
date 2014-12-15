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
/* jshint expr: true */

var lib = require('./hdb').lib;
var Lob = lib.Lob;
var PartKind = lib.common.PartKind;
var ReadLobReply = lib.data[PartKind.READ_LOB_REPLY];
var LobOptions = lib.common.LobOptions;


var locatorId = new Buffer([1, 0, 0, 0, 0, 0, 0, 0]);

function createReadLobReply(options, chunk) {
  var buffer = new Buffer(chunk.length + 16);
  locatorId.copy(buffer, 0);
  buffer[8] = options;
  buffer.writeInt32LE(chunk.length, 9);
  chunk.copy(buffer, 16);
  return new ReadLobReply.read({
    argumentCount: 1,
    buffer: buffer
  });
}

function createLob(err) {
  /* jshint bitwise:false */
  var options = createReadLobReply(LobOptions.DATA_INCLUDED, new Buffer([1]));
  options.readSize = 1;
  var readLobReplies = [
    createReadLobReply(LobOptions.DATA_INCLUDED, new Buffer([2])),
    createReadLobReply(LobOptions.DATA_INCLUDED, new Buffer([3])),
    createReadLobReply(LobOptions.DATA_INCLUDED, new Buffer([4])),
    createReadLobReply(LobOptions.DATA_INCLUDED | LobOptions.LAST_DATA,
      new Buffer([5])),
  ];

  function readLob(options, cb) {
    setImmediate(function () {
      if (err) {
        return cb(err);
      }
      var readLobReply = readLobReplies.shift();
      cb(null, {
        readLobReply: readLobReply
      });
    });
  }
  return new Lob(readLob, options);
}

describe('Lib', function () {

  describe('#Lob', function () {

    it('should read a Lob', function (done) {
      var lob = createLob();
      lob.read(function (err, buffer) {
        buffer.should.eql(new Buffer([1, 2, 3, 4, 5]));
        done();
      });
    });

    it('should read a Lob with error', function (done) {
      var _err = new Error('Dummy');
      var lob = createLob(_err);
      lob.read(function (err) {
        err.should.eql(_err);
        done();
      });
    });

    it('should create a read stream', function (done) {
      var lob = createLob();
      var stream = lob.createReadStream();
      var chunks = [];
      stream.on('readable', function () {
        var chunk = stream.read();
        if (chunk) {
          chunks.push(chunk);
        }
        if (chunks.length === 3) {
          lob.pause();
          setTimeout(function () {
            lob.resume();
          }, 1);
        }
      });
      stream.once('error', function (err) {
        done(err);
      });
      stream.once('end', function () {
        Buffer.concat(chunks).should.eql(new Buffer([1, 2, 3,
          4, 5
        ]));
        done();
      });
    });

    it('should not create a read stream', function () {
      var lob = createLob();
      lob.pause();
      var stream = lob.createReadStream();
      (stream === null).should.be.ok;
    });


    it('should try to read a lob in invalid state', function (done) {
      var lob = createLob();
      lob.pause();
      lob.read(function (err) {
        err.message.should.eql('Lob invalid state error');
        done();
      });
    });

  });
});