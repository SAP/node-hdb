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

async.waterfall([connect, init, prepare, callProc], done);

function connect(cb) {
  client.connect(cb);
}

function init(cb) {
  var sql = 'drop procedure PROC_READ_OBJECT';
  client.exec(sql, function onexec() {
    // ignore error
    var sql = [
      'CREATE PROCEDURE PROC_READ_OBJECT (',
      '  in name nvarchar(255),',
      '  out data blob)',
      'LANGUAGE SQLSCRIPT AS',
      'CURSOR c_cursor (name nvarchar(255)) FOR',
      '   SELECT DATA FROM TEST_LOBS WHERE name = :name;',
      'BEGIN',
      '  OPEN c_cursor(:name);',
      '  FETCH c_cursor INTO data;',
      '  CLOSE c_cursor;',
      'END;'
    ].join('\n');
    client.exec(sql, cb);
  });
}

function prepare(cb) {
  var sql = 'call PROC_READ_OBJECT(?, ?)';
  client.prepare(sql, cb);
}

function callProc(statement, cb) {
  var values = {
    NAME: 'hello.txt'
  };
  statement.exec(values, function onexec(err, parameters) {
    statement.drop();
    cb(err, parameters);
  });
}

function done(err, parameters) {
  client.end();
  if (err) {
    return console.error('error', err);
  }
  console.log(parameters.DATA);
}