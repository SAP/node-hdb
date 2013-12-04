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
  var sql = 'drop procedure PROC_READ_OBJECT';
  client.exec(sql, function onexec() {
    // ignore error
    var sql = [
      'CREATE PROCEDURE PROC_READ_OBJECT (',
      '  in package_id nvarchar(255),',
      '  in object_name nvarchar(255),',
      '  in object_suffix nvarchar(255),',
      '  out cdata nclob, out bdata blob)',
      'LANGUAGE SQLSCRIPT AS',
      'CURSOR c_cursor (a nvarchar(255), b nvarchar(255), c nvarchar(255)) FOR',
      '   SELECT CDATA, BDATA FROM _SYS_REPO.ACTIVE_OBJECT',
      '   WHERE package_id = :a and object_name = :b and object_suffix = :c;',
      'BEGIN',
      '  OPEN c_cursor(:package_id, :object_name, :object_suffix);',
      '  FETCH c_cursor INTO cdata, bdata;',
      '  CLOSE c_cursor;',
      'END;'
    ].join('\n');
    client.exec(sql, cb);
  });
}

function prepare(cb) {
  var sql = 'call PROC_READ_OBJECT(?, ?, ?, ?, ?)';
  client.prepare(sql, cb);
}

function callProc(statement, cb) {
  var values = {
    PACKAGE_ID: 'sap.ui5.1.resources',
    OBJECT_NAME: 'jquery-1.7.1',
    OBJECT_SUFFIX: 'js'
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
  console.log(parameters.CDATA.toString('utf8'));
}