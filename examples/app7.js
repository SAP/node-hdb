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

var fs = require('fs');
var os = require('os');
var path = require('path');
var async = require('async');
var client = require('./client');
var schema = client.get('user');
var tmpdir = os.tmpdir();
var dirname = path.join(__dirname, '..', 'test', 'fixtures', 'img');

async.waterfall([connect, init, prepare, insert, select, fetch, write], done);

function connect(cb) {
  client.connect(cb);
}

function dropTable(cb) {
  var sql = 'drop table TEST_BLOBS';
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
    'create column table TEST_BLOBS (',
    '"ID"     INT NOT NULL,',
    '"NAME"   NVARCHAR(256) NOT NULL,',
    '"IMG"  BLOB ST_MEMORY_LOB,',
    '"LOGO"  BLOB ST_MEMORY_LOB,',
    '"DESCR"  NCLOB ST_MEMORY_LOB,',
    'PRIMARY KEY ("ID"))'
  ].join('\n');
  client.exec(sql, cb);
}

function prepare(cb) {
  var sql = 'insert into TEST_BLOBS values (?, ?, ?, ?, ?)';
  client.prepare(sql, cb);
}

function insert(statement, cb) {
  console.time('time');
  var params = [
    [
      1, 'SAP AG',
      fs.createReadStream(path.join(dirname, 'sap.jpg')),
      fs.createReadStream(path.join(dirname, 'logo.png')),
      new Buffer('SAP headquarters located in Walldorf, Germany', 'ascii')
    ],
    [
      2, 'SAP lobby',
      fs.createReadStream(path.join(dirname, 'lobby.jpg')),
      fs.createReadStream(path.join(dirname, 'locked.png')),
      new Buffer('SAP lobby in Walldorf, Germany', 'ascii')
    ]
  ];

  statement.exec(params, function statementExecuted(err, rowsAffected) {
    /* jshint unused:false */
    console.timeEnd('time');
    if (err) {
      return cb(err);
    }
    console.log(
      'Copied SAP images from %s to table "%s"."TEST_BLOBS"',
      dirname, schema);
    cb(null);
  });
}

function select(cb) {
  var sql = 'select * from TEST_BLOBS where ID = 1';
  client.execute(sql, cb);
}

function fetch(rs, cb) {
  var rows = [];

  function done(err) {
    /* jshint validthis:true */
    this.removeAllListeners();
    cb(err, rows[0]);
  }

  function read() {
    /* jshint validthis:true */
    var row = this.read();
    if (row) {
      rows.push(row);
    }
  }
  rs.createObjectStream()
    .once('error', done)
    .on('readable', read)
    .once('end', done);
}

function write(row, cb) {
  async.series([
    writeFile.bind(row.IMG, 'sap.jpg'),
    writeFile.bind(row.LOGO, 'logo.png'),
    writeFile.bind(row.DESCR, 'sap-description.txt'),
  ], cb);
}

function writeFile(filename, cb) {
  /* jshint validthis:true */
  var readStream = this.createReadStream();
  var writeStream = fs.createWriteStream(path.join(tmpdir, filename));

  function done(err) {
    readStream.removeListener('error', done);
    writeStream.removeListener('error', done);
    writeStream.removeListener('finish', onfinish);
    cb(err);
    console.log(filename);
  }

  function onfinish() {
    done();
  }
  readStream
    .once('error', done)
    .pipe(writeStream)
    .once('error', done)
    .once('finish', onfinish);
}

function done(err) {
  if (err) {
    console.error('Error', err);
  } else {
    console.log(
      'Copied SAP images from table "%s"."TEST_BLOBS to "',
      schema, tmpdir);
  }
  client.end();
}