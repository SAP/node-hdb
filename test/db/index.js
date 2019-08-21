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
var LocalDB = require('./LocalDB');
var RemoteDB = require('./RemoteDB');
var libUtil = require('../../lib/util');

var localOptions = {
  host: 'localhost',
  port: 30015,
  user: 'TEST_USER',
  password: 'abcd1234',
  ignoreDefaultLobType: process.env.IGNORE_DEFAULT_LOB_TYPE === 'true'
};

var options;
try {
  options = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json')));
} catch (err) {
  options = null;
}

function getOptions(testOptions) {
  return libUtil.extend(options || localOptions, testOptions);
}

module.exports = function create(testOptions) {
  if (!options || process.env.HDB_MOCK) {
    return new LocalDB(getOptions(testOptions));
  }
  return new RemoteDB(getOptions(testOptions));
};