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
var async = require('async');
var lib = require('./hdb').lib;
var mock = require('./mock');
var Client = lib.Client;
var util = lib.util;

var NUMBERS = require('../fixtures/numbers');

var options;
try {
  options = JSON.parse(fs.readFileSync(path.join(__dirname, '_config.json')));
} catch (err) {
  options = null;
}

function createDatabase() {
  if (!options) {
    return new MockDatabase();
  }
  return new Database(options);
}

function AbstractDB(options) {
  this.client = new Client(options);
  this.numbers = undefined;
}

AbstractDB.prototype.init = function init(cb) {
  this.client.connect(cb);
};

AbstractDB.prototype.disconnect = function disconnect(cb) {
  this.client.disconnect(cb);
};

AbstractDB.prototype.end = function end(cb) {
  var self = this;

  function done(err) {
    self.client.end();
    setTimeout(cb.bind(null, err), 1);
  }
  this.client.disconnect(done);
};

AbstractDB.prototype.createNumbers = function createNumbers(cb) {
  this.numbers = NUMBERS.slice(0);
  doNothing(cb);
};

AbstractDB.prototype.dropNumbers = function dropNumbers(cb) {
  this.numbers = undefined;
  doNothing(cb);
};

AbstractDB.prototype.createReadNumbersProc = function createReadNumbersProc(
  cb) {
  doNothing(cb);
};

AbstractDB.prototype.dropReadNumbersProc = function dropReadNumbersProc(
  cb) {
  doNothing(cb);
};

exports.createDatabase = createDatabase;
exports.NUMBERS = NUMBERS;

util.inherits(Database, AbstractDB);

function Database(options) {
  AbstractDB.call(this, options);
}

Database.prototype.createNumbers = function createNumbers(cb) {
  var self = this;
  this.numbers = NUMBERS.slice(0);

  function createTable(callback) {
    var sql = 'drop table NUMBERS cascade';

    function ondroptable() {
      // ignore err
      var sql = 'create table NUMBERS (a int, b varchar(16))';
      self.client.exec(sql, callback);
    }
    self.client.exec(sql, ondroptable);
  }

  function insertNumbers(statement) {
    function createNumberInsertTask(n) {
      return statement.exec.bind(statement, [n.A, n.B]);
    }
    var tasks = self.numbers.map(createNumberInsertTask);

    function onresult(err) {
      statement.drop();
      cb(err);
    }
    async.series(tasks, onresult);
  }

  function onprepare(err, statement) {
    if (err) {
      return cb(err);
    }
    insertNumbers(statement);
  }

  function ontable(err) {
    if (err) {
      return cb(err);
    }
    var sql = 'insert into NUMBERS values (?, ?)';
    self.client.prepare(sql, onprepare);
  }
  createTable(ontable);
};

Database.prototype.dropNumbers = function dropNumbers(cb) {
  this.numbers = undefined;
  var sql = 'drop table NUMBERS cascade';
  this.client.exec(sql, cb);
};

Database.prototype.createReadNumbersProc = function createReadNumbersProc(cb) {
  var sql = [
    'create procedure READ_NUMBERS_BETWEEN (in a int, in b int, out nums NUMBERS)',
    'language sqlscript',
    'reads sql data with result view READ_NUMBERS_BETWEEN_VIEW as',
    'begin',
    ' nums = select * from NUMBERS where a between :a and :b;',
    'end;'
  ].join('\n');
  this.client.exec(sql, cb);
};

Database.prototype.dropReadNumbersProc = function dropReadNumbersProc(cb) {
  var sql = 'drop procedure READ_NUMBERS_BETWEEN cascade';
  this.client.exec(sql, cb);
};

util.inherits(MockDatabase, AbstractDB);

function MockDatabase() {
  AbstractDB.call(this, {
    host: 'localhost',
    port: 30015,
    user: 'TEST_USER',
    password: 'abcd1234'
  });
  this.server = mock.createServer();
}

MockDatabase.prototype.init = function init(cb) {
  var self = this;

  function done(err) {
    self.server.removeListener('listening', done);
    self.server.removeListener('error', done);
    if (err) {
      return cb(err);
    }
    AbstractDB.prototype.init.call(self, cb);
  }
  this.server.listen(30015);
  this.server.on('error', done).on('listening', done);
};

function doNothing(done) {
  process.nextTick(done);
}