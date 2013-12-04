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

async.waterfall([connect, init, prepare, callProc], done);

function connect(cb) {
  client.connect(cb);
}

function init(cb) {
  var sql = 'drop procedure PROC_ECHO';
  client.exec(sql, function onexec() {
    // ignore error
    var sql = [
      'create procedure PROC_ECHO (in input nclob, out output nclob)',
      'language sqlscript',
      'reads sql data as',
      'begin',
      '  output := :input;',
      'end;'
    ].join('\n');
    client.exec(sql, cb);
  });
}

function prepare(cb) {
  var sql = 'call PROC_ECHO (?, ?)';
  client.prepare(sql, cb);
}

function callProc(statement, cb) {
  var input = {
    foo: 'foo',
    bar: 'bar'
  };
  console.log('INPUT:', util.inspect(input, {
    depth: 4,
    colors: true
  }));
  var values = {
    INPUT: new Buffer(JSON.stringify(input), 'ascii')
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
  var output = JSON.parse(parameters.OUTPUT.toString('ascii'));
  console.log('OUTPUT:', util.inspect(output, {
    depth: 4,
    colors: true
  }));
}