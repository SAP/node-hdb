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
var os = require('os');
var path = require('path');
var async = require('async');
var Stream = require('stream').Stream;
var Writable = util.stream.Writable;
var fstream = require('fstream');
var client = require('./client');

var sql = 'select NAME, DATA from TEST_LOBS';
var dirname = path.join(os.tmpdir(), process.argv[2] || '.');

async.waterfall([connect, prepare, execute, copyRepo], done);

function connect(cb) {
  client.connect(cb);
}

function prepare(cb) {
  client.prepare(sql, cb);
}

function execute(statement, cb) {
  console.time('time');
  statement.execute([], cb);
}

function copyRepo(rs, cb) {

  function createEntry(row) {
    var entry = row.DATA.createReadStream();
    var props = entry.props = {
      type: 'File',
      path: row.NAME
    };
    entry.path = props.path;
    entry.type = props.type;
    return entry;
  }
  var adapter = new FstreamAdapter(createEntry);

  var w = new fstream.Writer({
    path: dirname,
    type: 'Directory'
  });

  function finish(err) {
    /* jshint validthis:true */
    w.removeListener('error', finish);
    w.removeListener('end', finish);
    cb(err);
  }
  w.once('error', finish);
  w.once('end', finish);

  rs.createObjectStream().pipe(adapter).pipe(w);
}

function done(err) {
  console.timeEnd('time');
  if (err) {
    console.error('Error', err);
  } else {
    console.log('Copied lobs to dir %s"', dirname);
  }
  client.end();
}

util.inherits(FstreamAdapter, Writable);

function FstreamAdapter(createEntry) {
  Writable.call(this, {
    objectMode: true,
    highWaterMark: 128
  });
  this._done = undefined;
  this._destination = undefined;
  this._createEntry = createEntry;
}

Object.defineProperty(FstreamAdapter.prototype, 'readable', {
  get: function getReadable() {
    return !!this._done;
  }
});

FstreamAdapter.prototype._write = function _write(row, encoding, done) {
  var entry = this._createEntry(row);
  var notBusy = this._destination.add(entry);
  if (notBusy !== false) {
    return done();
  }
  if (this._done) {
    throw new Error('Do not call _write before previous _write has been done');
  }
  this._done = done;
};

FstreamAdapter.prototype.pause = function pause() {};

FstreamAdapter.prototype.resume = function resume() {
  if (this._done) {
    var done = this._done;
    this._done = undefined;
    done();
  }
};

FstreamAdapter.prototype.pipe = function pipe(dest) {
  this._destination = dest;
  this.once('finish', function onfinish() {
    dest.end();
  });
  return Stream.prototype.pipe.call(this, dest);
};