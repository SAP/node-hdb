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

var lib = require('../../lib');
var stream = lib.util.stream;
var Readable = stream.Readable;
var Writable = stream.Writable;
var ResultSet = lib.ResultSet;
var db = require('../db')();

describe('db', function () {
  before(db.init.bind(db));
  after(db.end.bind(db));
  var client = db.client;

  describe('NUMBERS', function () {
    before(db.createNumbers.bind(db));
    after(db.dropNumbers.bind(db));

    describe('direct execute of Query', function () {

      it('should return all numbers via callback', function (done) {
        var sql = 'select * from numbers order by A';
        client.exec(sql, function (err, rows) {
          if (err) {
            return done(err);
          }
          rows.should.have.length(db.numbers.length);
          rows.should.eql(db.numbers);
          done();
        });
      });

      it('should return all numbers via fetch', function (done) {
        var sql = 'select * from numbers order by A';
        client.execute(sql, function (err, rs) {
          if (err) {
            return done(err);
          }
          rs.should.be.an.instanceof(ResultSet);
          rs.fetch(function onfetch(err, rows) {
            rows.should.have.length(db.numbers.length);
            rows.should.eql(db.numbers);
            rs.closed.should.be.true;
            done();
          });
        });
      });

      it('should return all numbers via createReadStream', function (done) {
        var sql = 'select * from numbers order by A';
        client.execute(sql, function onexec(err, rs) {
          if (err) {
            return done(err);
          }
          rs.should.be.an.instanceof(ResultSet);
          var readable = rs.createArrayStream();
          readable.should.be.an.instanceof(Readable);
          var rows = [];
          readable.once('error', function onerror() {
            done(err);
          }).on('readable', function onreadable() {
            var chunk = this.read();
            if (chunk) {
              rows = rows.concat(chunk);
            }
          }).once('end', function onend() {
            rows.should.have.length(db.numbers.length);
            rows.should.eql(db.numbers);
            done();
          });
        });
      });

      it('should return all numbers via pipe', function (done) {
        var sql = 'select * from numbers order by A';
        client.execute(sql, function onexec(err, rs) {
          if (err) {
            return done(err);
          }
          rs.should.be.an.instanceof(ResultSet);
          var readable = rs.createObjectStream();
          readable.should.be.an.instanceof(Readable);
          var rows = [];
          var writable = new Writable({
            objectMode: true
          });
          writable._write = function (chunk, encoding, callback) {
            rows.push(chunk);
            callback();
          };
          writable.once('finish', function onfinish() {
            rows.should.have.length(db.numbers.length);
            rows.should.eql(db.numbers);
            done();
          });
          readable.once('error', function onreadable() {
            done(err);
          }).pipe(writable);
        });
      });
    });

    describe('direct execute of ProcView with parameters',
      function () {
        before(db.createReadNumbersProc.bind(db));
        after(db.dropReadNumbersProc.bind(db));

        it('should return the numbers between 3 and 5', function (done) {
          var sql =
            'select * from READ_NUMBERS_BETWEEN_VIEW with parameters (' +
            '\'placeholder\' = (\'$$a$$\', \'3\'),' +
            '\'placeholder\' = (\'$$b$$\', \'5\'))';
          client.exec(sql, function (err, rows) {
            if (err) {
              return done(err);
            }
            rows.should.have.length(3);
            rows.should.eql(db.numbers.slice(3, 6));
            done();
          });
        });
      });

  });
});