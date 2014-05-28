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

var util = require('../lib/util');
var async = require('async');
var client = require('./client');

async.waterfall([connect, init, prepare, insert, select], done);

function connect(cb) {
  client.connect(cb);
}

function dropTable(cb) {
  var sql = 'drop table TEST_BATCH';
  client.exec(sql, cb);
}

function init(cb) {
  dropTable(function droped(err) {
    /* jshint unused:false */
    // ignore error
    createTable(cb);
  });
}

function createTable(cb) {
  var sql = [
    'create column table TEST_BATCH (',
    '"ID"     INT NOT NULL,',
    '"NAME"   NVARCHAR(256) NOT NULL,',
    '"CONTENT"  NCLOB ST_MEMORY_LOB,',
    'PRIMARY KEY ("ID"))'
  ].join('\n');
  client.exec(sql, cb);
}

function prepare(cb) {
  var sql = 'insert into TEST_BATCH values (?, ?, ?)';
  client.prepare(sql, cb);
}

function insert(statement, cb) {
  var values = [
    [1, 'lorem', 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit.'],
    [2, 'aliquam', 'Aliquam tincidunt mauris eu risus.'],
    [3, 'vestibulum', 'Vestibulum auctor dapibus neque.'],
    [4, 'pellentesque',
      'Pellentesque habitant morbi tristique senectus et netus et malesuada ' +
      'fames ac turpis egestas. Vestibulum tortor quam, feugiat vitae, ' +
      'ultricies eget, tempor sit amet, ante. Donec eu libero sit amet quam ' +
      'egestas semper. Aenean ultricies mi vitae est. Mauris placerat ' +
      'eleifend leo. Quisque sit amet est et sapien ullamcorper pharetra. ' +
      'Vestibulum erat wisi, condimentum sed, commodo vitae, ornare sit amet, ' +
      'wisi. Aenean fermentum, elit eget tincidunt condimentum, eros ipsum ' +
      'rutrum orci, sagittis tempus lacus enim ac dui. Donec non enim in ' +
      'turpis pulvinar facilisis. Ut felis. Praesent dapibus, neque id ' +
      'cursus faucibus, tortor neque egestas augue, eu vulputate magna eros ' +
      'eu erat. Aliquam erat volutpat. Nam dui mi, tincidunt quis, accumsan ' +
      'porttitor, facilisis luctus, metus.'
    ],
    [5, 'morbi',
      'Morbi in sem quis dui placerat ornare. Pellentesque odio nisi, ' +
      'euismod in, pharetra a, ultricies in, diam. Sed arcu. Cras consequat.'
    ],
    [6, 'praesent',
      'Praesent dapibus, neque id cursus faucibus, tortor neque egestas ' +
      'augue, eu vulputate magna eros eu erat. Aliquam erat volutpat. ' +
      'Nam dui mi, tincidunt quis, accumsan porttitor, facilisis luctus, metus.'
    ],
    [7, 'consectetur',
      'Consectetur adipisicing elit, sed do eiusmod tempor incididunt ut ' +
      'labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud ' +
      'exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'
    ]
  ];
  console.time('time');
  statement.exec(values, function statementExecuted(err, rowsAffected) {
    /* jshint unused:false */
    console.timeEnd('time');
    cb(err);
  });
}

function select(cb) {
  var sql = 'select * from TEST_BATCH';
  client.exec(sql, cb);
}

function done(err, rows) {
  client.end();
  if (err) {
    return console.error(err);
  }
  console.log(util.inspect(rows.map(mapRow), {
    colors: true,
    depth: 9
  }));
}

function mapRow(row) {
  row.CONTENT = row.CONTENT.toString('ascii');
  return row;
}