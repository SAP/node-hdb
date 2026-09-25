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
const path = require('path');
const async = require('async');
const client = require('./client');

const home = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
const dirname = process.argv[2] || path.join(home, 'tmp', 'lobs');
const schema = client.get('user');

async.waterfall([connect, init, prepare, copyDir], done);

function connect(cb) {
  client.connect(cb);
}

function dropTable(cb) {
  const sql = 'drop table TEST_LOBS';
  client.exec(sql, cb);
}

function init(cb) {
  dropTable(function droped(_err) {
    createTable(cb);
  });
}

function createTable(cb) {
  const sql = [
    'create column table TEST_LOBS (',
    '"NAME"    NVARCHAR(256) NOT NULL,',
    // ST_MEMORY_LOB is not supported in SAP HANA Cloud; use MEMORY THRESHOLD NULL instead.
    // See: https://help.sap.com/docs/HANA_CLOUD/3c53bc7b58934a9795b6dd8c7e28cf05/60849217c54d4e87918caef4a29cae4d.html
    '"DATA"    BLOB MEMORY THRESHOLD NULL,',
    'PRIMARY KEY ("NAME"))'
  ].join('\n');
  client.exec(sql, cb);
}

function prepare(cb) {
  const sql = 'insert into TEST_LOBS values (?, ?)';
  client.prepare(sql, cb);
}

function copyDir(statement, cb) {
  console.time('time');

  let entries;
  try {
    entries = fs.readdirSync(dirname, { withFileTypes: true })
      .filter(d => d.isFile())
      .map(d => d.name);
  } catch (err) {
    return cb(err);
  }

  function insertFile(name, next) {
    const filePath = path.join(dirname, name);
    const readStream = fs.createReadStream(filePath);
    statement.exec([name, readStream], next);
  }

  async.eachSeries(entries, insertFile, cb);
}

function done(err) {
  console.timeEnd('time');
  if (err) {
    console.error('Error', err);
  } else {
    console.log('Copied dir %s to table "%s"."TEST_LOBS"', dirname, schema);
  }
  client.end();
}
