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

const fs = require('fs');
const os = require('os');
const path = require('path');
const async = require('async');
const client = require('./client');

const sql = 'select NAME, DATA from TEST_LOBS';
const dirname = path.join(os.tmpdir(), process.argv[2] || 'lobs-out');

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
  fs.mkdirSync(dirname, { recursive: true });

  const stream = rs.createObjectStream();
  const pending = [];
  let streamDone = false;
  let cbCalled = false;

  function tryFinish(err) {
    if (cbCalled) {
      return;
    }
    if (err) {
      cbCalled = true;
      stream.destroy();
      return cb(err);
    }
    if (streamDone && pending.length === 0) {
      cbCalled = true;
      cb(null);
    }
  }

  stream.on('error', tryFinish);

  stream.on('data', function(row) {
    stream.pause();
    const destPath = path.join(dirname, row.NAME);
    const readStream = row.DATA.createReadStream();
    const writeStream = fs.createWriteStream(destPath);

    pending.push(1);

    function finish(err) {
      readStream.removeListener('error', finish);
      writeStream.removeListener('error', finish);
      writeStream.removeListener('finish', onfinish);
      pending.pop();
      stream.resume();
      if (err) {
        return tryFinish(err);
      }
      tryFinish(null);
    }

    function onfinish() {
      finish(null);
    }

    readStream.once('error', finish);
    writeStream.once('error', finish);
    writeStream.once('finish', onfinish);
    readStream.pipe(writeStream);
  });

  stream.on('end', function() {
    streamDone = true;
    tryFinish(null);
  });
}

function done(err) {
  console.timeEnd('time');
  if (err) {
    console.error('Error', err);
  } else {
    console.log('Copied lobs to dir "%s"', dirname);
  }
  client.end();
}
