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
var db = require('../db')();
var RemoteDB = require('../db/RemoteDB');

var describeRemoteDB = db instanceof RemoteDB ? describe : describe.skip;

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

  describe('IMAGES', function () {
    before(db.createImages.bind(db));
    after(db.dropImages.bind(db));

    var dirname = path.join(__dirname, '..', 'fixtures', 'img');

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
});

function MD5(data) {
  var hash = crypto.createHash('md5');
  hash.update(data);
  return hash.digest('hex').toUpperCase();
}
