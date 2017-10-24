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
              // on HANA SP12 dataType = 9 (VARCHAR1)
              // on HANA2 dataType = 29 (STRING)
              p.should.have.property('dataType').which.is.oneOf(9, 29);
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

      it('should return an invalid parameters error', function (done) {
        var statement;
        async.series([
          function prepare(cb) {
            var sql = 'insert into NUMBERS values (?, ?)';
            client.prepare(sql, function (err, ps) {
              statement = ps;
              cb(err);
            });
          },
          function insert(cb) {
            var values = [1, new Buffer('invalid type', 'ascii')];
            statement.exec(values, function (err) {
              err.should.be.instanceof(Error);
              cb();
            });
          },
          function drop(cb) {
            statement.drop(function (err) {
              /* jshint unused:false */
              // ignore error
              cb();
            });
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

  describe('CESU8', function () {
    before(db.createConcatStringsProc.bind(db));
    after(db.dropConcatStringsProc.bind(db));

    it('should return concatenated params and table with columns same as the params', function (done) {
      var sql = 'call CONCAT_STRINGS_PROC (?, ?, ?, ?)';
      var statement;
      async.series([
        function prepareStatement(callback) {
          client.prepare(sql, function (err, ps) {
            statement = ps;
            var metadata = statement.parameterMetadata;
            metadata.should.have.length(3);
            function checkParam(p, name, ioType) {
              p.should.have.property('name', name);
              p.should.have.property('mode', 2);
              p.should.have.property('dataType', 11);
              p.should.have.property('ioType', ioType);
            }
            checkParam(metadata[0], 'A', 1);
            checkParam(metadata[1], 'B', 1);
            checkParam(metadata[2], 'C', 4);

            callback();
          });
        },
        function concatCesu8Strings(callback) {
          statement.exec({ A: '🍨', B: '🍩' }, function (err, parameters, rows) {
            if (err) {
              return callback(err);
            }
            Object.keys(parameters).should.have.length(1);
            parameters.C.should.equal('🍨🍩');

            rows.should.have.length(1);
            rows[0].ID.should.eql('🍨');
            rows[0].CAT.should.eql('🍨🍩');

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