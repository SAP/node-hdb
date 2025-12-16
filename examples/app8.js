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

async.series([connect, execute, reconnect, execute, disconnect], done);

function connect(cb) {
  client.connect(cb);
}

function disconnect(cb) {
  client.disconnect(cb);
}

function execute(cb) {
  client.exec('select * from dummy', cb);
}

function reconnect(cb) {
  // reconnect on close
  client.on('close', function onclose(hadError) {
    if (hadError) {
      this.connect();
    }
  });
  // simulate a network error
  client._connection._socket.end();
  client.once('connect', function reconnected() {
    cb();
  });
}

function done(err, results) {
  client.end();
  if (err) {
    return console.error('Error', err);
  }
  console.log(results);
}