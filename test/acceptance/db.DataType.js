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
// Set the data format version necessary for the data types
var db = require('../db')({dataFormatVersion: 4});
var RemoteDB = require('../db/RemoteDB');
var lorem = require('../fixtures/lorem');

var describeRemoteDB = db instanceof RemoteDB ? describe : describe.skip;

describe('db', function () {
  before(db.init.bind(db));
  after(db.end.bind(db));
  var client = db.client;

  describeRemoteDB('DATES', function () {
    describeRemoteDB('DAYDATE', function () {
      before(db.createDateTable.bind(db, ['A DAYDATE']));
      after(db.dropDateTable.bind(db));

      it('should return valid date via callback', function (done) {
        var statement;
        function prepareInsert(cb) {
          var sql = 'insert into DATE_TABLE values (?)';
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }

        function insert(cb) {
          var params = [
            ['2023-05-04'],
            ['1990-12-31'],
            ['0001-01-01'],
            ['2001-02-12 08:30:00'],
            ['9999-12-31'],
            [null],
          ];
          statement.exec(params, function (rowsAffected) {
            statement.drop();
            cb();
          });
        }

        function prepareSelect(cb) {
          var sql = 'select * from DATE_TABLE order by A';
          client.prepare(sql, function (err, ps) {
            if (err) done(err);
            statement = ps;
            cb(err);
          });
        }

        function select(cb) {
          var metadata = statement.resultSetMetadata;
          metadata.should.have.length(1);
          metadata[0].should.have.property('dataType', 63);
          statement.exec([], function (err, rows) {
            if (err) {
              return done(err);
            }
            rows.should.have.length(6);
            rows.should.eql([{A: null}, {A: "0001-01-01"}, {A: "1990-12-31"}, {A: "2001-02-12"}, {A: "2023-05-04"}, {A: "9999-12-31"}]);
            cb();
          });
        }

        function drop(cb) {
          statement.drop(function (err) {
            // ignore error
            cb();
          });
        }
        
        async.waterfall([prepareInsert, insert, prepareSelect, select, drop], done);
      });

      it('should raise input type error', function (done) {
        var statement;
        function prepare(cb) {
          var sql = 'insert into DATE_TABLE values (?)';
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }
        function insert(cb) {
          var values = ['2460684'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function insert2(cb) {
          var values = ['10000-01-12'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function insert3(cb) {
          var values = ['2020-14-20'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function drop(cb) {
          statement.drop(function (err) {
            // ignore error
            cb();
          });
        }

        async.waterfall([prepare, insert, insert2, insert3, drop], done)
      });
    });

    describeRemoteDB('SECONDDATE', function () {
      before(db.createDateTable.bind(db, ['A SECONDDATE']));
      after(db.dropDateTable.bind(db));

      it('should return valid dates via callback', function (done) {
        var statement;
        function prepareInsert(cb) {
          var sql = 'insert into DATE_TABLE values (?)';
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }

        function insert(cb) {
          var params = [
            ['2025-01-13 04:27:32.7891234'],
            ['1990-12-03 10:20:29'],
            ['0001-01-01 00:00:00'],
            ['2011-01-01 11:12:13.167832'],
            ['2000-02-29 23:59:59.9999999'],
            ['9999-12-31 23:59:59'],
            [null],
          ];
          statement.exec(params, function (rowsAffected) {
            statement.drop();
            cb();
          });
        }

        function prepareSelect(cb) {
          var sql = 'select * from DATE_TABLE WHERE A >= \'2000-01-01\' order by A';
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }

        function select(cb) {
          var metadata = statement.resultSetMetadata;
          metadata.should.have.length(1);
          metadata[0].should.have.property('dataType', 62);
          statement.exec([], function (err, rows) {
            if (err) {
              return done(err);
            }
            rows.should.have.length(4);
            rows.should.eql([{A: "2000-02-29 23:59:59"}, {A: "2011-01-01 11:12:13"}, {A: "2025-01-13 04:27:32"}, {A: "9999-12-31 23:59:59"}]);
            cb();
          });
        }

        function drop(cb) {
          statement.drop(function (err) {
            // ignore error
            cb();
          });
        }
        
        async.waterfall([prepareInsert, insert, prepareSelect, select, drop], done);
      });

      it('should raise input type error', function (done) {
        var statement;
        function prepare(cb) {
          var sql = 'insert into DATE_TABLE values (?)';
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }
        function insert(cb) {
          var values = ['2015-02-10'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function insert2(cb) {
          var values = ['10000-01-12 14:01:02'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function insert3(cb) {
          var values = ['1998-06-25 25:59:59'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function drop(cb) {
          statement.drop(function (err) {
            // ignore error
            cb();
          });
        }

        async.waterfall([prepare, insert, insert2, insert3, drop], done);
      });
    });

    describeRemoteDB('LONGDATE', function () {
      before(db.createDateTable.bind(db, ['A LONGDATE']));
      after(db.dropDateTable.bind(db));

      it('should return valid dates via callback', function (done) {
        var statement;
        function prepareInsert(cb) {
          var sql = 'insert into DATE_TABLE values (?)';
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }

        function insert(cb) {
          var params = [
            ['2025-01-13 04:27:32.7891234'],
            ['1990-12-03 10:20:29'],
            ['0001-01-01 00:00:00'],
            ['2011-01-01 11:12:13.167832'],
            ['2000-02-29 23:59:59.9999999'],
            ['9999-12-31 23:59:59.9999999'],
            [null]
          ];
          statement.exec(params, function (rowsAffected) {
            statement.drop();
            cb();
          });
        }

        function prepareSelect(cb) {
          var sql = 'select * from DATE_TABLE WHERE A >= \'2000-01-01\' order by A';
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }

        function select(cb) {
          var metadata = statement.resultSetMetadata;
          metadata.should.have.length(1);
          metadata[0].should.have.property('dataType', 61);
          statement.exec([], function (err, rows) {
            if (err) {
              return done(err);
            }
            rows.should.have.length(4);
            rows.should.eql([{A: "2000-02-29 23:59:59.999999900"}, {A: "2011-01-01 11:12:13.167832000"}, {A: "2025-01-13 04:27:32.789123400"}, {A: "9999-12-31 23:59:59.999999900"}]);
            cb();
          });
        }

        function drop(cb) {
          statement.drop(function (err) {
            // ignore error
            cb();
          });
        }
        
        async.waterfall([prepareInsert, insert, prepareSelect, select, drop], done);
      });

      it('should raise input type error', function (done) {
        var statement;
        function prepare(cb) {
          var sql = 'insert into DATE_TABLE values (?)';
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }
        function insert(cb) {
          var values = ['2015-02-10'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function insert2(cb) {
          var values = ['10000-01-12 14:01:02'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function insert3(cb) {
          var values = ['1998-06-25 25:59:59'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function insert4(cb) {
          var values = ['1900-02-29 12:00:00'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function insert5(cb) {
          var values = ['0000-00-00 12:00:00'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function drop(cb) {
          statement.drop(function (err) {
            // ignore error
            cb();
          });
        }

        async.waterfall([prepare, insert, insert2, insert3, insert4, insert5, drop], done)
      });
    });

    describeRemoteDB('SECONDTIME', function () {
      before(db.createDateTable.bind(db, ['A SECONDTIME']));
      after(db.dropDateTable.bind(db));

      it('should return valid times via callback', function (done) {
        var statement;
        function prepareInsert(cb) {
          var sql = 'insert into DATE_TABLE values (?)';
          client.prepare(sql, function (err, ps) {
            if (err) {
              done(err);
            }
            statement = ps;
            cb(err);
          });
        }

        function insert(cb) {
          var params = [
            ['04:27:32.7891234'],
            ['10:20:29'],
            ['00:00:00'],
            ['11:12:13.167832'],
            ['23:59:59.9999999'],
            [null],
            // ['9:9:9 AM'],
            // ['3:28:03 PM']
          ];
          statement.exec(params, function (err, rowsAffected) {
            if (err) {
              done(err);
            }
            statement.drop();
            cb();
          });
        }

        function prepareSelect(cb) {
          var sql = 'select * from DATE_TABLE WHERE A >= \'10:00:00\' order by A';
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }

        function select(cb) {
          var metadata = statement.resultSetMetadata;
          metadata.should.have.length(1);
          metadata[0].should.have.property('dataType', 64);
          statement.exec([], function (err, rows) {
            if (err) {
              return done(err);
            }
            rows.should.have.length(3);
            rows.should.eql([{A: "10:20:29"}, {A: "11:12:13"}, {A: "23:59:59"}]);
            // When AM / PM are added, the result should instead be
            // rows.should.eql([{A: "10:20:29"}, {A: "11:12:13"}, {A: "15:28:03"}, {A: "23:59:59"}]);
            cb();
          });
        }

        function drop(cb) {
          statement.drop(function (err) {
            // ignore error
            cb();
          });
        }
        
        async.waterfall([prepareInsert, insert, prepareSelect, select, drop], done);
      });

      it('should raise input type error', function (done) {
        var statement;
        function prepare(cb) {
          var sql = 'insert into DATE_TABLE values (?)';
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }
        function insert(cb) {
          var values = ['2015-02-10'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function insert2(cb) {
          var values = ['11:50:62'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function insert3(cb) {
          var values = ['24:00:01'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function insert4(cb) {
          var values = ['00:00-01'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function insert5(cb) {
          var values = ['11:60:02'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function drop(cb) {
          statement.drop(function (err) {
            // ignore error
            cb();
          });
        }

        async.waterfall([prepare, insert, insert2, insert3, insert4, insert5, drop], done)
      });
    });
  });

  describeRemoteDB('ALPHANUM, TEXT, SHORTTEXT (only tested on on-premise HANA)', function () {
    var skipTests = false;
    before(function (done) {
      var version = db.getHANAFullVersion();
      if (version === undefined || version.startsWith("4.")) { // Skip tests on HANA cloud
        skipTests = true;
        this.test.parent.pending = true;
        this.skip();
      }
      done();
    });

    // Functions used to setup and drop tables only when the tests are not skipped
    function setUpTable(columns, done) {
      if (skipTests) {
        done();
      } else {
        db.createTextTable.bind(db)(columns, done);
      }
    }

    function dropTable(done) {
      if (skipTests) {
        done();
      } else {
        db.dropTextTable.bind(db)(done);
      }
    }

    describe('ALPHANUM', function () {
      before(setUpTable.bind(null, ['A ALPHANUM(16)']));
      after(dropTable);

      it('should return valid alphanums via callback', function (done) {
        var statement;
        function prepareInsert(cb) {
          var sql = 'insert into TEXT_TABLE values (?)';
          client.prepare(sql, function (err, ps) {
            if (err) {
              done(err);
            }
            statement = ps;
            cb(err);
          });
        }
  
        function insert(cb) {
          var params = [
            ['ABC123'],
            ['9017123461226781'],
            ['12893'],
            [''],
            [null],
          ];
          statement.exec(params, function (err, rowsAffected) {
            if (err) {
              done(err);
            }
            statement.drop();
            cb();
          });
        }
  
        function prepareSelect(cb) {
          var sql = 'select * from TEXT_TABLE order by A';
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }
  
        function select(cb) {
          var metadata = statement.resultSetMetadata;
          metadata.should.have.length(1);
          metadata[0].should.have.property('dataType', 55);
          statement.exec([], function (err, rows) {
            if (err) {
              return done(err);
            }
            rows.should.have.length(5);
            rows.should.eql([{A: null}, {A: ""}, {A: "0000000000012893"}, {A: "9017123461226781"}, {A: "ABC123"}]);
            cb();
          });
        }
  
        function drop(cb) {
          statement.drop(function (err) {
            // ignore error
            cb();
          });
        }
        
        async.waterfall([prepareInsert, insert, prepareSelect, select, drop], done);
      });
  
      it('should raise input type error', function (done) {
        var statement;
        function prepare(cb) {
          var sql = 'insert into TEXT_TABLE values (?)';
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }
        function insert(cb) {
          var values = ['ABCDEFG1234567890'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function drop(cb) {
          statement.drop(function (err) {
            // ignore error
            cb();
          });
        }
  
        async.waterfall([prepare, insert, drop], done);
      });
    });

    describe('TEXT', function () {
      before(setUpTable.bind(null, ['A TEXT']));
      after(dropTable);

      it('should insert and return valid text via callback', function (done) {
        var statement;
        function prepareInsert(cb) {
          var sql = 'insert into TEXT_TABLE values (?)';
          client.prepare(sql, function (err, ps) {
            if (err) {
              done(err);
            }
            statement = ps;
            cb(err);
          });
        }
  
        function insert(cb) {
          var params = [
            ['Some regular length strings'],
            ['!@#$%^&*()-_=`~|}{\\:"\'<>,.?/1234567890'],
            [lorem.LONG],
            [''],
            [null],
          ];
          statement.exec(params, function (err, rowsAffected) {
            if (err) {
              done(err);
            }
            statement.drop();
            cb();
          });
        }
  
        function prepareSelect(cb) {
          var sql = 'select * from TEXT_TABLE';
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }
  
        function select(cb) {
          var metadata = statement.resultSetMetadata;
          metadata.should.have.length(1);
          metadata[0].should.have.property('dataType', 51);
          statement.exec([], function (err, rows) {
            if (err) {
              return done(err);
            }
            rows.should.have.length(5);
            cb();
          });
        }
  
        function drop(cb) {
          statement.drop(function (err) {
            // ignore error
            cb();
          });
        }
        
        async.waterfall([prepareInsert, insert, prepareSelect, select, drop], done);
      });
  
      it('should support fuzzy search', function (done) {
        var statement;
        function prepareInsert(cb) {
          var sql = 'insert into TEXT_TABLE values (?)';
          client.prepare(sql, function (err, ps) {
            if (err) {
              done(err);
            }
            statement = ps;
            cb(err);
          });
        }
  
        function insert(cb) {
          var values = [['SAP Corp'], ['SAP in Walldorf Corp'], ['ASAP'], ['ASAP Corp'], ['BSAP orp'], ['IBM Corp']];
          statement.exec(values, function (err, rowsAffected) {
            if (err) {
              done(err);
            }
            statement.drop();
            cb();
          });
        }
  
        function prepareSelect(cb) {
          var sql = "select * from TEXT_TABLE WHERE CONTAINS(A, ?, FUZZY(?, 'textSearch=compare,bestMatchingTokenWeight=0.7'))";
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }
  
        function select(cb) {
          var metadata = statement.resultSetMetadata;
          metadata.should.have.length(1);
          metadata[0].should.have.property('dataType', 51);
          statement.exec(['xSAP Corp Walldorf', 0.7], function (err, rows) {
            if (err) {
              return done(err);
            }
            rows.should.have.length(1);
            rows[0]['A'].toString('ascii').should.eql('SAP in Walldorf Corp');
            cb();
          });
        }
  
        function drop(cb) {
          statement.drop(function (err) {
            // ignore error
            cb();
          });
        }
        
        async.waterfall([prepareInsert, insert, prepareSelect, select, drop], done);
      });
    });

    describe('SHORTTEXT', function () {
      before(setUpTable.bind(null, ['A SHORTTEXT(50)']));
      after(dropTable);

      it('should insert and return valid text via callback', function (done) {
        var statement;
        function prepareInsert(cb) {
          var sql = 'insert into TEXT_TABLE values (?)';
          client.prepare(sql, function (err, ps) {
            if (err) {
              done(err);
            }
            statement = ps;
            cb(err);
          });
        }
  
        function insert(cb) {
          var params = [
            ['Some regular length strings'],
            ['!@#$%^&*()-_=`~|}{\\:"\'<>,.?/1234567890'],
            ['50 length-----------------------------------------'],
            [''],
            [null],
          ];
          statement.exec(params, function (err, rowsAffected) {
            if (err) {
              done(err);
            }
            statement.drop();
            cb();
          });
        }
  
        function prepareSelect(cb) {
          var sql = 'select * from TEXT_TABLE';
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }
  
        function select(cb) {
          var metadata = statement.resultSetMetadata;
          metadata.should.have.length(1);
          metadata[0].should.have.property('dataType', 52);
          statement.exec([], function (err, rows) {
            if (err) {
              return done(err);
            }
            rows.should.have.length(5);
            cb();
          });
        }
  
        function drop(cb) {
          statement.drop(function (err) {
            // ignore error
            cb();
          });
        }
        
        async.waterfall([prepareInsert, insert, prepareSelect, select, drop], done);
      });
  
      it('should support fuzzy search', function (done) {
        var statement;
        function prepareInsert(cb) {
          var sql = 'insert into TEXT_TABLE values (?)';
          client.prepare(sql, function (err, ps) {
            if (err) {
              done(err);
            }
            statement = ps;
            cb(err);
          });
        }
  
        function insert(cb) {
          var values = [['SAP Corp'], ['SAP in Walldorf Corp'], ['ASAP'], ['ASAP Corp'], ['BSAP orp'], ['IBM Corp']];
          statement.exec(values, function (err, rowsAffected) {
            if (err) {
              done(err);
            }
            statement.drop();
            cb();
          });
        }
  
        function prepareSelect(cb) {
          var sql = "select * from TEXT_TABLE WHERE CONTAINS(A, ?, FUZZY(?, 'textSearch=compare,bestMatchingTokenWeight=0.7'))";
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }
  
        function select(cb) {
          var metadata = statement.resultSetMetadata;
          metadata.should.have.length(1);
          metadata[0].should.have.property('dataType', 52);
          statement.exec(['xSAP Corp Walldorf', 0.7], function (err, rows) {
            if (err) {
              return done(err);
            }
            rows.should.have.length(1);
            rows[0]['A'].toString('ascii').should.eql('SAP in Walldorf Corp');
            cb();
          });
        }
  
        function drop(cb) {
          statement.drop(function (err) {
            // ignore error
            cb();
          });
        }
        
        async.waterfall([prepareInsert, insert, prepareSelect, select, drop], done);
      });

      it('should raise input type error', function (done) {
        var statement;
        function prepare(cb) {
          var sql = 'insert into TEXT_TABLE values (?)';
          client.prepare(sql, function (err, ps) {
            statement = ps;
            cb(err);
          });
        }
        function insert(cb) {
          var values = ['Too large in length (51)---------------------------'];
          statement.exec(values, function (err) {
            err.should.be.instanceof(Error);
            cb();
          });
        }
        function drop(cb) {
          statement.drop(function (err) {
            // ignore error
            cb();
          });
        }
  
        async.waterfall([prepare, insert, drop], done)
      });
    });
  });
});