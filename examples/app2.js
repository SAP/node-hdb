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

var fields = ['SCHEMA_NAME || \'.\' || TABLE_NAME as TABLE'];
var sql = util.format('select top 50 %s from TABLES', fields.join(','));

async.waterfall([connect, execute, fetchRows], done);

function connect(cb) {
  client.connect(cb);
}

function execute(cb) {
  client.execute(sql, cb);
}

function fetchRows(rs, cb) {
  rs.fetch(cb);
}

function done(err, rows) {
  client.end();
  if (err) {
    return console.error(err);
  }
  console.log(util.inspect(rows, {
    colors: true
  }));
}