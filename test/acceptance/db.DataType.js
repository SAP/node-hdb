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
var db = require('../db')({dataFormatSupport: 5});
var RemoteDB = require('../db/RemoteDB');
var lorem = require('../fixtures/lorem');
var util = require('../../lib/util');

var describeRemoteDB = db instanceof RemoteDB ? describe : describe.skip;
var isRemoteDB = db instanceof RemoteDB;

describe('db', function () {
  before(db.init.bind(db));
  after(db.end.bind(db));
  var client = db.client;

  /*
    Performs the sql query and ensures the result is as expected
    - sql: Sql query to execute
    - dataTypeCode: Expected data type code(s) from a select all query of the table
    - expected: Expected data values from select query
    - done: Done callback to end test
  */
  function validateDataSql(sql, dataTypeCode, expected, done) {
    var statement;
    function prepareSelect(cb) {
      client.prepare(sql, function (err, ps) {
        if (err) done(err);
        statement = ps;
        cb(err);
      });
    }

    function select(cb) {
      var metadata = statement.resultSetMetadata;
      metadata.should.have.length(1);
      if (util.isNumber(dataTypeCode)) {
        metadata[0].should.have.property('dataType', dataTypeCode);
      } else {
        metadata[0].should.have.property('dataType').which.is.oneOf(dataTypeCode);
      }
      
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

    async.waterfall([prepareSelect, select, drop], done);
  }

  /*
    Tests the insertion and selection of valid data entries of a data type with a 
    specific query
    - tableName: Name of the db table
    - sql: Sql query to execute
    - values: Values to insert as an array
    - dataTypeCode: Expected data type code(s) from a select all query of the table
    - expected: Expected data values from select query
    - done: Done callback to end test
  */
  function testDataTypeValidSql(tableName, sql, values, dataTypeCode, expected, done) {
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
    
    async.waterfall([prepareInsert, insert, validateDataSql.bind(null, sql, dataTypeCode, expected)], done);
  }

  // Abstraction over the custom select script above to use a generic select
  function testDataTypeValid(tableName, values, dataTypeCode, expected, done) {
    var sql;
    if (dataTypeCode == 51 || dataTypeCode == 52) {
      // Default order by is not allowed for TEXT and SHORTTEXT
      sql = `select * from ${tableName} order by TO_VARCHAR(A)`;
    } else if ([53, 74, 75].includes(dataTypeCode)) {
      // Default order by is not allowed for BINTEXT, ST_GEOMETRY, and ST_POINT as well
      sql = `select * from ${tableName} order by TO_VARBINARY(A)`;
    } else {
      sql = `select * from ${tableName} order by A`;
    }
    
    testDataTypeValidSql(tableName, sql, values, dataTypeCode, expected, done);
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
  function setUpTableRemoteDB(tableName, columns, dataFormatRequired) {
    // Returns a closure which has access to the parameters above and the 'this'
    // argument will be the describe context when used in a mocha before hook
    return function setUpTableClosure(done) {
      if (isRemoteDB && db.getDataFormatVersion2() >= dataFormatRequired) {
        db.createTable.bind(db)(tableName, columns, null, done);
      } else {
        this.skip();
        done();
      }
    }
  }

  function dropTableRemoteDB(tableName, dataFormatRequired) {
    return function dropTableClosure(done) {
      if (isRemoteDB && db.getDataFormatVersion2() >= dataFormatRequired) {
        db.dropTable.bind(db)(tableName, done);
      } else {
        done();
      }
    }
  }

  describeRemoteDB('DATES', function () {
    describeRemoteDB('DAYDATE', function () {
      // Setup a daydate table only if the db is a RemoteDB and dataFormatVersion is at least 4
      before(setUpTableRemoteDB('DAYDATE_TABLE', ['A DAYDATE'], 4));
      after(dropTableRemoteDB('DAYDATE_TABLE', 4));

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
      before(setUpTableRemoteDB('SECONDDATE_TABLE', ['A SECONDDATE'], 4));
      after(dropTableRemoteDB('SECONDDATE_TABLE', 4));

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
      before(setUpTableRemoteDB('LONGDATE_TABLE', ['A LONGDATE'], 4));
      after(dropTableRemoteDB('LONGDATE_TABLE', 4));

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
      before(setUpTableRemoteDB('SECONDTIME_TABLE', ['A SECONDTIME'], 4));
      after(dropTableRemoteDB('SECONDTIME_TABLE', 4));

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

    function setUpTable(tableName, columns, dataFormatRequired) {
      // Returns a closure which has access to the parameters above and the 'this'
      // argument will be the describe context when used in a mocha before hook
      return function setUpTableClosure(done) {
        if (skipTests || db.getDataFormatVersion2() < dataFormatRequired) {
          this.skip();
          done();
        } else {
          db.createTable.bind(db)(tableName, columns, null, done);
        }
      }
    }

    function dropTable(tableName, dataFormatRequired) {
      return function dropTableClosure(done) {
        if (skipTests || db.getDataFormatVersion2() < dataFormatRequired) {
          done();
        } else {
          db.dropTable.bind(db)(tableName, done);
        }
      }
    }

    describe('ALPHANUM', function () {
      before(setUpTable('ALPHANUM_TABLE', ['A ALPHANUM(16)'], 4));
      after(dropTable('ALPHANUM_TABLE', 4));

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
      beforeEach(setUpTable('TEXT_TABLE', ['A TEXT'], 4));
      afterEach(dropTable('TEXT_TABLE', 4));

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
      beforeEach(setUpTable('SHORTTEXT_TABLE', ['A SHORTTEXT(50)'], 4));
      afterEach(dropTable('SHORTTEXT_TABLE', 4));

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

  describeRemoteDB('Spatial', function () {
    describeRemoteDB('default spatialTypes', function () {
      describeRemoteDB('ST_GEOMETRY', function () {
        beforeEach(setUpTableRemoteDB('ST_GEOMETRY_TABLE', ['A ST_GEOMETRY'], 5));
        afterEach(dropTableRemoteDB('ST_GEOMETRY_TABLE', 5));
  
        it('should return valid ST_GEOMETRY types', function (done) {
          var values = [
            null,
            '010100000000000000000000000000000000000000',
            Buffer.from("0103000000020000000400000000000000000014c00000000"
              + "0000014c0000000000000144000000000000014c00000000000000000"
              + "000000000000144000000000000014c000000000000014c0050000000"
              + "0000000000000c000000000000000c000000000000000c00000000000"
              + "000000000000000000004000000000000000000000000000000040000"
              + "00000000000c000000000000000c000000000000000c0", "hex"),
            Buffer.from("0106000000020000000103000000020000000400000000000"
              + "000000014c000000000000014c0000000000000144000000000000014"
              + "c00000000000000000000000000000144000000000000014c00000000"
              + "0000014c00500000000000000000000c000000000000000c000000000"
              + "000000c00000000000000000000000000000004000000000000000000"
              + "00000000000004000000000000000c000000000000000c00000000000"
              + "0000c0010300000001000000040000000000000000002440000000000"
              + "00014c00000000000002e400000000000001440000000000000144000"
              + "00000000001440000000000000244000000000000014c0", "hex"),
            Buffer.from("01ed0300000200000001ea030000020000000000000000002"
              + "440000000000000244000000000000024400000000000002840000000"
              + "0000002840000000000000284001ea030000020000000000000000002"
              + "c40000000000000244000000000000024400000000000003040000000"
              + "00000028400000000000002840", "hex"),
          ];
          var insertValues = values.map(function (val) { return [val]; });
          var expected = values.map(function (val) {
            if (util.isString(val)) {
              return {A: Buffer.from(val, "hex")};
            } else {
              return {A: val};
            }
          });
          testDataTypeValid('ST_GEOMETRY_TABLE', insertValues, 74, expected, done);
        });
  
        it('should return valid EWKT conversions', function (done) {
          var insertValues = [
            Buffer.from("0108000000030000000000000000000000000000000000000"
              + "0000000000000f03f000000000000f03f000000000000000000000000"
              + "00000040", "hex")
          ];
          var expected = [{EWKTEXT: Buffer.from("SRID=0;CIRCULARSTRING (0 0,1 1,0 2)", "utf8")}];
          testDataTypeValidSql('ST_GEOMETRY_TABLE', "SELECT A.ST_AsEWKT() EWKTEXT FROM ST_GEOMETRY_TABLE", insertValues, [25, 26], expected, done);
        });

        it('should insert and return large ST_GEOMETRY types', function (done) {
          // Generate a multiline's hex that is 29282 bytes
          var hexStr = "0105000000910100000";
          for (var i = 0; i < 400; i++) {
            hexStr += "1020000000400000000000000000000000000000000000000000000000000000000000000"
                    + "0000f03f000000000000f03f000000000000f03f000000000000f03f00000000000000000";
          }
          hexStr += "1020000000400000000000000000000000000000000000000000000000000000000000000"
                  + "0000f03f000000000000f03f000000000000f03f000000000000f03f0000000000000000";

          var insertValues = [[hexStr]];
          var expected = [{A: Buffer.from(hexStr, 'hex')}];
          testDataTypeValid('ST_GEOMETRY_TABLE', insertValues, 74, expected, done);
        });
  
        it('should raise input type error', function (done) {
          var invalidTestData = [
            {
              value: 'String is not supported in this option',
              errMessage: 'spatial error: Unexpected end of WKB at position 0: type_code=12, index=1'
            },
            {value: 12345, errMessage: 'Cannot set parameter at row: 1. Wrong input for BINARY type'}
          ];
          async.each(invalidTestData, testDataTypeError.bind(null, 'ST_GEOMETRY_TABLE'), done);
        });
      });
  
      describeRemoteDB('ST_POINT', function () {
        beforeEach(setUpTableRemoteDB('ST_POINT_TABLE', ['A ST_POINT'], 5));
        afterEach(dropTableRemoteDB('ST_POINT_TABLE', 5));
  
        it('should return valid ST_POINT types', function (done) {
          var values = [
            null,
            Buffer.from("010100000000000000000024400000000000003440", "hex"),
            Buffer.from("010100000083b2f2ffadfaa3430564e1fc74b64643", "hex"),
          ];
          var insertValues = values.map(function (val) { return [val]; });
          var expected = values.map(function (val) { return {A: val}; });
          testDataTypeValid('ST_POINT_TABLE', insertValues, 75, expected, done);
        });
  
        it('should raise input type error', function (done) {
          var invalidTestData = [
            {
              value: 'String spatial input is not supported in this option',
              errMessage: 'spatial error: Unexpected end of WKB at position 0: type_code=12, index=1'
            },
            {value: 12345, errMessage: 'Cannot set parameter at row: 1. Wrong input for BINARY type'}
          ];
          async.each(invalidTestData, testDataTypeError.bind(null, 'ST_POINT_TABLE'), done);
        });
      });
    });

    describeRemoteDB('spatialTypes 1 (direct from WKT)', function () {
      before(function spatialTypesReconnect(done) {
        db.client.set('spatialTypes', 1);
        db.end(function (err) {
          db.init(done);
        })
      });

      describeRemoteDB('ST_GEOMETRY', function () {
        beforeEach(setUpTableRemoteDB('ST_GEOMETRY_TABLE', ['A ST_GEOMETRY(4326)'], 5));
        afterEach(dropTableRemoteDB('ST_GEOMETRY_TABLE', 5));
  
        it('should return valid ST_GEOMETRY types', function (done) {
          var insertValues = [
            [null],
            [Buffer.from("010100000000000000000024400000000000002440", "hex")],
            ['MultiLineString ((10 10, 12 12), (14 10, 16 12))'],
            ['GeometryCollection (LineString(5 10, 10 12, 15 10), Polygon ((10 -5, 15 5, 5 5, 10 -5)))'],
            ['MultiPolygon Z(((-5 -5 4, 5 -5 7, 0 5 1, -5 -5 4), (-2 -2 9, -2 0 4, 2 0 4, 2 -2 1, -2 -2 9)), ((10 -5 2, 15 5 2, 5 5 3, 10 -5 2)))'],
          ];
          var expected = [
            {A: null},
            {A: Buffer.from("010100000000000000000024400000000000002440", "hex")},
            {A: Buffer.from("010500000002000000010200000002000000000000000"
              + "000244000000000000024400000000000002840000000000000284001"
              + "02000000020000000000000000002c400000000000002440000000000"
              + "00030400000000000002840", "hex")},
            {A: Buffer.from("010700000002000000010200000003000000000000000"
              + "000144000000000000024400000000000002440000000000000284000"
              + "00000000002e400000000000002440010300000001000000040000000"
              + "00000000000244000000000000014c00000000000002e400000000000"
              + "001440000000000000144000000000000014400000000000002440000"
              + "00000000014c0", "hex")},
            {A: Buffer.from("01ee0300000200000001eb03000002000000040000000"
              + "0000000000014c000000000000014c000000000000010400000000000"
              + "00144000000000000014c00000000000001c400000000000000000000"
              + "0000000001440000000000000f03f00000000000014c0000000000000"
              + "14c000000000000010400500000000000000000000c00000000000000"
              + "0c0000000000000224000000000000000c00000000000000000000000"
              + "000000104000000000000000400000000000000000000000000000104"
              + "0000000000000004000000000000000c0000000000000f03f00000000"
              + "000000c000000000000000c0000000000000224001eb0300000100000"
              + "004000000000000000000244000000000000014c00000000000000040"
              + "0000000000002e4000000000000014400000000000000040000000000"
              + "000144000000000000014400000000000000840000000000000244000"
              + "000000000014c00000000000000040", "hex")}
          ];
          testDataTypeValid('ST_GEOMETRY_TABLE', insertValues, 74, expected, done);
        });
  
        it('should return valid EWKT conversions', function (done) {
          var insertValues = [
            ['LineString ZM(0 0 3 6, 5 10 4 8)'],
            ['MultiPoint ZM((10 10 12 1), (12 12 14 1), (14 10 10 1))'],
          ];
          var expected = [
            {EWKTEXT: Buffer.from("SRID=4326;LINESTRING ZM (0 0 3 6,5 10 4 8)", "utf8")},
            {EWKTEXT: Buffer.from("SRID=4326;MULTIPOINT ZM ((10 10 12 1),(12 12 14 1),(14 10 10 1))", "utf8")},
          ];
          testDataTypeValidSql('ST_GEOMETRY_TABLE', "SELECT A.ST_AsEWKT() EWKTEXT FROM ST_GEOMETRY_TABLE", insertValues, [25, 26], expected, done);
        });

        it('should insert and return large ST_GEOMETRY types', function (done) {
          var xMax = 30;
          var yMax = 30;

          // Generate multilines that are 21,155 bytes long
          var lines = "MULTILINESTRING ((0 0,0 1,1 1,1 0)";
          for (var x = 0; x < xMax; x++) {
            var x1 = x + 1;
            for (var y = 0; y < yMax; y++) {
              var y1 = y + 1;
              lines += ",(" + x + " " + y + "," + x + " " + y1 + "," + y1 + " " + x1
                + "," + x1 + " " + y + ")";
            }
          }
          lines += ")";

          var insertValues = [[lines]];
          var expected = [{EWKTEXT: Buffer.from("SRID=4326;" + lines, "utf8")}];
          testDataTypeValidSql('ST_GEOMETRY_TABLE', "SELECT A.ST_AsEWKT() EWKTEXT FROM ST_GEOMETRY_TABLE", insertValues, [25, 26], expected, done);
        });
  
        it('should raise input type error', function (done) {
          var invalidTestData = [
            {
              value: '010100000000000000000000000000000000000000',
              errMessage: "spatial error: Invalid or unsupported geometry type '010100000000000000000000000000000000000000' at "
              + "position 0 of WKT 010100000000000000000000000000000000000000: type_code=29, index=1"
            },
            {value: 12345, errMessage: 'Cannot set parameter at row: 1. Argument must be a string'}
          ];
          async.each(invalidTestData, testDataTypeError.bind(null, 'ST_GEOMETRY_TABLE'), done);
        });
      });

      describeRemoteDB('ST_POINT', function () {
        beforeEach(setUpTableRemoteDB('ST_POINT_TABLE', ['A ST_POINT'], 5));
        afterEach(dropTableRemoteDB('ST_POINT_TABLE', 5));
  
        it('should return valid ST_POINT types', function (done) {
          var insertValues = [
            [null],
            ['Point (-10 0)'],
            ['Point (0.5 0.5)'],
          ];
          var expected = [
            {A: null},
            {A: Buffer.from("010100000000000000000024c00000000000000000", "hex")},
            {A: Buffer.from("0101000000000000000000e03f000000000000e03f", "hex")}
          ];
          testDataTypeValid('ST_POINT_TABLE', insertValues, 75, expected, done);
        });
  
        it('should raise input type error', function (done) {
          var invalidTestData = [
            {
              value: '010100000000000000000024c00000000000000000',
              errMessage: "spatial error: Invalid or unsupported geometry type '010100000000000000000024c00000000000000000' at "
              + "position 0 of WKT 010100000000000000000024c00000000000000000: type_code=29, index=1"
            },
            {value: 12345, errMessage: 'Cannot set parameter at row: 1. Argument must be a string'},
            {
              value: 'Point Z(10 20 30)',
              errMessage: "spatial error: exception 1620502: The geometry type 'ST_Point' with dimension 'XYZ' is not allowed in "
              + "column of type ST_POINT due to column constraints, which only allows 2-dimensional ST_Point types\n: type_code=29, index=1"
            }
          ];
          async.each(invalidTestData, testDataTypeError.bind(null, 'ST_POINT_TABLE'), done);
        });
      });
    });
  });
});