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

var lib = require('../lib');
var Lob = lib.Lob;
var LobDescriptor = lib.Reader.LobDescriptor;
var PartKind = lib.common.PartKind;
var ReadLobReply = lib.data[PartKind.READ_LOB_REPLY];
var LobOptions = lib.common.LobOptions;
var LobSourceType = lib.common.LobSourceType;
var locatorId = new Buffer([1, 0, 0, 0, 0, 0, 0, 0]);

function createReadLobReply(chunk, isLast) {
  /* jshint bitwise:false */
  var buffer;
  if (Buffer.isBuffer(chunk) && chunk.length) {
    buffer = new Buffer(chunk.length + 16);
    if (isLast) {
      buffer[8] = LobOptions.DATA_INCLUDED | LobOptions.LAST_DATA;
    } else {
      buffer[8] = LobOptions.DATA_INCLUDED;
    }
    buffer.writeInt32LE(chunk.length, 9);
    chunk.copy(buffer, 16);
  } else {
    buffer = new Buffer(16);
    buffer.fill(0);
  }
  locatorId.copy(buffer, 0);
  return new ReadLobReply.read({
    argumentCount: 1,
    buffer: buffer
  });
}

function createLob(err, length) {
  /* jshint bitwise:false */
  var i = 0;
  var ld = createReadLobReply(new Buffer([++i]));
  ld.type = LobSourceType.BLOB;
  ld.charLength = 0;
  ld.byteLength = 5;
  var options = {
    readSize: 1
  };

  function readLob(options, cb) {
    setTimeout(function () {
      if (err) {
        return cb(err);
      }
      cb(null, {
        readLobReply: createReadLobReply(new Buffer([++i]), i >= length)
      });
    }, 1);
  }
  return new Lob(readLob, ld, options);
}

describe('Lib', function () {

  describe('#Lob', function () {

    it('should read a Lob', function (done) {
      var lob = createLob(null, 5);
      lob.read(function (err, buffer) {
        buffer.should.eql(new Buffer([1, 2, 3, 4, 5]));
        done();
      });
    });

    it('should read a Lob with error', function (done) {
      var dummyError = new Error('Dummy');
      var lob = createLob(dummyError);
      lob.read(function (err) {
        err.should.eql(dummyError);
        done();
      });
    });

    it('should create a read stream', function (done) {
      var lob = createLob(null, 5);
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
        Buffer.concat(chunks).should.eql(new Buffer([1, 2, 3, 4, 5]));
        done();
      });
    });

    it('should not create a read stream', function () {
      var lob = createLob(null);
      lob.pause();
      var stream = lob.createReadStream();
      (stream === null).should.be.ok;
    });

    it('should try to read a lob in invalid state', function (done) {
      var lob = createLob(null);
      lob.pause();
      lob.read(function (err) {
        err.message.should.eql('Lob invalid state error');
        done();
      });
    });

    it('should receive data in paused state', function (done) {
      var ld = createReadLobReply(new Buffer([1]));
      var options = {
        readSize: 1
      };

      function readLob(options, cb) {
        lob.pause();
        setTimeout(function () {
          lob.resume();
        }, 1);
        cb(null, {
          readLobReply: createReadLobReply(new Buffer([2]), true)
        });
      }
      var lob = new Lob(readLob, ld, options);
      var chunks = [];
      lob.on('data', function ondata(chunk) {
        chunks.push(chunk);
      });
      lob.on('end', function onend() {
        Buffer.concat(chunks).should.eql(new Buffer([1, 2]));
        done();
      });
      lob.resume();
    });

    it('should create a Lob with type NCLOB', function () {
      var chunk = new Buffer('e282ac', 'hex');

      function readLob() {}
      var lob = new Lob(readLob, createLobDescriptor(LobSourceType.NCLOB, chunk, 1));
      lob.length.should.equal(1);
      lob.increaseOffset(chunk);
      lob._offset.should.equal(2);
    });

    it('should create a Lob with type NCLOB containing CESU-8 symbols', function () {
      var chunk = new Buffer('eda0bcedbda8', 'hex'); // 🍨

      function readLob() {}
      var lob = new Lob(readLob, createLobDescriptor(LobSourceType.NCLOB, chunk, 1), { useCesu8: true });
      lob.length.should.equal(1);
      lob.increaseOffset(chunk);
      lob._offset.should.equal(2);
    });

    it('should create a Lob with type CLOB', function () {
      var chunk = new Buffer('x', 'ascii');

      function readLob() {}
      var lob = new Lob(readLob, createLobDescriptor(LobSourceType.CLOB, chunk, 1));
      lob.length.should.equal(1);
      lob.increaseOffset(chunk);
      lob._offset.should.equal(2);
    });


    it('should create a Lob with defaultType containing CESU-8 symbols', function () {
      var chunk = new Buffer('eda0bcedbda8', 'hex'); // 🍨

      function readLob() {}
      var ld = createLobDescriptor(LobSourceType.BLOB, chunk, 1)
      ld.defaultType = LobSourceType.NCLOB
      var lob = new Lob(readLob, ld, { useCesu8: true, useDefaultType: true });
      lob.length.should.equal(1);
      lob.increaseOffset(chunk);
      lob._offset.should.equal(2);
    });

    function createLobDescriptor(type, chunk, charLength) {
      var byteLength = chunk.length;
      var options = LobOptions.DATA_INCLUDED | LobOptions.LAST_DATA
      return new LobDescriptor(type, options, charLength, byteLength, locatorId, chunk)
    }

  });
});