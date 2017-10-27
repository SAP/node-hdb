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

var hdb = require('../../lib');

module.exports = TestDB;

function TestDB(options) {
  this.client = hdb.createClient(options);
  this.numbers = undefined;
}

TestDB.NUMBERS = require('../fixtures/numbers');
TestDB.IMAGES = require('../fixtures/images');

TestDB.prototype.init = function init(cb) {
  this.client.connect(cb);
};

TestDB.prototype.disconnect = function disconnect(cb) {
  this.client.disconnect(cb);
};

TestDB.prototype.end = function end(cb) {
  var self = this;

  function done(err) {
    self.client.end();
    setTimeout(cb.bind(null, err), 1);
  }
  this.client.disconnect(done);
};

TestDB.prototype.createNumbers = function createNumbers(cb) {
  this.numbers = TestDB.NUMBERS.slice(0);
  doNothing(cb);
};

TestDB.prototype.dropNumbers = function dropNumbers(cb) {
  this.numbers = undefined;
  doNothing(cb);
};

TestDB.prototype.createImages = function createImages(cb) {
  this.images = TestDB.IMAGES.slice(0);
  doNothing(cb);
};

TestDB.prototype.dropImages = function dropImages(cb) {
  this.images = undefined;
  doNothing(cb);
};


TestDB.prototype.createReadNumbersProc = function createReadNumbersProc(cb) {
  doNothing(cb);
};

TestDB.prototype.dropReadNumbersProc = function dropReadNumbersProc(cb) {
  doNothing(cb);
};

TestDB.prototype.createConcatStringsProc = function createConcatStringsProc(cb) {
  doNothing(cb);
};

TestDB.prototype.dropConcatStringsProc = function dropConcatStringsProc(cb) {
  doNothing(cb);
};

TestDB.prototype.createHashBlobProc = function createHashBlobProc(cb) {
  doNothing(cb);
};

TestDB.prototype.dropHashBlobProc = function dropHashBlobProc(cb) {
  doNothing(cb);
};


function doNothing(done) {
  process.nextTick(done);
}