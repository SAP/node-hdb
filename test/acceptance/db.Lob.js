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
/* jshint undef:false, expr:true */

var fs = require('fs');
var path = require('path');
var util = require('util');
var crypto = require('crypto');
var async = require('async');
var stream = require('stream');
var db = require('../db')();
var RemoteDB = require('../db/RemoteDB');
var common = require('../../lib/protocol/common');
var DEFAULT_PACKET_SIZE = common.DEFAULT_PACKET_SIZE;

var describeRemoteDB = db instanceof RemoteDB ? describe : describe.skip;
var isRemoteDB = db instanceof RemoteDB;

if (!Buffer.prototype.equals) {
  Buffer.prototype.equals = function (buffer) {
    if (!Buffer.isBuffer(buffer)) {
      return false;
    }
    if (this.length !== buffer.length) {
      return false;
    }
    for (var i = 0; i < this.length; i++) {
      if (this[i] !== buffer[i]) {
        return false;
      }
    }
    return true;
  };
}

describe('db', function () {
  this.timeout(50000);

  before(db.init.bind(db));
  after(db.end.bind(db));

  var client = db.client;
  var transaction = client._connection._transaction;

  var dirname = path.join(__dirname, '..', 'fixtures', 'img');

  describe('IMAGES', function () {
    before(db.createImages.bind(db));
    after(db.dropImages.bind(db));

    it('should return all images via callback', function (done) {
      var sql = 'select * from images order by NAME';
      client.exec(sql, function (err, rows) {
        if (err) {
          return done(err);
        }
        rows.should.have.length(db.images.length);
        for (var i = 0; i < rows.length; i++) {
          rows[i].NAME.should.equal(db.images[i].NAME);
          rows[i].BDATA.equals(db.images[i].BDATA).should.be.ok;
        }
        done();
      });
    });

    it('should insert a small image via prepared statement', function (
      done) {
      function prepare(cb) {
        var sql = 'insert into images values (?, ?)';
        client.prepare(sql, cb);
      }

      function insert(statement, cb) {
        var params = [
          'logo.1.png',
          fs.createReadStream(path.join(dirname, 'logo.png'))
        ];

        statement.exec(params, cb);
      }

      function validate(rowsAffected, cb) {
        rowsAffected.should.equal(1);
        cb();
      }
      async.waterfall([prepare, insert, validate], done);
    });

    it('should insert a large image via multiple write lob requests',
      function (done) {
        function onnew(kind) {
          kind.should.equal('write');
        }
        transaction.once('new', onnew);

        function onend(success, kind) {
          success.should.be.true;
          kind.should.equal('write');
        }
        transaction.once('end', onend);

        function prepare(cb) {
          var sql = 'insert into images values (?, ?)';
          client.prepare(sql, cb);
        }

        function insert(statement, cb) {
          var params = [
            'sap.2.jpg',
            fs.createReadStream(path.join(dirname, 'sap.jpg'))
          ];

          statement.exec(params, cb);
        }

        function validate(rowsAffected, cb) {
          rowsAffected.should.equal(1);
          cb();
        }

        async.waterfall([prepare, insert, validate], done);
      });

    it('should insert multiple different images via batch',
      function (done) {
        function onnew(kind) {
          kind.should.equal('write');
        }
        transaction.once('new', onnew);

        function onend(success, kind) {
          success.should.be.true;
          kind.should.equal('write');
        }
        transaction.once('end', onend);

        function prepare(cb) {
          var sql = 'insert into images values (?, ?)';
          client.prepare(sql, cb);
        }

        function insert(statement, cb) {

          var params = [
            ['lobby.3.jpg',
              fs.createReadStream(path.join(dirname, 'lobby.jpg'))
            ],
            ['locked.3.png',
              fs.createReadStream(path.join(dirname, 'locked.png'))
            ],
            ['logo.3.png',
              fs.createReadStream(path.join(dirname, 'logo.png'))
            ],
            ['sap.3.jpg',
              fs.createReadStream(path.join(dirname, 'sap.jpg'))
            ],
          ];

          statement.exec(params, cb);
        }

        function validate(rowsAffected, cb) {
          rowsAffected.should.eql([1, 1, 1, 1]);
          cb();
        }

        async.waterfall([prepare, insert, validate], done);
      });
  });

  describeRemoteDB('HASH_BLOB', function() {
    var statement;

    before(function (done) {
      async.series([
        db.createHashBlobProc.bind(db),
        client.prepare.bind(client, 'call HASH_BLOB (?)'),
      ], function(err, results) {
        statement = results[1];
        done(err);
      });
    });

    after(db.dropHashBlobProc.bind(db));

    // call the procedure with images of different sizes
    var images = require('../fixtures/images');
    images.forEach(function(image) {
      var title = util.format('should call the procedure with %s (%dB) and get its hash in a result set',
        image.NAME, image.BDATA.length);
      it(title, function(done) {
        var params = [ image.BDATA ];
        statement.exec(params, function(err, outParams, rows) {
          if (err) {
            return done(err);
          }
          arguments.should.have.length(3);
          rows.should.have.length(1);
          rows[0].should.eql({
            ALGO: 'MD5',
            DIGEST: MD5(image.BDATA)
          });
          done();
        });
      });
    });
  });

  describeRemoteDB('Readable stream input (issue 215)', function () {
    this.timeout(3000);

    beforeEach(function (done) {
      if (isRemoteDB) {
        db.createTable.bind(db)('STREAM_BLOB_TABLE', ['"ID" INT NOT NULL',
          '"NAME" NVARCHAR(256) NOT NULL', '"IMG" BLOB', '"LOGO" BLOB', '"DESCR" NCLOB',
          'PRIMARY KEY ("ID")'], null, done);
      } else {
        this.skip();
        done();
      }
    });
    afterEach(function (done) {
      if (isRemoteDB) {
        db.dropTable.bind(db)('STREAM_BLOB_TABLE', done);
      } else {
        done();
      }
    });

    function testInsertReadableStream(inputStream, expected, done) {
      var statement;
      function prepareInsert(cb) {
        client.prepare('INSERT INTO STREAM_BLOB_TABLE VALUES (?, ?, ?, ?, ?)', function (err, ps) {
          if (err) done(err);
          statement = ps;
          cb(err);
        });
      }

      function insert(cb) {
        statement.exec([
          1,
          'SAP AG',
          fs.createReadStream(path.join(dirname, 'logo.png')),
          inputStream,
          Buffer.from('SAP headquarters located in Walldorf, Germany', 'ascii')
        ], function (err, rowsAffected) {
          if (err) done(err);
          statement.drop();
          cb(err);
        });
      }

      function select(cb) {
        client.exec('SELECT * FROM STREAM_BLOB_TABLE', function (err, rows) {
          if (err) done(err);
          rows.should.have.length(1);
          rows.should.eql([{
            ID: 1,
            NAME: 'SAP AG',
            IMG: fs.readFileSync(path.join(dirname, 'logo.png')),
            LOGO: expected,
            DESCR: Buffer.from('SAP headquarters located in Walldorf, Germany', 'ascii')
          }]);
          cb();
        });
      }

      async.waterfall([prepareInsert, insert, select], done);
    }

    it('should insert from a stream.Readable with 3 buffers', function (done) {
      var expected = Buffer.from("012", "ascii");
      var inputStream = stream.Readable.from([...Array(3).keys()].map(i => Buffer.from(`${i % 10}`)));
      testInsertReadableStream(inputStream, expected, done);
    });

    it('should insert from a stream.Readable with a buffer larger than the packet size', function (done) {
      var buffer = Buffer.alloc(client._connection.packetSize + 1);
      for (var i = 0; i < buffer.length; i++) {
        buffer[i] = i % 10;
      }
      var inputStream = stream.Readable.from([buffer]);
      testInsertReadableStream(inputStream, buffer, done);
    });

    it('should insert from a strict high water mark stream', function (done) {
      // Tests that packets can be created incrementally without reading the entire packet at once
      var bufferLen = Math.floor(client._connection.packetSize * 2.5);
      var expected = Buffer.alloc(bufferLen);
      for (var i = 0; i < bufferLen; i++) {
        expected[i] = i % 10 + 48; // ascii
      }
      var srcStream = stream.Readable.from([...Array(bufferLen).keys()].map(i => Buffer.from(`${i % 10}`)));
      var transformStream = new StrictMemoryTransform(1024);
      srcStream.pipe(transformStream);
      testInsertReadableStream(transformStream, expected, done);
    });
  });

  describeRemoteDB('Quiet close stream', function () {
    var preparedStatement;
    before(function (done) {
      if (isRemoteDB) {
        db.createTable.bind(db)('STREAM_BLOB_TABLE', ['A BLOB'], null, function (err) {
          if (err) done(err);
          client.prepare('INSERT INTO STREAM_BLOB_TABLE VALUES (?)', function (err, stmt) {
            if (err) done(err);
            preparedStatement = stmt;
            done();
          });
        });
      } else {
        this.skip();
        done();
      }
    });
    after(function (done) {
      if (isRemoteDB) {
        db.dropTable.bind(db)('STREAM_BLOB_TABLE', function () {
          preparedStatement.drop(done);
        });
      } else {
        done();
      }
    });

    function testInsertClosingStream(streamOptions, destroyBefore, expectedErrMessage, done) {
      var srcStream = fs.createReadStream(path.join(dirname, "lobby.jpg"));
      var transformStream = new AbortTransform(streamOptions);
      srcStream.pipe(transformStream);
      if (destroyBefore) {
        transformStream.destroy();
      }
      preparedStatement.exec([transformStream], function (err) {
        err.should.be.an.instanceof(Error);
        err.message.should.equal(expectedErrMessage);
        done();
      });
    }

    var quietCloseErrMessage = "Stream was destroyed before data could be completely consumed";

    it('should raise a destroyed error when given a destroyed stream', function (done) {
      testInsertClosingStream({maxBytes: 50000}, true, quietCloseErrMessage, done);
    });

    it('should raise a destroyed error during an initial write lob execute', function (done) {
      testInsertClosingStream({maxBytes: 50000}, false, quietCloseErrMessage, done);
    });

    it('should raise a destroyed error when stream is destroyed in between packet sends', function (done) {
      testInsertClosingStream({maxBytes: DEFAULT_PACKET_SIZE + 1}, false, quietCloseErrMessage, done);
    });

    it('should raise a destroyed error when stream is destroyed during write lob request', function (done) {
      testInsertClosingStream({maxBytes: DEFAULT_PACKET_SIZE + 1, throttleFlow: true},
        false, quietCloseErrMessage, done);
    });

    it('should raise custom errors provided by user stream', function (done) {
      var streamError = new Error("Custom stream error");
      testInsertClosingStream({maxBytes: 50000, customError: streamError}, false,
        streamError.message, done);
    });
  });
});

function MD5(data) {
  var hash = crypto.createHash('md5');
  hash.update(data);
  return hash.digest('hex').toUpperCase();
}

util.inherits(StrictMemoryTransform, stream.Transform);

// Stream that stores a maximum of bufferLimit data in the internal buffer
// Only works with streams that read byte by byte
function StrictMemoryTransform(bufferLimit, options) {
  this._bufferLimit = bufferLimit;
  stream.Transform.call(this, options);
}

StrictMemoryTransform.prototype._transform = function _transform(chunk, encoding, cb) {
  var self = this;
  function tryPush() {
    if (self.readableLength < self._bufferLimit) {
      self.push(chunk);
      cb();
    } else {
      setImmediate(tryPush);
    }
  }
  tryPush();
}

util.inherits(AbortTransform, stream.Transform);

// Stream that will destroy itself once the maximum number of bytes are transformed
// When throttleFlow is true, the stream will avoid pushing a new chunk before the
// internal buffer is read
function AbortTransform(options) {
  this._maxBytes = options.maxBytes;
  this._customError = options.customError;
  this._throttleFlow = options.throttleFlow;
  this._currentBytes = 0;
  stream.Transform.call(this, options);
}

AbortTransform.prototype._transform = function _transform(chunk, encoding, cb) {
  var self = this;
  function tryPush() {
    if (self.readableLength === 0 || !self._throttleFlow) {
      if (chunk.length + self._currentBytes < self._maxBytes) {
        self.push(chunk);
        self._currentBytes += chunk.length;
      } else {
        self.push(chunk.slice(0, self._maxBytes - self._currentBytes));
        self._currentBytes = self._maxBytes;
        self.destroy(self._customError);
      }
      cb();
    } else {
      setImmediate(tryPush);
    }
  }
  tryPush();
}
