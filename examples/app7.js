#!/usr/bin/env node

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

const fs = require('fs');
const os = require('os');
const path = require('path');
const async = require('async');
const client = require('./client');
const schema = client.get('user');
const tmpdir = os.tmpdir();
const dirname = path.join(__dirname, '..', 'test', 'fixtures', 'img');

async.waterfall([connect, init, prepare, insert, select, fetch, write], done);

function connect(cb) {
  client.connect(cb);
}

function dropTable(cb) {
  const sql = 'drop table TEST_BLOBS';
  client.exec(sql, cb);
}

function init(cb) {
  dropTable(function droped(_err) {
    createTable(cb);
  });
}

function createTable(cb) {
  const sql = [
    'create column table TEST_BLOBS (',
    '"ID"     INT NOT NULL,',
    '"NAME"   NVARCHAR(256) NOT NULL,',
    // ST_MEMORY_LOB is not supported in SAP HANA Cloud; use MEMORY THRESHOLD NULL instead.
    // See: https://help.sap.com/docs/hana-cloud/sap-hana-cloud-migration-guide/memory-and-disk-lob-type
    '"IMG"    BLOB MEMORY THRESHOLD NULL,',
    '"LOGO"   BLOB MEMORY THRESHOLD NULL,',
    '"DESCR"  NCLOB MEMORY THRESHOLD NULL,',
    'PRIMARY KEY ("ID"))'
  ].join('\n');
  client.exec(sql, cb);
}

function prepare(cb) {
  const sql = 'insert into TEST_BLOBS values (?, ?, ?, ?, ?)';
  client.prepare(sql, cb);
}

function insert(statement, cb) {
  console.time('time');
  const params = [
    [
      1, 'SAP AG',
      fs.createReadStream(path.join(dirname, 'sap.jpg')),
      fs.createReadStream(path.join(dirname, 'logo.png')),
      Buffer.from('SAP headquarters located in Walldorf, Germany', 'ascii')
    ],
    [
      2, 'SAP lobby',
      fs.createReadStream(path.join(dirname, 'lobby.jpg')),
      fs.createReadStream(path.join(dirname, 'locked.png')),
      Buffer.from('SAP lobby in Walldorf, Germany', 'ascii')
    ]
  ];

  statement.exec(params, function statementExecuted(err, _rowsAffected) {
    console.timeEnd('time');
    if (err) {
      return cb(err);
    }
    console.log(
      'Copied SAP images from %s to table "%s"."TEST_BLOBS"',
      dirname, schema);
    cb(null);
  });
}

function select(cb) {
  const sql = 'select * from TEST_BLOBS where ID = 1';
  client.execute(sql, cb);
}

function fetch(rs, cb) {
  const rows = [];

  function done(err) {
    /* jshint validthis:true */
    this.removeAllListeners();
    cb(err, rows[0]);
  }

  function read() {
    /* jshint validthis:true */
    const row = this.read();
    if (row) {
      rows.push(row);
    }
  }
  rs.createObjectStream()
    .once('error', done)
    .on('readable', read)
    .once('end', done);
}

function write(row, cb) {
  async.series([
    writeFile.bind(row.IMG, 'sap.jpg'),
    writeFile.bind(row.LOGO, 'logo.png'),
    writeFile.bind(row.DESCR, 'sap-description.txt'),
  ], cb);
}

function writeFile(filename, cb) {
  /* jshint validthis:true */
  const readStream = this.createReadStream();
  const writeStream = fs.createWriteStream(path.join(tmpdir, filename));

  function done(err) {
    readStream.removeListener('error', done);
    writeStream.removeListener('error', done);
    writeStream.removeListener('finish', onfinish);
    cb(err);
    console.log(filename);
  }

  function onfinish() {
    done();
  }
  readStream
    .once('error', done)
    .pipe(writeStream)
    .once('error', done)
    .once('finish', onfinish);
}

function done(err) {
  if (err) {
    console.error('Error', err);
  } else {
    console.log(
      'Copied SAP images from table "%s"."TEST_BLOBS" to "%s"',
      schema, tmpdir);
  }
  client.end();
}
