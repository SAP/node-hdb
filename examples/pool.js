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
var path = require('path');
var gp = require('generic-pool');
var hdb = require('../index');
var filename = path.join(__dirname, '..', 'test', 'lib', 'config.json');
var options = JSON.parse(fs.readFileSync(filename));

var pool = gp.Pool({
  name: 'hdb',
  create: function (callback) {
    var client = hdb.createClient(options)
    client.on('error', function onerror(err) {
      console.error('Client error:', err);
    });
    client.connect(function onconnect(err) {
      if (err) {
        return callback(err);
      }
      callback(null, client);
    });
  },
  destroy: function ondestroy(client) {
    client.end();
  },
  max: 3,
  min: 1,
  idleTimeoutMillis: 30000,
  log: false
});

exports = module.exports = pool;