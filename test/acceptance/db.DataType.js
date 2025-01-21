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
var db = require('../db')({dataFormatSupport: 4});
var RemoteDB = require('../db/RemoteDB');
var lorem = require('../fixtures/lorem');

var describeRemoteDB = db instanceof RemoteDB ? describe : describe.skip;
var isRemoteDB = db instanceof RemoteDB;

describe('db', function () {
  before(db.init.bind(db));
  after(db.end.bind(db));
  var client = db.client;

  /*
    Tests the insertion and selection of valid data entries of a data type
    - tableName: Name of the db table
    - values: Values to insert as an array
    - dataTypeCode: Expected data type code from a select all query of the table
    - expected: Expected data values from select query
    - done: Done callback to end test
  */
  function testDataTypeValid(tableName, values, dataTypeCode, expected, done) {
    var statement;
    function prepareInsert(cb) {
      var sql = `insert into ${tableName} values (?)`;
      client.prepare(sql, function (err, ps) {
        statement = ps;
        cb(err);
      });
    }

    function insert(cb) {
      statement.exec(values, function (rowsAffected) {
        statement.drop();
        cb();
      });
    }

    function prepareSelect(cb) {
      var sql;
      if (dataTypeCode == 51 || dataTypeCode == 52) {
        // Default order by is not allowed for TEXT and SHORTTEXT
        sql = `select * from ${tableName} order by TO_VARCHAR(A)`;
      } else {
        sql = `select * from ${tableName} order by A`;
      }
      client.prepare(sql, function (err, ps) {
        if (err) done(err);
        statement = ps;
        cb(err);
      });
    }

    function select(cb) {
      var metadata = statement.resultSetMetadata;
      metadata.should.have.length(1);
      metadata[0].should.have.property('dataType', dataTypeCode);
      statement.exec([], function (err, rows) {
        if (err) {
          return done(err);
        }
        rows.should.have.length(expected.length);
        rows.should.eql(expected);
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
  }

  /*
    Tests the insertion of a single invalid data type entry
    - tableName: Name of the db table
    - testData: Object
      - testData.value: Invalid data value to insert
      - testData.errMessage: Expected error message to receive
    - cb: Callback function
  */
  function testDataTypeError(tableName, testData, callback) {
    var statement;
    function prepare(cb) {
      var sql = `insert into ${tableName} values (?)`;
      client.prepare(sql, function (err, ps) {
        statement = ps;
        cb(err);
      });
    }
    function insert(cb) {
      statement.exec([testData.value], function (err) {
        err.should.be.instanceof(Error);
        err.message.should.equal(testData.errMessage);
        cb();
      });
    }
    function drop(cb) {
      statement.drop(function (err) {
        // ignore error
        cb();
      });
    }

    async.waterfall([prepare, insert, drop], callback);
  }

  // Functions used to setup and drop tables only when the db is a RemoteDB
  function setUpTableRemoteDB(tableName, columns, done) {
    if (isRemoteDB) {
      db.createTable.bind(db)(tableName, columns, null, done);
    } else {
      done();
    }
  }

  function dropTableRemoteDB(tableName, done) {
    if (isRemoteDB) {
      db.dropTable.bind(db)(tableName, done);
    } else {
      done();
    }
  }

  describeRemoteDB('DATES', function () {
    describeRemoteDB('DAYDATE', function () {
      // Setup a daydate table only if the db is a RemoteDB
      before(setUpTableRemoteDB.bind(null, 'DAYDATE_TABLE', ['A DAYDATE']));
      after(dropTableRemoteDB.bind(null, 'DAYDATE_TABLE'));

      it('should return valid date via callback', function (done) {
        var insertValues = [
          ['2023-05-04'],
          ['1990-12-31'],
          ['0001-01-01'],
          ['2001-02-12 08:30:00'],
          ['9999-12-31'],
          [null],
          ['1582-10-15'],
          ['1582-10-04'],
          ['1582-10-10'],
        ];
        var expected = [{A: null}, {A: "0001-01-01"}, {A: "1582-10-04"}, {A: "1582-10-15"}, {A: "1582-10-20"},
          {A: "1990-12-31"}, {A: "2001-02-12"}, {A: "2023-05-04"}, {A: "9999-12-31"}];
        testDataTypeValid('DAYDATE_TABLE', insertValues, 63, expected, done);
      });

      it('should raise input type error', function (done) {
        var invalidTestData = [{value: '2460684', errMessage: "Cannot set parameter at row: 1. Wrong input for DATE type"},
          {value: '10000-01-12', errMessage: "Cannot set parameter at row: 1. Wrong input for DAYDATE type"},
          {value: '2020-14-20', errMessage: "Cannot set parameter at row: 1. Wrong input for DAYDATE type"}];
        async.each(invalidTestData, testDataTypeError.bind(null, 'DAYDATE_TABLE'), done);
      });
    });

    describeRemoteDB('SECONDDATE', function () {
      before(setUpTableRemoteDB.bind(null, 'SECONDDATE_TABLE', ['A SECONDDATE']));
      after(dropTableRemoteDB.bind(null, 'SECONDDATE_TABLE'));

      it('should return valid dates via callback', function (done) {
        var insertValues = [
          ['2025-01-13 04:27:32.7891234'],
          ['1990-12-03 10:20:29'],
          ['0001-01-01 00:00:00'],
          ['2011-01-01 11:12:13.167832'],
          ['2000-02-29 23:59:59.9999999'],
          ['9999-12-31 23:59:59'],
          [null],
          ['1582-10-15 00:00:00'],
          ['1582-10-04 23:59:59'],
          ['1582-10-10 12:00:00'],
        ];
        var expected = [{A: null}, {A: "0001-01-01 00:00:00"}, {A: "1582-10-04 23:59:59"}, {A: "1582-10-15 00:00:00"}, {A: "1582-10-20 12:00:00"},
          {A: "1990-12-03 10:20:29"}, {A: "2000-02-29 23:59:59"}, {A: "2011-01-01 11:12:13"}, {A: "2025-01-13 04:27:32"}, {A: "9999-12-31 23:59:59"}];
        testDataTypeValid('SECONDDATE_TABLE', insertValues, 62, expected, done);
      });

      it('should raise input type error', function (done) {
        var invalidValues = ['2015-02-10', '10000-01-12 14:01:02', '1998-06-25 25:59:59'];
        // Add the same expected error message to the values
        var invalidTestData = invalidValues.map(function (testValue) {
          return {value: testValue, errMessage: "Cannot set parameter at row: 1. Wrong input for SECONDDATE type"};
        });
        async.each(invalidTestData, testDataTypeError.bind(null, 'SECONDDATE_TABLE'), done);
      });
    });

    describeRemoteDB('LONGDATE', function () {
      before(setUpTableRemoteDB.bind(null, 'LONGDATE_TABLE', ['A LONGDATE']));
      after(dropTableRemoteDB.bind(null, 'LONGDATE_TABLE'));

      it('should return valid dates via callback', function (done) {
        var insertValues = [
          ['2025-01-13 04:27:32.7891234'],
          ['1990-12-03 10:20:29'],
          ['0001-01-01 00:00:00'],
          ['2011-01-01 11:12:13.167832'],
          ['2000-02-29 23:59:59.9999999'],
          ['9999-12-31 23:59:59.9999999'],
          [null],
          ['1582-10-15 00:00:00.1234567'],
          ['1582-10-04 23:59:59.5819212'],
          ['1582-10-10 12:00:00'],
        ];
        var expected = [{A: null}, {A: "0001-01-01 00:00:00.000000000"}, {A: "1582-10-04 23:59:59.581921200"}, {A: "1582-10-15 00:00:00.123456700"},
          {A: "1582-10-20 12:00:00.000000000"}, {A: "1990-12-03 10:20:29.000000000"}, {A: "2000-02-29 23:59:59.999999900"},
          {A: "2011-01-01 11:12:13.167832000"}, {A: "2025-01-13 04:27:32.789123400"}, {A: "9999-12-31 23:59:59.999999900"}];
        testDataTypeValid('LONGDATE_TABLE', insertValues, 61, expected, done);
      });

      it('should raise input type error', function (done) {
        var invalidValues = ['2015-02-10', '10000-01-12 14:01:02', '1998-06-25 25:59:59', '1900-02-29 12:00:00', '0000-00-00 12:00:00'];
        // Add the same expected error message to the values
        var invalidTestData = invalidValues.map(function (testValue) {
          return {value: testValue, errMessage: "Cannot set parameter at row: 1. Wrong input for LONGDATE type"};
        });
        async.each(invalidTestData, testDataTypeError.bind(null, 'LONGDATE_TABLE'), done);
      });
    });

    describeRemoteDB('SECONDTIME', function () {
      before(setUpTableRemoteDB.bind(null, 'SECONDTIME_TABLE', ['A SECONDTIME']));
      after(dropTableRemoteDB.bind(null, 'SECONDTIME_TABLE'));

      it('should return valid times via callback', function (done) {
        var insertValues = [
          ['04:27:32.7891234'],
          ['10:20:29'],
          ['00:00:00'],
          ['11:12:13.167832'],
          ['23:59:59.9999999'],
          [null],
          // ['9:9:9 AM'],
          // ['3:28:03 PM']
        ];
        var expected = [{A: null}, {A: "00:00:00"}, {A: "04:27:32"}, {A: "10:20:29"}, {A: "11:12:13"}, {A: "23:59:59"}];
        // When AM / PM are added, the result should instead be
        // var expected = [{A: null}, {A: "00:00:00"}, {A: "04:27:32"}, {A: "09:09:09"}, {A: "10:20:29"}, {A: "11:12:13"}, {A: "15:28:03"}, {A: "23:59:59"}];
        testDataTypeValid('SECONDTIME_TABLE', insertValues, 64, expected, done);
      });

      it('should raise input type error', function (done) {
        var invalidValues = ['2015-02-10', '11:50:62', '24:00:01', '00:00-01', '11:60:02'];
        // Add the same expected error message to the values
        var invalidTestData = invalidValues.map(function (testValue) {
          return {value: testValue, errMessage: "Cannot set parameter at row: 1. Wrong input for SECONDTIME type"};
        });
        async.each(invalidTestData, testDataTypeError.bind(null, 'SECONDTIME_TABLE'), done);
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

    function setUpTable(tableName, columns, done) {
      if (skipTests) {
        done();
      } else {
        db.createTable.bind(db)(tableName, columns, null, done);
      }
    }
  
    function dropTable(tableName, done) {
      if (skipTests) {
        done();
      } else {
        db.dropTable.bind(db)(tableName, done);
      }
    }

    describe('ALPHANUM', function () {
      before(setUpTable.bind(null, 'ALPHANUM_TABLE', ['A ALPHANUM(16)']));
      after(dropTable.bind(null, 'ALPHANUM_TABLE'));

      it('should return valid alphanums via callback', function (done) {
        var insertValues = [
          ['ABC123'],
          ['9017123461226781'],
          ['12893'],
          [''],
          [null],
        ];
        var expected = [{A: null}, {A: ""}, {A: "0000000000012893"}, {A: "9017123461226781"}, {A: "ABC123"}];
        testDataTypeValid('ALPHANUM_TABLE', insertValues, 55, expected, done);
      });
  
      it('should raise input type error', function (done) {
        var invalidTestData = [{value: 'ABCDEFG1234567890',
          errMessage: 'inserted value too large for column: Failed in "A" column with the value \'ABCDEFG1234567890\''}];
        async.each(invalidTestData, testDataTypeError.bind(null, 'ALPHANUM_TABLE'), done);
      });
    });

    function testFuzzySearch(tableName, dataTypeCode, done) {
      var statement;
      function prepareInsert(cb) {
        var sql = `insert into ${tableName} values (?)`;
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
        var sql = `select * from ${tableName} WHERE CONTAINS(A, ?, FUZZY(?, 'textSearch=compare,bestMatchingTokenWeight=0.7'))`;
        client.prepare(sql, function (err, ps) {
          statement = ps;
          cb(err);
        });
      }

      function select(cb) {
        var metadata = statement.resultSetMetadata;
        metadata.should.have.length(1);
        metadata[0].should.have.property('dataType', dataTypeCode);
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
    }

    describe('TEXT', function () {
      before(setUpTable.bind(null, 'TEXT_TABLE', ['A TEXT']));
      after(dropTable.bind(null, 'TEXT_TABLE'));

      it('should insert and return valid text via callback', function (done) {
        var insertValues = [
          ['Some regular length strings'],
          ['!@#$%^&*()-_=`~|}{\\:"\'<>,.?/1234567890'],
          [lorem.LONG],
          [''],
          [null],
        ];
        var expected = [{A: null}, {A: Buffer.from('', "utf-8")}, {A: Buffer.from('!@#$%^&*()-_=`~|}{\\:"\'<>,.?/1234567890', "utf-8")},
          {A: Buffer.from(lorem.LONG, "utf-8")}, {A: Buffer.from('Some regular length strings', "utf-8")}];
        testDataTypeValid('TEXT_TABLE', insertValues, 51, expected, done);
      });
  
      it('should support fuzzy search', function (done) {
        testFuzzySearch('TEXT_TABLE', 51, done);
      });
    });

    describe('SHORTTEXT', function () {
      before(setUpTable.bind(null, 'SHORTTEXT_TABLE', ['A SHORTTEXT(50)']));
      after(dropTable.bind(null, 'SHORTTEXT_TABLE'));

      it('should insert and return valid text via callback', function (done) {
        var insertValues = [
          ['Some regular length strings'],
          ['!@#$%^&*()-_=`~|}{\\:"\'<>,.?/1234567890'],
          ['50 length-----------------------------------------'],
          [''],
          [null],
        ];
        var expected = [{A: null}, {A: ''}, {A: '!@#$%^&*()-_=`~|}{\\:"\'<>,.?/1234567890'},
          {A: '50 length-----------------------------------------'}, {A: 'Some regular length strings'}];
        testDataTypeValid('SHORTTEXT_TABLE', insertValues, 52, expected, done);
      });
  
      it('should support fuzzy search', function (done) {
        testFuzzySearch('SHORTTEXT_TABLE', 52, done);
      });

      it('should raise input type error', function (done) {
        var invalidTestData = [{value: 'Too large in length (51)---------------------------',
          errMessage: 'inserted value too large for column: Failed in "A" column with the value \'Too large in length (51)---------------------------\''}];
        async.each(invalidTestData, testDataTypeError.bind(null, 'SHORTTEXT_TABLE'), done);
      });
    });
  });
});