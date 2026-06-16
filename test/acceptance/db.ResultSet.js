// Copyright 2026 SAP AG.
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

const lib = require('../../lib');
const ResultSet = lib.ResultSet;
const db = require('../db')();

describe('db', function () {
  before(db.init.bind(db));
  after(db.end.bind(db));
  const client = db.client;

  describe('ResultSet', function () {
    describe('NUMBERS', function () {
      before(db.createNumbers.bind(db));
      after(db.dropNumbers.bind(db));

      const allSql = 'SELECT * FROM NUMBERS ORDER BY A';

      it('setFetchSize() returns all rows correctly over multiple fetches', function (done) {
        client.execute(allSql, function (err, rs) {
          if (err) return done(err);
          rs.setFetchSize(10);
          rs.fetch(function (err, rows) {
            if (err) return done(err);
            rows.should.have.length(db.numbers.length);
            rows.should.eql(db.numbers);
            done();
          });
        });
      });

      it('close() before reading all rows sets rs.closed to true', function (done) {
        client.execute(allSql, function (err, rs) {
          if (err) return done(err);
          const stream = rs.createObjectStream();
          stream.on('error', function () {});
          stream.once('data', function () {
            rs.closed.should.be.false();
            rs.close(function (closeErr) {
              rs.closed.should.be.true();
              done(closeErr);
            });
          });
        });
      });

      it('fetch() sets rs.closed to true after exhausting all rows', function (done) {
        client.execute(allSql, function (err, rs) {
          if (err) return done(err);
          rs.fetch(function (err, rows) {
            if (err) return done(err);
            rows.should.have.length(db.numbers.length);
            rows.should.eql(db.numbers);
            rs.closed.should.be.true();
            done();
          });
        });
      });

      it('createObjectStream() emits one row object per data event', function (done) {
        client.execute(allSql, function (err, rs) {
          if (err) return done(err);
          const stream = rs.createObjectStream();
          const rows = [];
          let eventCount = 0;
          stream.on('error', done);
          stream.on('data', function (row) {
            eventCount++;
            (row instanceof Array).should.be.false();
            row.should.have.property('A');
            row.should.have.property('B');
            rows.push(row);
          });
          stream.on('end', function () {
            eventCount.should.equal(db.numbers.length);
            rows.should.eql(db.numbers);
            done();
          });
        });
      });

      it('createArrayStream() default batchSize emits all rows in one data event', function (done) {
        client.execute(allSql, function (err, rs) {
          if (err) return done(err);
          const stream = rs.createArrayStream(); // default is 1000 rows per batch
          const allRows = [];
          let eventCount = 0;
          stream.on('error', done);
          stream.on('data', function (batch) {
            eventCount++;
            (batch instanceof Array).should.be.true();
            allRows.push.apply(allRows, batch);
          });
          stream.on('end', function () {
            allRows.should.have.length(db.numbers.length);
            allRows.should.eql(db.numbers);
            eventCount.should.equal(1);
            done();
          });
        });
      });

      it('createArrayStream(true) emits rows per execute or fetch request', function (done) {
        client.execute(allSql, function (err, rs) {
          if (err) return done(err);
          rs.setFetchSize(50);
          const stream = rs.createArrayStream(true);
          const allRows = [];
          let eventCount = 0;
          stream.on('error', done);
          stream.on('data', function (batch) {
            eventCount++;
            (batch instanceof Array).should.be.true();
            allRows.push.apply(allRows, batch);
            if(eventCount === 1) {
                allRows.should.have.length(32); // execute returns first 32 rows
            } else if(eventCount === 2) {
                allRows.should.have.length(32 + 50); // fetch request returns next 50 rows
            }
          });
          stream.on('end', function () {
            allRows.should.have.length(db.numbers.length);
            allRows.should.eql(db.numbers);
            eventCount.should.equal(3); // one batch from execute and two batches from fetch
            done();
          });
        });
      });

      it('createArrayStream(60) emits batches of 60 rows per data event', function (done) {
        client.execute(allSql, function (err, rs) {
          if (err) return done(err);
          const stream = rs.createArrayStream(60);
          const allRows = [];
          let eventCount = 0;
          stream.on('error', done);
          stream.on('data', function (batch) {
            eventCount++;
            (batch instanceof Array).should.be.true();
            if(eventCount === 1) {
                batch.should.have.length(60);
            }
            allRows.push.apply(allRows, batch);
          });
          stream.on('end', function () {
            allRows.should.have.length(db.numbers.length);
            allRows.should.eql(db.numbers);
            eventCount.should.equal(Math.ceil(db.numbers.length / 60));
            done();
          });
        });
      });

      it('empty result set returns zero rows without error', function (done) {
        const sql = 'SELECT * FROM NUMBERS WHERE A = -1';
        client.execute(sql, function (err, rs) {
          if (err) return done(err);
          rs.fetch(function (err, rows) {
            if (err) return done(err);
            rows.should.have.length(0);
            done();
          });
        });
      });

      it('result set with a single row returns exactly one row', function (done) {
        const sql = 'SELECT * FROM NUMBERS WHERE A = 42';
        client.execute(sql, function (err, rs) {
          if (err) return done(err);
          rs.fetch(function (err, rows) {
            if (err) return done(err);
            rows.should.have.length(1);
            rows[0].should.eql({ A: 42, B: 'fourty-two' });
            done();
          });
        });
      });

      it('fetch() on an already-closed result set throws a TypeError', function (done) {
        const sql = 'SELECT * FROM NUMBERS WHERE A < 5 ORDER BY A';
        client.execute(sql, function (err, rs) {
          if (err) return done(err);
          rs.fetch(function (err) {
            if (err) return done(err);
            rs.closed.should.be.true();
            let threw = false;
            try {
              rs.fetch(function () {});
            } catch (e) {
              threw = true;
              e.should.be.instanceof(TypeError);
            }
            threw.should.be.true();
            done();
          });
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
        client.execute(joinSql, function (err, rs) {
          if (err) return done(err);
          const stream = rs.createObjectStream();
          const rows = [];
          stream.on('error', done);
          stream.on('data', function (row) { rows.push(row); });
          stream.on('end', function () {
            rows.should.have.length(1);
            // NUMBERS.A=1 is overwritten by NUMBER_SECOND_TABLE.A=2 (last column wins)
            rows[0].should.eql({ A: 2, B: 'one', DATA: 'SECOND' });
            done();
          });
        });
      });

      it('rowsAsArray:true returns column values as an array in column order', function (done) {
        client.execute({ sql: joinSql, rowsAsArray: true }, function (err, rs) {
          if (err) return done(err);
          const stream = rs.createObjectStream();
          const rows = [];
          stream.on('error', done);
          stream.on('data', function (row) { rows.push(row); });
          stream.on('end', function () {
            rows.should.have.length(1);
            // All four column values: NUMBERS.A, NUMBERS.B, NUMBER_SECOND_TABLE.A, NUMBER_SECOND_TABLE.DATA
            rows[0].should.eql([1, 'one', 2, 'SECOND']);
            done();
          });
        });
      });

      it('nestTables:true nests each column under its source table name', function (done) {
        client.execute({ sql: joinSql, nestTables: true }, function (err, rs) {
          if (err) return done(err);
          const stream = rs.createObjectStream();
          const rows = [];
          stream.on('error', done);
          stream.on('data', function (row) { rows.push(row); });
          stream.on('end', function () {
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

    describe('result set larger than packet size', function () {
      // generates a SQL string that returns a result set with numRows
      // and two columns (ROW_NUM base 0) and DATA
      // where each row contains dataPerRows bytes in the DATA column
      function generateSelect(numRows, dataPerRow) {
        return "SELECT GENERATED_PERIOD_START AS ROW_NUM, "+
                       "LPAD(GENERATED_PERIOD_START,"+dataPerRow+", 'a') AS DATA " +
                "FROM SERIES_GENERATE_INTEGER(1, 0, "+numRows+") " +
                "ORDER BY ROW_NUM";
      }

      it('first 12 rows fits into 128K (default packet size)', function (done) {
        // 121,200 bytes of data
        client.execute(generateSelect(12, 10100), function (err, rs) {
          if (err) return done(err);
          rs.fetch(function(err, allRows) {
            allRows.should.have.length(12);
            allRows[0].ROW_NUM.should.equal(0);
            allRows[0].DATA.should.have.length(10100);
            allRows[11].ROW_NUM.should.equal(11);
            allRows[11].DATA.should.have.length(10100);
            done();
          });
        });
      });

      it('1000 row 10MB result set (replies larger than packet size)', function (done) {
        this.timeout(10000);
        // 1000 rows, total 10MB of data
        // 320K in execute reply and the rest in fetch reply
        // driver automatically handles replies larger than the packet size.
        client.execute(generateSelect(1000, 10000), function (err, rs) {
          if (err) return done(err);
          // true parameter means emit rows per execute or fetch request
          const stream = rs.createArrayStream(true);
          const allRows = [];
          let eventCount = 0;
          stream.on('error', done);
          stream.on('data', function (batch) {
            eventCount++;
            (batch instanceof Array).should.be.true();
            allRows.push.apply(allRows, batch);
            if(eventCount === 1) {
                batch.should.have.length(32);
            } else {
                batch.should.have.length(1000 - 32);
            }
          });
          stream.on('end', function () {
            allRows.should.have.length(1000);
            allRows[0].ROW_NUM.should.equal(0);
            allRows[0].DATA.should.have.length(10000);
            allRows[999].ROW_NUM.should.equal(999);
            allRows[999].DATA.should.have.length(10000);
            eventCount.should.equal(2); // one batch from execute and two batches from fetch
            done();
          });
        });
      });

    });

  });
});
