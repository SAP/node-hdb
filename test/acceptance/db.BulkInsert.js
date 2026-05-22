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

const async = require('async');
const hdb = require('../../lib');
const db = require('../db')();
const getOptions = require('../db').getOptions;
const RemoteDB = require('../db/RemoteDB');

const describeRemoteDB = db instanceof RemoteDB ? describe : describe.skip;

describeRemoteDB('db', function () {
  before(db.init.bind(db));
  after(db.end.bind(db));
  const client = db.client;

  describe('BulkInsert Integration Tests', function () {
    before(db.createNumbers.bind(db));
    after(db.dropNumbers.bind(db));

    it('should bulk insert an array of rows and return affectedRows per row', function (done) {
      const rows = [
        [1000, 'one-thousand'],
        [1001, 'one-thousand-one'],
        [1002, 'one-thousand-two']
      ];
      async.waterfall([
        function prepare(cb) {
          client.prepare('insert into NUMBERS values (?, ?)', cb);
        },
        function insert(statement, cb) {
          statement.exec(rows, function (err, affectedRows) {
            if (err) return cb(err);
            affectedRows.should.be.an.Array();
            affectedRows.should.have.length(rows.length);
            affectedRows.forEach(function (n) {
              n.should.equal(1);
            });
            statement.drop();
            cb();
          });
        },
        function verify(cb) {
          client.exec('select * from NUMBERS where A >= 1000 and A <= 1002 order by A', function (err, result) {
            if (err) return cb(err);
            result.should.have.length(3);
            result[0].A.should.equal(1000);
            result[0].B.should.equal('one-thousand');
            result[2].A.should.equal(1002);
            cb();
          });
        },
        function cleanup(cb) {
          client.exec('delete from NUMBERS where A >= 1000', cb);
        }
      ], done);
    });

    it('should bulk insert rows with NULL values', function (done) {
      async.waterfall([
        function prepare(cb) {
          client.prepare('insert into NUMBERS values (?, ?)', cb);
        },
        function insert(statement, cb) {
          const rows = [
            [2000, null],
            [2001, 'two-thousand-one']
          ];
          statement.exec(rows, function (err, affectedRows) {
            if (err) return cb(err);
            affectedRows.should.have.length(2);
            statement.drop();
            cb();
          });
        },
        function verify(cb) {
          client.exec('select * from NUMBERS where A >= 2000 order by A', function (err, result) {
            if (err) return cb(err);
            result.should.have.length(2);
            (result[0].B === null).should.be.true();
            result[1].B.should.equal('two-thousand-one');
            cb();
          });
        },
        function cleanup(cb) {
          client.exec('delete from NUMBERS where A >= 2000', cb);
        }
      ], done);
    });

    it('should bulk insert a single-row array', function (done) {
      // When a batch contains exactly one row the server returns a scalar
      // affectedRows (argumentCount === 1), not an array.
      async.waterfall([
        function prepare(cb) {
          client.prepare('insert into NUMBERS values (?, ?)', cb);
        },
        function insert(statement, cb) {
          statement.exec([[3000, 'three-thousand']], function (err, affectedRows) {
            if (err) return cb(err);
            affectedRows.should.equal(1);
            statement.drop();
            cb();
          });
        },
        function verify(cb) {
          client.exec('select * from NUMBERS where A = 3000', function (err, result) {
            if (err) return cb(err);
            result.should.have.length(1);
            result[0].B.should.equal('three-thousand');
            cb();
          });
        },
        function cleanup(cb) {
          client.exec('delete from NUMBERS where A = 3000', cb);
        }
      ], done);
    });

    it('should execute the same prepared statement twice for bulk insert', function (done) {
      let statement;
      async.series([
        function prepare(cb) {
          client.prepare('insert into NUMBERS values (?, ?)', function (err, stmt) {
            if (err) return cb(err);
            statement = stmt;
            cb();
          });
        },
        function firstBatch(cb) {
          statement.exec([[4000, 'four-thousand'], [4001, 'four-thou-one']], function (err, affectedRows) {
            if (err) return cb(err);
            affectedRows.should.have.length(2);
            cb();
          });
        },
        function secondBatch(cb) {
          statement.exec([[4002, 'four-thou-two'], [4003, 'four-thou-three']], function (err, affectedRows) {
            if (err) return cb(err);
            affectedRows.should.have.length(2);
            cb();
          });
        },
        function dropStatement(cb) {
          statement.drop(cb);
        },
        function verify(cb) {
          client.exec('select count(*) as CNT from NUMBERS where A >= 4000 and A <= 4003', function (err, result) {
            if (err) return cb(err);
            result[0].CNT.should.equal(4);
            cb();
          });
        },
        function cleanup(cb) {
          client.exec('delete from NUMBERS where A >= 4000', cb);
        }
      ], done);
    });

    it('should fail bulk insert on type mismatch and return an error', function (done) {
      async.waterfall([
        function prepare(cb) {
          client.prepare('insert into NUMBERS values (?, ?)', cb);
        },
        function insertBadType(statement, cb) {
          // pass a Buffer where an INT is expected
          const rows = [
            [4005, "four-thou-five"],
            [Buffer.from('not-an-int'), 'invalid']
          ];
          statement.exec(rows, function (err) {
            err.should.be.instanceof(Error);
            statement.drop();
            cb();
          });
        },
        // valid row should not have been inserted
        function verify(cb) {
          client.exec('select count(*) as CNT from NUMBERS where A = 4005', function (err, result) {
            if (err) return cb(err);
            result[0].CNT.should.equal(0);
            cb();
          });
        }
      ], done);
    });

    it('should bulk insert 100 rows', function (done) {
      this.timeout(5000);
      const rows = [];
      for (let i = 0; i < 100; i++) {
        rows.push([6000 + i, 'bulk-' + i]);
      }
      async.waterfall([
        function prepare(cb) {
          client.prepare('insert into NUMBERS values (?, ?)', cb);
        },
        function insert(statement, cb) {
          statement.exec(rows, function (err, affectedRows) {
            if (err) return cb(err);
            affectedRows.should.have.length(100);
            statement.drop();
            cb();
          });
        },
        function verify(cb) {
          client.exec('select count(*) as CNT from NUMBERS where A >= 6000 and A < 6100', function (err, result) {
            if (err) return cb(err);
            result[0].CNT.should.equal(100);
            cb();
          });
        },
        function cleanup(cb) {
          client.exec('delete from NUMBERS where A >= 6000', cb);
        }
      ], done);
    });

    it('should bulk delete with alternating matching/non-matching rows and return correct affectedRows', function (done) {
      // Insert A = 7000..7009, commit, then bulk delete with 10 params where
      // even-indexed params target inserted rows (7000,7001,7002,7003,7004) and
      // odd-indexed params target non-existent rows (7010..7014), so 5 hit and 5 miss.
      const insertRows = [];
      for (let i = 0; i < 10; i++) {
        insertRows.push([7000 + i, 'del-test-' + i]);
      }
      const deleteParams = [];
      for (let j = 0; j < 5; j++) {
        deleteParams.push([7000 + j]);
        deleteParams.push([7010 + j]);
      }

      async.waterfall([
        function prepare(cb) {
          client.prepare('insert into NUMBERS values (?, ?)', cb);
        },
        function bulkInsert(statement, cb) {
          // insert and commit 10 rows
          statement.exec(insertRows, function (err) {
            if (err) return cb(err);
            statement.drop();
            cb();
          });
        },
        function prepareDelete(cb) {
          client.prepare('delete from NUMBERS where A = ?', cb);
        },
        function bulkDelete(statement, cb) {
          // delete 1/2 of the rows (deleteParams alternates matching/non-matching)
          statement.exec(deleteParams, function (err, affectedRows) {
            if (err) return cb(err);
            affectedRows.should.have.length(10);
            affectedRows.forEach(function (r, idx) {
              r.should.equal(idx % 2 === 0 ? 1 : 0);
            });
            statement.drop();
            cb();
          });
        },
        function verify(cb) {
          client.exec('select count(*) as CNT from NUMBERS where A >= 7000 and A < 7010', function (err, result) {
            if (err) return cb(err);
            result[0].CNT.should.equal(5);
            cb();
          });
        },
        function cleanup(cb) {
          client.exec('delete from NUMBERS where A >= 7000', cb);
        }
      ], done);
    });
  });

  describe('BulkInsert large-string packet-splitting tests', function () {
    const TABLE = 'BULK_LARGE';
    const LONG_STR = 'a'.repeat(5000);

    function makeRows(n) {
      const rows = [];
      for (let i = 0; i < n; i++) {
        rows.push([i + 1, LONG_STR]);
      }
      return rows;
    }

    beforeEach(function (done) {
      client.exec('drop table ' + TABLE + ' cascade', function () {
        client.exec('create column table ' + TABLE + ' (A INT, B NVARCHAR(5000))', done);
      });
    });

    afterEach(function (done) {
      client.exec('drop table ' + TABLE + ' cascade', done);
    });

    [10, 1000].forEach(function (n) {
      it('should bulk insert ' + n + ' rows with 5000-char strings and verify row count and total length', function (done) {
        this.timeout(10000);
        const rows = makeRows(n);
        async.waterfall([
          function prepare(cb) {
            client.prepare('insert into ' + TABLE + ' values (?, ?)', cb);
          },
          function insert(statement, cb) {
            statement.exec(rows, function (err, affectedRows) {
              if (err) return cb(err);
              affectedRows.should.have.length(n);
              affectedRows.forEach(function (r) { r.should.equal(1); });
              statement.drop();
              cb();
            });
          },
          function verify(cb) {
            client.exec(
              'select count(*) as CNT, sum(length(B)) as TOTAL_LEN from ' + TABLE,
              function (err, result) {
                if (err) return cb(err);
                result[0].CNT.should.equal(n);
                result[0].TOTAL_LEN.should.equal(5000 * n);
                cb();
              }
            );
          }
        ], done);
      });
    });

    [10, 1000].forEach(function (n) {
      it('should fail bulk insert of ' + n + ' rows when the last row has an invalid type', function (done) {
        this.timeout(10000);
        const rows = makeRows(n);
        rows[rows.length - 1] = [Buffer.from('not-an-int'), LONG_STR];

        async.waterfall([
          function prepare(cb) {
            client.prepare('insert into ' + TABLE + ' values (?, ?)', cb);
          },
          function insert(statement, cb) {
            statement.exec(rows, function (err) {
              // expect an error due to bad parameter type
              err.should.be.instanceof(Error);
              statement.drop();
              cb();
            });
          },
          function verify(cb) {
            client.exec('select count(*) as CNT from ' + TABLE, function (err, result) {
              if (err) return cb(err);
              // even if the driver broke the execute into multiple packets,
              // the whole batch should be rolled back, so no rows actually inserted
              result[0].CNT.should.equal(0);
              cb();
            });
          }
        ], done);
      });
    });
  });

  describe('BulkInsert oversized-row packet-size tests', function () {
    const TABLE = 'BULK_EURO';
    // Euro sign (U+20AC) is 3 bytes in UTF-8, so 5000 euros = 15000 bytes per column.
    // 5 such columns per row => ~75000 bytes/row, which straddles the 64K and 128K limits.
    const EURO_STR = '€'.repeat(5000);

    before(function (done) {
      client.exec('drop table ' + TABLE + ' cascade', function () {
        client.exec(
          'create column table ' + TABLE +
          ' (A INT, B NVARCHAR(5000), C NVARCHAR(5000), D NVARCHAR(5000), E NVARCHAR(5000), F NVARCHAR(5000))',
          done
        );
      });
    });

    after(function (done) {
      client.exec('drop table ' + TABLE + ' cascade', done);
    });

    beforeEach(function (done) {
      client.exec('delete from ' + TABLE, done);
    });

    [
      { packetSize: 65536,  label: '64K',  shouldFail: true  },
      { packetSize: 131072, label: '128K', shouldFail: false },
      { packetSize: 500000, label: '500K', shouldFail: false }
    ].forEach(function (cfg) {
      it('should ' + (cfg.shouldFail ? 'fail' : 'succeed with') +
         ' bulk insert of 2 wide rows using ' + cfg.label + ' packet size', function (done) {
        this.timeout(10000);
        const rows = [
          [1, EURO_STR, EURO_STR, EURO_STR, EURO_STR, EURO_STR],
          [2, EURO_STR, EURO_STR, EURO_STR, EURO_STR, EURO_STR]
        ];
        const testClient = hdb.createClient(getOptions({ packetSize: cfg.packetSize }));

        async.waterfall([
          function connect(cb) {
            testClient.connect(cb);
          },
          function prepare(cb) {
            testClient.prepare('insert into ' + TABLE + ' values (?, ?, ?, ?, ?, ?)', cb);
          },
          function insert(statement, cb) {
            statement.exec(rows, function (err, affectedRows) {
              statement.drop();
              if (cfg.shouldFail) {
                err.should.be.instanceof(Error);
                return cb();
              }
              if (err) return cb(err);
              affectedRows.should.have.length(2);
              affectedRows.forEach(function (r) { r.should.equal(1); });
              cb();
            });
          },
          function verify(cb) {
            testClient.exec('select count(*) as CNT from ' + TABLE, function (err, result) {
              if (err) return cb(err);
              result[0].CNT.should.equal(cfg.shouldFail ? 0 : 2);
              cb();
            });
          }
        ], function (err) {
          testClient.disconnect(function () {
            testClient.end();
            done(err);
          });
        });
      });
    });
  });
});
