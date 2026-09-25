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

const util = require('util');
const async = require('async');
const client = require('./client');

async.waterfall([connect, init, prepare, insert, update, select], done);

function connect(cb) {
  client.setAutoCommit(false);
  client.connect(cb);
}

function dropTable(cb) {
  const sql = 'drop table PERSONS cascade';
  client.exec(sql, cb);
}

function init(cb) {
  dropTable(function droped(_err) {
    createTable(cb);
  });
}

function createTable(cb) {
  const sql = [
    'create column table PERSONS (',
    '"ID" INTEGER NOT NULL,',
    '"LAST_NAME" NVARCHAR(256),',
    '"FIRST_NAME" NVARCHAR(256),',
    'PRIMARY KEY ("ID"))'
  ].join('\n');
  client.exec(sql, cb);
}

function prepare(cb) {
  const sql = 'insert into PERSONS values(?, ?, ?)';
  client.prepare(sql, cb);
}

function insert(statement, cb) {
  const rows = [
    [1, 'Ferdinand', 'Fuchs'],
    [2, 'Waldemar', 'Wild'],
    [3, 'Maximilian', 'Maier']
  ];

  function createTask(params) {
    return statement.exec.bind(statement, params);
  }
  const tasks = rows.map(createTask);

  function done(err) {
    if (err) {
      client.rollback(cb);
    } else {
      client.commit(cb);
    }
  }
  async.series(tasks, done);
}

function select(cb) {
  const sql = 'select * from PERSONS';
  client.exec(sql, cb);
}

function update(cb) {
  function done(_err) {
    client.rollback(cb);
  }
  const sql = 'update PERSONS set first_name = \'Max\' where id = 3';
  client.exec(sql, done);
}

function done(err, rows) {
  client.end();
  if (err) {
    return console.error(err);
  }
  console.log(util.inspect(rows, {
    colors: true
  }));
}
