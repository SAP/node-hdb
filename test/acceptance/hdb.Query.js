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

var Readable = require('stream').Readable;
var Writable = require('stream').Writable;
var ResultSet = require('../lib').ResultSet;
var db = require('../lib').createDatabase();

describe('Database', function () {
  before(db.connect.bind(db));
  after(db.disconnect.bind(db));
  var client = db.client;

  describe('Table NUMBERS', function () {
    before(db.createNumbers.bind(db, [0, 100]));
    after(db.dropNumbers.bind(db));

    describe('#Execute', function () {

      it('should return all numbers via callback', function (done) {
        var sql = 'select * from NUMBERS order by A';
        client.exec(sql, function (err, rows) {
          if (err) {
            return done(err);
          }
          rows.should
            .have.length(db.numbers.length)
            .and.eql(db.numbers);
          done();
        });
      });

      it('should return all numbers via fetch', function (done) {
        var sql = 'select * from NUMBERS order by A';
        client.exec(sql, false, function (err, rs) {
          if (err) {
            return done(err);
          }
          rs.should.be.an.instanceof(ResultSet);
          rs.fetch(function onfetch(err, rows) {
            rows.should
              .have.length(db.numbers.length)
              .and.eql(db.numbers);
            rs.closed.should.be.true;
            done();
          });
        });
      });

      it('should return all numbers via createReadStream', function (done) {
        var sql = 'select * from NUMBERS order by A';
        client.exec(sql, false, function onexec(err, rs) {
          if (err) {
            return done(err);
          }
          rs.should.be.an.instanceof(ResultSet);
          var readable = rs.createReadStream();
          readable.should.be.an.instanceof(Readable);
          var rows = [];
          readable.once('error', function onerror() {
            done(err);
          }).on('readable', function onreadable() {
            rows = rows.concat(this.read());
          }).once('end', function onend() {
            rows.should
              .have.length(db.numbers.length)
              .and.eql(db.numbers);
            done();
          });
        });
      });

      it('should return all numbers via pipe', function (done) {
        var sql = 'select * from NUMBERS order by A';
        client.exec(sql, false, function onexec(err, rs) {
          if (err) {
            return done(err);
          }
          rs.should.be.an.instanceof(ResultSet);
          var readable = rs.createReadStream();
          readable.should.be.an.instanceof(Readable);
          var rows = [];
          var writable = new Writable({
            objectMode: true
          });
          writable._write = function (chunk, encoding, callback) {
            rows = rows.concat(chunk);
            callback();
          };
          writable.once('finish', function onfinish() {
            rows.should
              .have.length(db.numbers.length)
              .and.eql(db.numbers);
            done();
          })
          readable.once('error', function onreadable() {
            done(err);
          }).pipe(writable);
        });
      });
    });

    describe('#ProcedureWithResult', function () {
      before(db.createReadNumbersBetween.bind(db));
      after(db.dropReadNumbersBetween.bind(db));

      it('should read the numbers between 3 and 5', function (done) {
        var sql =
          'select * from READ_NUMBERS_BETWEEN_VIEW with parameters (' +
          '\'placeholder\' = (\'$$a$$\', \'3\'),' +
          '\'placeholder\' = (\'$$b$$\', \'5\'))';
        client.exec(sql, function (err, rows) {
          if (err) {
            return done(err);
          }
          rows.should
            .have.length(3)
            .and.eql(db.numbers.slice(3, 6));
          done();
        });
      });
    });

  });
});