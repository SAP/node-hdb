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
var path = require('path');
var async = require('async');
var EventEmitter = require('events').EventEmitter;
var client = require('./client');
var fstream = require('fstream');
var concatStream = require('concat-stream');

var home = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
var dirname = process.argv[2] || path.join(home, 'tmp', 'lobs');
var schema = client.get('user');

async.waterfall([connect, init, prepare, copyDir], done);

function connect(cb) {
  client.connect(cb);
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
    '"NAME"    NVARCHAR(256) NOT NULL,',
    '"DATA"    BLOB ST_MEMORY_LOB,',
    'PRIMARY KEY ("NAME"))'
  ].join('\n');
  client.exec(sql, cb);
}

function prepare(cb) {
  var sql = 'insert into TEST_LOBS values (?, ?)';
  client.prepare(sql, cb);
}

function copyDir(statement, cb) {
  console.time('time');

  function isChildFile() {
    /* jshint validthis:true */
    return this.parent === r && this.type === 'File' || this === r;
  }
  var r = fstream.Reader({
    path: dirname,
    filter: isChildFile
  });

  function getParams(props, data) {
    return [props.basename, data];
  }
  var adapter = new FstreamAdapter(statement, getParams);

  function finish(err) {
    adapter.removeListener('error', finish);
    adapter.removeListener('close', finish);
    cb(err);
  }
  adapter.once('error', finish);
  adapter.once('close', finish);

  r.pipe(adapter);
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

util.inherits(FstreamAdapter, EventEmitter);

function FstreamAdapter(statement, createParams) {
  EventEmitter.call(this);
  this._end = false;
  this._busy = false;
  this._statement = statement;
  this._createParams = createParams;
}

FstreamAdapter.prototype.execStatement = function execStatement(entry, data) {
  var self = this;
  var params = this._createParams(entry.props, data);

  function handleResult(err) {
    self._busy = false;
    if (err) {
      return self.emit('error', err);
    }
    if (self._end) {
      return self.emit('close');
    }
    entry.resume();
  }
  this._statement.exec(params, handleResult);
};

FstreamAdapter.prototype.add = function add(entry) {
  var self = this;
  if (this._end) {
    return;
  }

  function handleData(data) {
    entry.pause();
    self._busy = true;
    self.execStatement(entry, data);
  }
  entry.pipe(concatStream(handleData));
  return true;
};

FstreamAdapter.prototype.end = function end() {
  this._end = true;
  this.emit('end');
  if (!this._busy) {
    this.emit('close');
  }
};