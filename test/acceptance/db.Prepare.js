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
/* jshint undef:false, expr:true */

var async = require('async');
var db = require('../db')();

describe('db', function () {
  before(db.init.bind(db));
  after(db.end.bind(db));
  var client = db.client;

  describe('NUMBERS', function () {
    before(db.createNumbers.bind(db));
    after(db.dropNumbers.bind(db));

    describe('execute of Statement', function () {

      it('should return all numbers like `b`', function (done) {
        var sql = 'select * from NUMBERS where B like ? order by A';
        var statement;
        async.series([

          function prepareStatement(callback) {
            client.prepare(sql, function onprepare(err, ps) {
              statement = ps;
              var metadata = statement.parameterMetadata;
              metadata.should.have.length(1);
              var p = metadata[0];
              p.should.have.property('mode', 2);
              p.should.have.property('dataType', 9);
              p.should.have.property('ioType', 1);
              callback(null, statement);
            });
          },
          function endsWithTeen(callback) {
            statement.exec(['%teen'], function (err, rows) {
              if (err) {
                return callback(err);
              }
              rows.should.have.length(7);
              callback();
            });
          },
          function endsWithOne(callback) {
            statement.exec(['%one'], function (err, rows) {
              if (err) {
                return callback(err);
              }
              rows.should.have.length(9);
              callback();
            });
          },
          function dropStatement(callback) {
            statement.drop(callback);
          }
        ], done);
      });

    });


    describe('execute of DBProcedure', function () {
      before(db.createReadNumbersProc.bind(db));
      after(db.dropReadNumbersProc.bind(db));

      it('should return the numbers between `a` and `b`', function (done) {
        var sql = 'call READ_NUMBERS_BETWEEN (?, ?, ?)';
        var statement;
        async.series([

          function prepareStatement(callback) {
            client.prepare(sql, function (err, ps) {
              statement = ps;
              var metadata = statement.parameterMetadata;
              metadata.should.have.length(2);
              var p1 = metadata[0];
              p1.should.have.property('mode', 2);
              p1.should.have.property('dataType', 3);
              p1.should.have.property('ioType', 1);
              var p2 = metadata[0];
              p2.should.have.property('mode', 2);
              p2.should.have.property('dataType', 3);
              p2.should.have.property('ioType', 1);
              callback();
            });
          },
          function readNumbersBetween3and5(callback) {
            statement.exec([3, 5], function (err, parameters, rows) {
              if (err) {
                return callback(err);
              }
              Object.keys(parameters).should.have.length(0);
              arguments.should.have.length(3);
              rows.should.have.length(3);
              rows.should.eql(db.numbers.slice(3, 6));
              callback();
            });
          },
          function readNumbersBetween8and7(callback) {
            statement.exec([8, 7], function (err, parameters, rows) {
              if (err) {
                return callback(err);
              }
              rows.should.be.empty;
              callback();
            });
          },
          function dropStatement(callback) {
            statement.drop(callback);
          }
        ], done);

      });
    });
  });
});