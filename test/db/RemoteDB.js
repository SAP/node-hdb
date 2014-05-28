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

module.exports = RemoteDB;

util.inherits(RemoteDB, TestDB);

function RemoteDB(options) {
  TestDB.call(this, options);
}

RemoteDB.prototype.createImages = function createImages(cb) {
  this.images = TestDB.IMAGES.slice(0);
  var values = this.images.map(function toParameters(img) {
    return [img.NAME, img.BDATA];
  });
  this.createTable('IMAGES', ['NAME varchar(16)', 'BDATA blob'], values, cb);
};

RemoteDB.prototype.dropImages = function dropImages(cb) {
  this.images = undefined;
  this.dropTable('IMAGES', cb);
};

RemoteDB.prototype.createNumbers = function createNumbers(cb) {
  this.numbers = TestDB.NUMBERS.slice(0);
  var values = this.numbers.map(function toParameters(num) {
    return [num.A, num.B];
  });
  this.createTable('NUMBERS', ['a int', 'b varchar(16)'], values, cb);
};

RemoteDB.prototype.dropNumbers = function dropNumbers(cb) {
  this.numbers = undefined;
  this.dropTable('NUMBERS', cb);
};

RemoteDB.prototype.createTable = function createTable(tablename, columns,
  values, cb) {
  var self = this;
  tablename = tablename.toUpperCase();
  var createCols = columns.join(',');
  var insertCols = '';
  for (var i = 0; i < columns.length; i++) {
    insertCols += ',?';
  }
  insertCols = insertCols.substring(1);

  function dropAndCreateTable(callback) {
    var sql = util.format('drop table %s cascade', tablename);

    function ondroptable() {
      // ignore err
      var sql = util.format('create table %s (%s)', tablename, createCols);
      self.client.exec(sql, callback);
    }
    self.client.exec(sql, ondroptable);
  }

  function insertInto(statement) {

    function onresult(err) {
      statement.drop();
      cb(err);
    }
    statement.exec(values, onresult);
  }

  function onprepare(err, statement) {
    if (err) {
      return cb(err);
    }
    insertInto(statement);
  }

  function ontable(err) {
    if (err) {
      return cb(err);
    }
    var sql = util.format('insert into %s values (%s)', tablename, insertCols);
    self.client.prepare(sql, onprepare);
  }
  dropAndCreateTable(ontable);
};

RemoteDB.prototype.dropTable = function dropTable(tablename, cb) {
  tablename = tablename.toUpperCase();
  var sql = util.format('drop table %s cascade', tablename);
  this.client.exec(sql, cb);
};

RemoteDB.prototype.createReadNumbersProc = function createReadNumbersProc(cb) {
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

RemoteDB.prototype.dropReadNumbersProc = function dropReadNumbersProc(cb) {
  var sql = 'drop procedure READ_NUMBERS_BETWEEN cascade';
  this.client.exec(sql, cb);
};