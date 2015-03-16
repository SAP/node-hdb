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

var async = require('async');
var client = require('./client');

async.waterfall([
  connect,
  createTableType,
  createLocalTemporaryTable,
  createProcedure,
  prepare,
  callProcedure
], done);

function connect(cb) {
  client.connect(cb);
}

function createTableType(cb) {
  dropAndCreate({
    drop: 'drop type tt1',
    create: 'create type tt1 as table (i INT)'
  }, cb);
}

function createLocalTemporaryTable(cb) {
  dropAndCreate({
    drop: 'drop table #local_test_table_1',
    create: 'create local temporary table #local_test_table_1 (i INT)'
  }, cb);
}

function createProcedure(cb) {
  dropAndCreate({
    drop: 'drop procedure PROC_TEST',
    create: [
      'create procedure PROC_TEST (in in1 tt1, out out1 tt1)',
      'language sqlscript',
      'reads sql data as',
      'begin',
      '  out1 = select (i*i) as i from :in1;',
      'end;'
    ].join('\n')
  }, cb);
}

function prepare(cb) {
  var sql = 'call PROC_TEST(#local_test_table_1, ?)';
  client.prepare(sql, cb);
}

function updateLocalTemporaryTable(values, cb) {
  function truncate(cb) {
    var sql = 'truncate table #local_test_table_1';
    client.exec(sql, function (err) {
      cb(err);
    });
  }

  function prepare(cb) {
    var sql = 'insert into #local_test_table_1 values(?)';
    client.prepare(sql, cb);
  }

  function insertValues(statement, cb) {
    function createTasks(value) {
      return statement.exec.bind(statement, [value]);
    }

    async.series(values.map(createTasks), function () {
      // ignore error
      statement.drop(cb);
    });
  }
  async.waterfall([truncate, prepare, insertValues], cb);
}

function callProcedure(statement, cb) {
  var values = [1, 2, 3, 4, 5];
  updateLocalTemporaryTable(values, function (err) {
    if (err) {
      return cb(err);
    }
    statement.exec([], function (err, parameters, rows) {
      cb(err, parameters, rows);
    });
  });
}

function done(err, parameters, rows) {
  client.end();
  if (err) {
    return console.error('error', err);
  }
  console.log(rows);
}

function dropAndCreate(options, cb) {
  client.exec(options.drop, function onexec() {
    // ignore error
    client.exec(options.create, cb);
  });
}