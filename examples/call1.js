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

var util = require('util');
var async = require('async');
var client = require('./client');

async.waterfall([connect, setSchema, init, prepare, callProc], done);

function connect(cb) {
  client.connect(cb);
}

function setSchema(cb) {
  var schema = client.get('user');
  var sql = util.format('set schema %s', schema);
  client.exec(sql, cb);
}

function init(cb) {
  var sql = 'drop procedure PROC_DUMMY';
  client.exec(sql, function onexec() {
    // ignore error
    var sql = [
      'create procedure PROC_DUMMY (in a int, in b int, out c int, out d DUMMY)',
      'language sqlscript',
      'reads sql data as',
      'begin',
      '  c := :a + :b;',
      '  d = select * from DUMMY;',
      'end;'
    ].join('\n');
    client.exec(sql, cb);
  });
}

function prepare(cb) {
  var sql = 'call PROC_DUMMY (?, ?, ?, ?)';
  client.prepare(sql, cb);
}

function callProc(statement, cb) {
  var values = {
    A: 3,
    B: 4
  };
  statement.exec(values, function onexec(err, parameters, rows) {
    statement.drop();
    cb(err, parameters, rows);
  });
}

function done(err, parameters, rows) {
  client.end();
  if (err) {
    return console.error('error', err);
  }
  console.log('Parameters:', util.inspect(parameters, {
    depth: 4,
    colors: true
  }));
  console.log('Rows:', util.inspect(rows, {
    depth: 4,
    colors: true
  }));
}