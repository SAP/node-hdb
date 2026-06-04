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
var RemoteDB = require('../db/RemoteDB');

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
            rs.closed.should.be.true();
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
          function testOnPremise() {
            var sql =
              'select * from READ_NUMBERS_BETWEEN_VIEW with parameters (' +
              '\'placeholder\' = (\'$$a$$\', \'3\'),' +
              '\'placeholder\' = (\'$$b$$\', \'5\'))';
            client.exec(sql, validateResult);
          }

          function testCloud() {
            var sql = 'SELECT * FROM READ_NUMBERS_BETWEEN_FUNC (placeholder."A"=>\'3\', placeholder."B"=>\'5\')';
            client.exec(sql, validateResult);
          }

          function validateResult(err, rows) {
            if (err) {
              return done(err);
            }
            rows.should.have.length(3);
            rows.should.eql(db.numbers.slice(3, 6));
            done();
          }

          if (db instanceof RemoteDB) {
            var version = db.getHANAFullVersion();
            if (version !== undefined && version.startsWith("4.")) { // HANA Cloud
              testCloud();
            } else {
              testOnPremise();
            }
          } else {
            // Mock server models on premise
            testOnPremise();
          }
        });
      });

  });

  describe('result set format', function () {
    // SQL joins NUMBERS (A=1, B='one') with NUMBER_SECOND_TABLE (A=2, DATA='SECOND').
    // Both tables have a column named A, so duplicate-column behavior is observable.
    const joinSql = 'SELECT * FROM NUMBERS, NUMBER_SECOND_TABLE WHERE NUMBERS.A = 1';

    before(db.createNumbers.bind(db));
    before(function (done) {
      client.exec('DROP TABLE NUMBER_SECOND_TABLE CASCADE', function () {
        // ignore error — table may not exist yet
        client.exec('CREATE COLUMN TABLE NUMBER_SECOND_TABLE (A INT, DATA NVARCHAR(100))', function (err) {
          if (err) return done(err);
          client.exec("INSERT INTO NUMBER_SECOND_TABLE VALUES(2, 'SECOND')", done);
        });
      });
    });

    after(db.dropNumbers.bind(db));
    after(function (done) {
      client.exec('DROP TABLE NUMBER_SECOND_TABLE CASCADE', done);
    });

    it('default format: duplicate column name retains only the last value', function (done) {
      client.exec(joinSql, function (err, rows) {
        if (err) return done(err);
        rows.should.have.length(1);
        // NUMBERS.A=1 is overwritten by NUMBER_SECOND_TABLE.A=2 (last column wins)
        rows[0].should.eql({ A: 2, B: 'one', DATA: 'SECOND' });
        done();
      });
    });

    it('rowsAsArray:true returns column values as an array in column order', function (done) {
      client.exec({ sql: joinSql, rowsAsArray: true }, function (err, rows) {
        if (err) return done(err);
        rows.should.have.length(1);
        // All four column values: NUMBERS.A, NUMBERS.B, NUMBER_SECOND_TABLE.A, NUMBER_SECOND_TABLE.DATA
        rows[0].should.eql([1, 'one', 2, 'SECOND']);
        done();
      });
    });

    it('nestTables:true nests each column under its source table name', function (done) {
      client.exec(joinSql, { nestTables: true }, function (err, rows) {
        if (err) return done(err);
        rows.should.have.length(1);
        rows[0].should.eql({
          NUMBERS: { A: 1, B: 'one' },
          NUMBER_SECOND_TABLE: { A: 2, DATA: 'SECOND' }
        });
        done();
      });
    });

  });

});
