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

var util = require('util');
var os = require('os');
var path = require('path');
var async = require('async');
var client = require('./client');
var stream = require('./stream');
var fstream = require('fstream');

var packageId = process.argv[2] || 'sap.hana.xs.ui.images';
var dirname = path.join(os.tmpdir(), '_SYS_REPO', packageId.replace(/\./g, '/'));
var schema = client.get('user');

async.waterfall([setSchema, init, prepare, copyDir], done);

function setSchema(cb) {
  var sql = util.format('set schema %s', schema);
  client.exec(sql, cb);
}

function dropTable(cb) {
  var sql = 'drop table TEST_LOBS';
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
    'create column table TEST_LOBS (',
    '"PACKAGE" NVARCHAR(256) NOT NULL,',
    '"NAME"    NVARCHAR(256) NOT NULL,',
    '"DATA"    BLOB ST_MEMORY_LOB,',
    'PRIMARY KEY ("PACKAGE","NAME"))'
  ].join('\n');
  client.exec(sql, cb);
}

function prepare(cb) {
  var sql = 'insert into TEST_LOBS values (?, ?, ?)';
  client.prepare(sql, cb);
}

function copyDir(statement, cb) {
  console.time('time');

  function done(err) {
    this.removeListener('error', done);
    this.removeListener('close', done);
    cb(err);
  }

  function getParams(props, data) {
    return [packageId, props.basename, data];
  }

  function isChildFile() {
    /* jshint validthis:true */
    return this.parent === r && this.type === 'File' || this === r;
  }
  var r = fstream.Reader({
    path: dirname,
    filter: isChildFile
  })
  r.pipe(stream.Writer(statement, getParams))
    .once('error', done)
    .once('close', done);
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