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

async.series([connect, init, insert, select], done);

function connect(cb) {
  client.connect(cb);
}


function init(cb) {
  async.series([
    function (done) {
      client.exec([
        'create local temporary column table #x (',
        'id int not null,',
        'name nvarchar(256) not null)',
      ].join('\n'), done);
    },
    function (done) {
      client.exec([
        'create local temporary column table #y (',
        'id int not null,',
        'name nvarchar(256) not null)',
      ].join('\n'), done);
    }
  ], cb);
}

function insert(cb) {
  var statement;
  async.series([
    function (done) {
      client.prepare('insert into #x values (?,?)', function (err, stmnt) {
        statement = stmnt;
        done(err);
      });
    },
    function (done) {
      statement.exec([
        [1, 'A'],
        [2, 'B'],
        [3, 'C']
      ], done);
    },
    function (done) {
      statement.drop(function (err) {
        statement = undefined;
        done(err);
      });
    },
    function (done) {
      client.prepare('insert into #y values (?,?)', function (err, stmnt) {
        statement = stmnt;
        done(err);
      });
    },
    function (done) {
      statement.exec([
        [1, 'a'],
        [2, 'b'],
        [3, 'c']
      ], done);
    },
    function (done) {
      statement.drop(function (err) {
        statement = undefined;
        done(err);
      });
    },
  ], cb);
}

function select(cb) {
  var sql = 'select * from #x join #y on #x.id = #y.id';
  client.exec(sql, {
    rowsAsArray: true
  }, function (err, rows) {
    if (err) {
      return cb(err);
    }
    console.log(util.inspect(rows, {
      colors: true,
      depth: 9
    }));
    cb();
  });
}

function done() {
  client.end();
}