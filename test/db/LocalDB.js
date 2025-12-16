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
var TestDB = require('./TestDB');
var mock = require('../mock');

module.exports = LocalDB;

util.inherits(LocalDB, TestDB);

function LocalDB(options) {
  TestDB.call(this, options);
  this.server = mock.createServer();
}

LocalDB.prototype.init = function init(cb) {
  var self = this;

  function done(err) {
    self.server.removeListener('listening', done);
    self.server.removeListener('error', done);
    if (err) {
      return cb(err);
    }
    TestDB.prototype.init.call(self, cb);
  }
  this.server.listen(30015);
  this.server.on('error', done).on('listening', done);
};