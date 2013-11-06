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
var lib = require(process.env.HDB_COV ? '../../lib-cov' : '../../lib');
var util = lib.util;
util.extend(exports, lib);

var NUMBERS = exports.NUMBERS = require('../fixtures/numbers');

var options;
try {
  options = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json')));
} catch (err) {
  options = {
    host: 'localhost',
    port: 30015,
    user: 'USER',
    password: 'PASSWORD'
  };
}


exports.createDatabase = function createDatabase() {
  return new Database();
};

function Database() {
  this.client = new lib.Client(options);
  this.numbers = undefined;
}

Database.prototype.connect = function connect(done) {
  var db = this;
  this.client.connect(function onconnect(err) {
    if (err) {
      return done(err);
    }
    var schema = options.user.toUpperCase();
    var sql = util.format('set schema', schema);
    db.client.exec(sql, done);
  });
};

Database.prototype.disconnect = function disconnect(done) {
  this.client.disconnect(done);
};

Database.prototype.createNumbers = function createNumbers(range, done) {
  var db = this;

  if (typeof range === 'function') {
    done = range;
    range = [0, 100];
  }
  db.numbers = NUMBERS.slice(range[0], range[1] + 1);

  function createTable(callback) {
    var sql = 'drop table NUMBERS cascade';

    function ondroptable() {
      // ignore err
      var sql = 'create table NUMBERS (a int, b varchar(16))';
      db.client.exec(sql, callback);
    }
    db.client.exec(sql, ondroptable);
  }

  function insertNumbers(statement) {
    function createNumberInsertTask(num) {
      return async.apply(statement.exec.bind(statement), [num.A, num.B]);
    }
    var tasks = db.numbers.map(createNumberInsertTask);

    function onresult(err) {
      statement.drop();
      done(err);
    }
    async.series(tasks, onresult);
  }

  function ontable(err) {
    if (err) {
      return done(err);
    }
    var sql = 'insert into NUMBERS values (?, ?)';
    db.client.prepare(sql, function onprepare(err, statement) {
      if (err) {
        return done(err);
      }
      insertNumbers(statement);
    });
  }
  createTable(ontable);
};

Database.prototype.dropNumbers = function dropNumbers(done) {
  var db = this;

  var sql = 'drop table NUMBERS cascade';
  db.client.exec(sql, done);
};

Database.prototype.createReadNumbersBetween = function createReadNumbersBetween(
  done) {
  var db = this;

  var sql = [
    'create procedure READ_NUMBERS_BETWEEN (in a int, in b int, out nums NUMBERS)',
    'language sqlscript',
    'reads sql data with result view READ_NUMBERS_BETWEEN_VIEW as',
    'begin',
    ' nums = select * from NUMBERS where a between :a and :b;',
    'end;'
  ].join('\n');
  db.client.exec(sql, done);
};

Database.prototype.dropReadNumbersBetween = function dropReadNumbersBetween(
  done) {
  var db = this;

  var sql = 'drop procedure READ_NUMBERS_BETWEEN cascade';
  db.client.exec(sql, done);
};