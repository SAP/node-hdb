const assert = require('assert');
const crypto = require('crypto');
const db = require('../db')();

describe('db', function () {
  before(db.init.bind(db));
  after(db.end.bind(db));
  let client = db.client;
  db.client.set('compress', 1);
  db.client.set('packetSize', Math.pow(2, 30) - 1); // 1GB
  db.client.set('packetSizeLimit', Math.pow(2, 30) - 1); // 1GB

  const TABLE_NAME = 'TEST_COMPRESS_TABLE';

  function dropTable(cb) {
    client.exec(`DROP TABLE ${TABLE_NAME}`, function (err) {
      if (err && !/not found/i.test(err.message)) {
        return cb(err);
      }
      cb();
    });
  }

  function createTable(cb) {
    const createSql = `
    CREATE COLUMN TABLE ${TABLE_NAME} (
      DATA BLOB
    )
  `;
    client.exec(createSql, cb);
  }

  function generateData(type, sizeInBytes) {
    if (type === 'compressible') {
      return Buffer.from('A'.repeat(sizeInBytes));
    } else if (type === 'incompressible') {
      const raw = crypto.randomBytes(sizeInBytes);
      return raw;
    } else if (type === 'semi-compressible') {
      let repeated = Buffer.from('ABCD'.repeat(10000)); // 40KB
      let noisy = crypto.randomBytes(40000); // 40KB
      let buffer = Buffer.alloc(sizeInBytes);
      for (let i = 0; i < buffer.length; i += repeated.length + noisy.length) {
        repeated.copy(buffer, i);
        noisy.copy(buffer, i + repeated.length);
      }
      return buffer.slice(0, sizeInBytes);
    }
    throw new Error('Unknown data type');
  }

  function insertAndVerifyData(data, cb) {
    client.prepare(`INSERT INTO ${TABLE_NAME} (DATA) VALUES (?)`, function (err, stmt) {
      if (err) return cb(err);
      stmt.exec([data], function (err) {
        if (err) return cb(err);
        // Select and verify
        client.prepare(`SELECT DATA FROM ${TABLE_NAME}`, function (err, selectStmt) {
          if (err) return cb(err);
          selectStmt.exec([], function (err, rows) {
            if (err) return cb(err);
            assert.strictEqual(rows.length, 1, 'Expected one row');
            const expectedBuf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
            const actualBuf = Buffer.isBuffer(rows[0].DATA)
              ? rows[0].DATA
              : Buffer.from(rows[0].DATA, 'utf8');
            assert.ok(expectedBuf.equals(actualBuf), 'Roundtrip data mismatch');
            cb();
          });
        });
      });
    });
  }

  describe('Compression Integration Tests', function () {
    this.timeout(5 * 60 * 1000);

    beforeEach(function (done) {
      dropTable(() => {
        createTable(done);
      });
    });

    afterEach(function (done) {
      dropTable(done);
    });

    const dataTypes = ['compressible', 'incompressible', 'semi-compressible'];
    const sizes = [
      { label: '10KB', bytes: 10 * 1024 },
      { label: '1MB', bytes: 1024 * 1024 },
    ];

    dataTypes.forEach((type) => {
      sizes.forEach((size) => {
        const label = `${type} - ${size.label}`;
        it(`should insert and verify data (${label})`, function (done) {
          const data = generateData(type, size.bytes);
          insertAndVerifyData(data, done);
        });
      });
    });
  });
});
