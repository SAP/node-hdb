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
const RemoteDB = require('../db/RemoteDB');
const getOptions = require('../db').getOptions;

const describeRemoteDB = db instanceof RemoteDB ? describe : describe.skip;

describeRemoteDB('db', function () {
  before(db.init.bind(db));
  after(db.end.bind(db));
  const client = db.client;

  describe('Transaction Integration Tests', function () {
    before(db.createNumbers.bind(db));
    after(db.dropNumbers.bind(db));

    afterEach(function (done) {
      // restore auto-commit after each test to avoid leaking state
      client.setAutoCommit(true);
      done();
    });

    it('should commit multiple inserts as a transaction', function (done) {
      async.series([
        function disableAutoCommit(cb) {
          client.setAutoCommit(false);
          cb();
        },
        function insertFirst(cb) {
          client.exec("insert into NUMBERS values (200, 'two-hundred')", function (err, affectedRows) {
            if (err) return cb(err);
            affectedRows.should.equal(1);
            cb();
          });
        },
        function insertSecond(cb) {
          client.exec("insert into NUMBERS values (201, 'two-hundred-one')", function (err, affectedRows) {
            if (err) return cb(err);
            affectedRows.should.equal(1);
            cb();
          });
        },
        function commit(cb) {
          client.commit(cb);
        },
        function rollback(cb) {
          client.rollback(cb); // should be no-op after commit
        },
        function enableAutoCommit(cb) {
          client.setAutoCommit(true);
          cb();
        },
        function verify(cb) {
          client.exec("select * from NUMBERS where A >= 200 order by A", function (err, rows) {
            if (err) return cb(err);
            rows.should.have.length(2);
            rows[0].A.should.equal(200);
            rows[0].B.should.equal('two-hundred');
            rows[1].A.should.equal(201);
            rows[1].B.should.equal('two-hundred-one');
            cb();
          });
        },
        function cleanup(cb) {
          client.exec("delete from NUMBERS where A >= 200", cb);
        }
      ], done);
    });

    it('should rollback inserts and discard changes', function (done) {
      async.series([
        function disableAutoCommit(cb) {
          client.setAutoCommit(false);
          cb();
        },
        function insertFirst(cb) {
          client.exec("insert into NUMBERS values (300, 'three-hundred')", function (err, affectedRows) {
            if (err) return cb(err);
            affectedRows.should.equal(1);
            cb();
          });
        },
        function rollback(cb) {
          client.rollback(cb);
        },
        function enableAutoCommit(cb) {
          client.setAutoCommit(true);
          cb();
        },
        function verify(cb) {
          client.exec("select * from NUMBERS where A = 300", function (err, rows) {
            if (err) return cb(err);
            rows.should.have.length(0);
            cb();
          });
        }
      ], done);
    });

    it('should rollback on explicit rollback after multiple inserts', function (done) {
      async.series([
        function disableAutoCommit(cb) {
          client.setAutoCommit(false);
          cb();
        },
        function insertSeveral(cb) {
          async.series([
            client.exec.bind(client, "insert into NUMBERS values (400, 'four-hundred')"),
            client.exec.bind(client, "insert into NUMBERS values (401, 'four-hundred-one')"),
            client.exec.bind(client, "insert into NUMBERS values (402, 'four-hundred-two')")
          ], cb);
        },
        function rollback(cb) {
          client.rollback(cb);
        },
        function enableAutoCommit(cb) {
          client.setAutoCommit(true);
          cb();
        },
        function verify(cb) {
          client.exec("select count(*) as CNT from NUMBERS where A >= 400", function (err, rows) {
            if (err) return cb(err);
            rows[0].CNT.should.equal(0);
            cb();
          });
        }
      ], done);
    });

    it('should rollback an update and preserve original data', function (done) {
      async.series([
        function disableAutoCommit(cb) {
          client.setAutoCommit(false);
          cb();
        },
        function updateRow(cb) {
          client.exec("update NUMBERS set B = 'MODIFIED' where A = 1", function (err, affectedRows) {
            if (err) return cb(err);
            affectedRows.should.equal(1);
            cb();
          });
        },
        function rollback(cb) {
          client.rollback(cb);
        },
        function enableAutoCommit(cb) {
          client.setAutoCommit(true);
          cb();
        },
        function verify(cb) {
          client.exec("select B from NUMBERS where A = 1", function (err, rows) {
            if (err) return cb(err);
            rows.should.have.length(1);
            rows[0].B.should.equal('one');
            cb();
          });
        }
      ], done);
    });
  });

  describe('Transaction isolation (second connection) Integration Tests', function () {
    const client2 = hdb.createClient(getOptions());

    before(function (done) {
      client2.connect(done);
    });

    after(function (done) {
      client2.disconnect(function (err) {
        client2.end();
        setTimeout(done.bind(null, err), 1);
      });
    });

    before(db.createNumbers.bind(db));
    after(db.dropNumbers.bind(db));

    afterEach(function (done) {
      client.setAutoCommit(true);
      done();
    });

    it('should not see uncommitted inserts from another connection', function (done) {
      async.series([
        // connection 1: insert without committing
        function disableAutoCommit(cb) {
          client.setAutoCommit(false);
          cb();
        },
        function insert(cb) {
          client.exec("insert into NUMBERS values (800, 'eight-hundred')", function (err, affectedRows) {
            if (err) return cb(err);
            affectedRows.should.equal(1);
            cb();
          });
        },
        // connection 2: must not see the uncommitted row
        function observerCannotSeeRow(cb) {
          client2.exec("select * from NUMBERS where A = 800", function (err, rows) {
            if (err) return cb(err);
            rows.should.have.length(0);
            cb();
          });
        },
        // connection 1: now commit
        function commit(cb) {
          client.commit(cb);
        },
        function enableAutoCommit(cb) {
          client.setAutoCommit(true);
          cb();
        },
        // connection 2: row is now visible after commit
        function observerSeesRowAfterCommit(cb) {
          client2.exec("select * from NUMBERS where A = 800", function (err, rows) {
            if (err) return cb(err);
            rows.should.have.length(1);
            rows[0].B.should.equal('eight-hundred');
            cb();
          });
        },
        function cleanup(cb) {
          client.exec("delete from NUMBERS where A = 800", cb);
        }
      ], done);
    });

    it('should see autocommit inserts immediately from another connection', function (done) {
      async.series([
        // connection 1: insert with autocommit (default)
        function insert(cb) {
          client.exec("insert into NUMBERS values (900, 'nine-hundred')", function (err, affectedRows) {
            if (err) return cb(err);
            affectedRows.should.equal(1);
            cb();
          });
        },
        // connection 2: row is immediately visible — no explicit commit needed
        function observerSeesRow(cb) {
          client2.exec("select * from NUMBERS where A = 900", function (err, rows) {
            if (err) return cb(err);
            rows.should.have.length(1);
            rows[0].B.should.equal('nine-hundred');
            cb();
          });
        },
        function cleanup(cb) {
          client.exec("delete from NUMBERS where A = 900", cb);
        }
      ], done);
    });
  });
});
