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

var fields = [
  'PACKAGE_ID as PATH',
  'OBJECT_NAME as NAME',
  'OBJECT_SUFFIX as SUFFIX',
  'CDATA',
  'BDATA'
];
var tpl = 'select %s from _SYS_REPO.ACTIVE_OBJECT ' +
  'where PACKAGE_ID %s ? order by PACKAGE_ID';
var packageId = process.argv[2] || 'sap.hana.xs.ui.*';
var operator = 'like';
if (packageId.indexOf('*') === -1) {
  operator = '=';
} else {
  operator = 'like';
  packageId = packageId.replace(/\*/g, '%');
}
var sql = util.format(tpl, fields.join(','), operator);
var dirname = path.join(os.tmpdir(), '_SYS_REPO');

async.waterfall([prepare, execute, copyRepo], done);

function prepare(cb) {
  client.prepare(sql, cb);
}

function execute(statement, cb) {
  console.time('time');
  statement.exec([packageId], false, cb);
}

function copyRepo(rs, cb) {

  function done(err) {
    /* jshint validthis:true */
    this.removeListener('error', done);
    this.removeListener('end', done);
    cb(err);
  }

  function createEntry(row) {
    var entry = (row.BDATA || row.CDATA).createReadStream();
    var path = row.PATH.replace(/\./g, '/');
    var filename = row.NAME;
    if (row.SUFFIX) {
      filename += '.' + row.SUFFIX;
    }
    var props = entry.props = {
      type: 'File',
      path: path + '/' + filename
    };
    entry.path = props.path;
    entry.type = props.type;
    return entry;
  }
  rs.createObjectStream()
    .pipe(new stream.Reader(createEntry))
    .pipe(new fstream.Writer({
      path: dirname,
      type: 'Directory'
    }))
    .once('error', done)
    .once('end', done);
}

function done(err) {
  console.timeEnd('time');
  if (err) {
    console.error('Error', err);
  } else {
    console.log('Copied package %s to dir %s"', packageId, dirname);
  }
  client.end();
}