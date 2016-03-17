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
var async = require('async');
var db = require('../db')();

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
  before(db.init.bind(db));
  after(db.end.bind(db));
  var client = db.client;
  var transaction = client._connection._transaction;

  describe('IMAGES', function () {
    this.timeout(5000);
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
});