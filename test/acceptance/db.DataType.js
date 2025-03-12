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
var db = require('../db')({dataFormatSupport: 8});
var RemoteDB = require('../db/RemoteDB');
var lorem = require('../fixtures/lorem');
var util = require('../../lib/util');

var describeRemoteDB = db instanceof RemoteDB ? describe : describe.skip;
var isRemoteDB = db instanceof RemoteDB;

describe('db', function () {
  before(db.init.bind(db));
  after(db.end.bind(db));
  var client = db.client;

  // Stores all the columns names of the current table beyond the automatically
  // added ID column
  var curTableCols;

  // Sets the curTableCols based on the columns passed into a createTable function
  function setCurTableCols(columns) {
    curTableCols = [];
    for(var i = 0; i < columns.length; i++) {
      curTableCols.push(columns[i].substring(0, columns[i].indexOf(' ')));
    }
  }

  /*
    Performs the sql query and ensures the result is as expected
    - sql: Sql query to execute
    - dataTypeCodes: An array of the expected data type code(s) for each column from 
      a select all query of the table
    - expected: Expected data values from select query
    - done: Done callback to end test
  */
  function validateDataSql(sql, dataTypeCodes, expected, done) {
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
      metadata.should.have.length(dataTypeCodes.length);
      for (var i = 0; i < dataTypeCodes.length; i++) {
        if (util.isNumber(dataTypeCodes[i])) {
          metadata[i].should.have.property('dataType', dataTypeCodes[i]);
        } else {
          metadata[i].should.have.property('dataType').which.is.oneOf(dataTypeCodes[i]);
        }
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
    - dataTypeCodes: An array of the expected data type code(s) for each column from 
      a select all query of the table
    - expected: Expected data values from select query
    - done: Done callback to end test
  */
  function testDataTypeValidSql(tableName, sql, values, dataTypeCodes, expected, done) {
    var statement;
    function prepareInsert(cb) {
      var sql = `insert into ${tableName} (${curTableCols.join(',')}) values (?)`;
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
    
    async.waterfall([prepareInsert, insert, validateDataSql.bind(null, sql, dataTypeCodes, expected)], done);
  }

  // Abstraction over the custom select script above to use a generic select
  function testDataTypeValid(tableName, values, dataTypeCodes, expected, done) {
    var sql = `select ${curTableCols.join(',')} from ${tableName} order by ID`;
    
    testDataTypeValidSql(tableName, sql, values, dataTypeCodes, expected, done);
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
      var sql = `insert into ${tableName} (${curTableCols.join(',')}) values (?)`;
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
        // Tables have an ID column auto generated to preserve order between elements
        setCurTableCols(columns);
        db.createTable.bind(db)(tableName, ['ID INT GENERATED BY DEFAULT AS IDENTITY'].concat(columns), null, done);
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
        var expected = [{A: '2023-05-04'}, {A: '1990-12-31'}, {A: '0001-01-01'}, {A: '2001-02-12'},
          {A: '9999-12-31'}, {A: null}, {A: '1582-10-15'}, {A: '1582-10-04'}, {A: '1582-10-20'}];
        testDataTypeValid('DAYDATE_TABLE', insertValues, [63], expected, done);
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
        var expected = [{A: '2025-01-13 04:27:32'}, {A: '1990-12-03 10:20:29'}, {A: '0001-01-01 00:00:00'},
          {A: '2011-01-01 11:12:13'}, {A: '2000-02-29 23:59:59'}, {A: '9999-12-31 23:59:59'}, {A: null},
          {A: '1582-10-15 00:00:00'}, {A: '1582-10-04 23:59:59'}, {A: '1582-10-20 12:00:00'}];
        testDataTypeValid('SECONDDATE_TABLE', insertValues, [62], expected, done);
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
        var expected = [{A: '2025-01-13 04:27:32.789123400'}, {A: '1990-12-03 10:20:29.000000000'},
          {A: '0001-01-01 00:00:00.000000000'}, {A: '2011-01-01 11:12:13.167832000'}, {A: '2000-02-29 23:59:59.999999900'},
          {A: '9999-12-31 23:59:59.999999900'}, {A: null}, {A: '1582-10-15 00:00:00.123456700'},
          {A: '1582-10-04 23:59:59.581921200'}, {A: '1582-10-20 12:00:00.000000000'}];
        testDataTypeValid('LONGDATE_TABLE', insertValues, [61], expected, done);
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
        var expected = [{A: '04:27:32'}, {A: '10:20:29'}, {A: '00:00:00'}, {A: '11:12:13'},
          {A: '23:59:59'}, {A: null}];
        // When AM / PM are added, the result should instead be
        // var expected = [{A: '04:27:32'}, {A: '10:20:29'}, {A: '00:00:00'}, {A: '11:12:13'},
        //   {A: '23:59:59'}, {A: null}, {A: '09:09:09'}, {A: '15:28:03'}];
        testDataTypeValid('SECONDTIME_TABLE', insertValues, [64], expected, done);
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

  describeRemoteDB('ALPHANUM, TEXT, SHORTTEXT, BINTEXT (only tested on on-premise HANA)', function () {
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
          setCurTableCols(columns);
          db.createTable.bind(db)(tableName, ['ID INT GENERATED BY DEFAULT AS IDENTITY'].concat(columns), null, done);
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
        var expected = [{A: 'ABC123'}, {A: '9017123461226781'}, {A: '0000000000012893'}, {A: ''}, {A: null}];
        testDataTypeValid('ALPHANUM_TABLE', insertValues, [55], expected, done);
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
        var sql = `insert into ${tableName} (A) values (?)`;
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
        metadata.should.have.length(2);
        metadata[0].should.have.property('dataType', 3);
        metadata[1].should.have.property('dataType', dataTypeCode);
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
          [Buffer.from('Buffers can also be inserted for text', 'utf8')],
          [null],
        ];
        var expected = [{A: Buffer.from('Some regular length strings', "utf-8")},
          {A: Buffer.from('!@#$%^&*()-_=`~|}{\\:"\'<>,.?/1234567890', "utf-8")}, {A: Buffer.from(lorem.LONG, "utf-8")},
          {A: Buffer.from('', "utf-8")}, {A: Buffer.from('Buffers can also be inserted for text', "utf8")},
          {A: null}];
        testDataTypeValid('TEXT_TABLE', insertValues, [51], expected, done);
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
        var expected = [{A: 'Some regular length strings'}, {A: '!@#$%^&*()-_=`~|}{\\:"\'<>,.?/1234567890'}, 
          {A: '50 length-----------------------------------------'}, {A: ''}, {A: null}];
        testDataTypeValid('SHORTTEXT_TABLE', insertValues, [52], expected, done);
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

    describe('BINTEXT', function () {
      beforeEach(setUpTable('BINTEXT_TABLE', ['A BINTEXT'], 6));
      afterEach(dropTable('BINTEXT_TABLE', 6));

      it('should insert and return valid text via callback', function (done) {
        var insertValues = [
          [Buffer.from("Here is a regular string", "utf-8")],
          [Buffer.alloc(0)],
          ['Strings can also be used as input'],
          [''],
          [null],
        ];
        var expected = [{A: Buffer.from("Here is a regular string", "utf-8")}, {A: Buffer.alloc(0)},
          {A: Buffer.from("Strings can also be used as input", "utf-8")}, {A: Buffer.from("", "utf-8")}, {A: null}];
        testDataTypeValid('BINTEXT_TABLE', insertValues, [53], expected, done);
      });

      it('should insert binary data', function (done) {
        var expected = [{ID: 1, A: Buffer.from("6162636465666768696a6b6c6d6e6fc3a1", "hex")}];
        function insert(cb) {
          client.exec("INSERT INTO BINTEXT_TABLE VALUES(1, x'6162636465666768696a6b6c6d6e6fc3a1')", function (err, rowsAffected) {
            if (err) {
              done(err);
            }
            cb();
          });
        }
        async.waterfall([insert, validateDataSql.bind(null, "select * from BINTEXT_TABLE", [3, 53], expected)], done);
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
          testDataTypeValid('ST_GEOMETRY_TABLE', insertValues, [74], expected, done);
        });
  
        it('should return valid EWKT conversions', function (done) {
          var insertValues = [
            Buffer.from("0108000000030000000000000000000000000000000000000"
              + "0000000000000f03f000000000000f03f000000000000000000000000"
              + "00000040", "hex")
          ];
          var expected = [{EWKTEXT: Buffer.from("SRID=0;CIRCULARSTRING (0 0,1 1,0 2)", "utf8")}];
          testDataTypeValidSql('ST_GEOMETRY_TABLE', "SELECT A.ST_AsEWKT() EWKTEXT FROM ST_GEOMETRY_TABLE", insertValues, [[25, 26]], expected, done);
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
          testDataTypeValid('ST_GEOMETRY_TABLE', insertValues, [74], expected, done);
        });
  
        it('should raise input type error', function (done) {
          var invalidTestData = [
            {
              value: 'Strings must be hex in this option',
              errMessage: 'spatial error: Unexpected end of WKB at position 0: type_code=12, index=1'
            },
            {value: 12345, errMessage: 'Cannot set parameter at row: 1. Argument must be a string or Buffer'}
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
            '0101000000000000c078e91b400000000000b6a5c0',
            Buffer.from("010100000083b2f2ffadfaa3430564e1fc74b64643", "hex"),
          ];
          var insertValues = values.map(function (val) { return [val]; });
          var expected = values.map(function (val) {
            if (util.isString(val)) {
              return {A: Buffer.from(val, "hex")};
            } else {
              return {A: val};
            }
          });
          testDataTypeValid('ST_POINT_TABLE', insertValues, [75], expected, done);
        });
  
        it('should raise input type error', function (done) {
          var invalidTestData = [
            {
              value: 'Strings must be hex in this option',
              errMessage: 'spatial error: Unexpected end of WKB at position 0: type_code=12, index=1'
            },
            {value: 12345, errMessage: 'Cannot set parameter at row: 1. Argument must be a string or Buffer'}
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
          testDataTypeValid('ST_GEOMETRY_TABLE', insertValues, [74], expected, done);
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
          testDataTypeValidSql('ST_GEOMETRY_TABLE', "SELECT A.ST_AsEWKT() EWKTEXT FROM ST_GEOMETRY_TABLE", insertValues, [[25, 26]], expected, done);
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
          testDataTypeValidSql('ST_GEOMETRY_TABLE', "SELECT A.ST_AsEWKT() EWKTEXT FROM ST_GEOMETRY_TABLE", insertValues, [[25, 26]], expected, done);
        });
  
        it('should raise input type error', function (done) {
          var invalidTestData = [
            {
              value: '010100000000000000000000000000000000000000',
              errMessage: "spatial error: Invalid or unsupported geometry type '010100000000000000000000000000000000000000' at "
              + "position 0 of WKT 010100000000000000000000000000000000000000: type_code=29, index=1"
            },
            {value: 12345, errMessage: 'Cannot set parameter at row: 1. Argument must be a string or Buffer'}
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
            [Buffer.from("010100000000000000000000400000000000000840", "hex")],
            ['Point (-10 0)'],
            ['Point (0.5 0.5)'],
          ];
          var expected = [
            {A: null},
            {A: Buffer.from("010100000000000000000000400000000000000840", "hex")},
            {A: Buffer.from("010100000000000000000024c00000000000000000", "hex")},
            {A: Buffer.from("0101000000000000000000e03f000000000000e03f", "hex")}
          ];
          testDataTypeValid('ST_POINT_TABLE', insertValues, [75], expected, done);
        });
  
        it('should raise input type error', function (done) {
          var invalidTestData = [
            {
              value: '010100000000000000000024c00000000000000000',
              errMessage: "spatial error: Invalid or unsupported geometry type '010100000000000000000024c00000000000000000' at "
              + "position 0 of WKT 010100000000000000000024c00000000000000000: type_code=29, index=1"
            },
            {value: 12345, errMessage: 'Cannot set parameter at row: 1. Argument must be a string or Buffer'},
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

  describeRemoteDB('BOOLEAN', function () {
    before(setUpTableRemoteDB('BOOLEAN_TABLE', ['A BOOLEAN'], 7));
    after(dropTableRemoteDB('BOOLEAN_TABLE', 7));

    it('should add valid booleans using different parameter types', function (done) {
      var insertValues = [
        [true],
        [null],
        [false],
        [1],
        [10.5],
        [0],
        ['TRUE'],
        ['FAlsE'],
        ['UNknOwn'],
        ['1'],
        ['0'],
        [''],
      ];
      var expected = [{A: true}, {A: null}, {A: false}, {A: true}, {A: true},
        {A: false}, {A: true}, {A: false}, {A: null}, {A: true},
        {A: false}, {A: null}];
      testDataTypeValid('BOOLEAN_TABLE', insertValues, [28], expected, done);
    });

    it('should raise input type error', function (done) {
      var invalidValues = ['String not boolean', Buffer.from("01", "hex")];
      // Add the same expected error message to the values
      var invalidTestData = invalidValues.map(function (testValue) {
        return {value: testValue, errMessage: "Cannot set parameter at row: 1. Wrong input for BOOLEAN type"};
      });
      async.each(invalidTestData, testDataTypeError.bind(null, 'BOOLEAN_TABLE'), done);
    });
  });

  describeRemoteDB('FIXED', function () {
    describeRemoteDB('FIXED8', function () {
      before(setUpTableRemoteDB('FIXED8_TABLE', ['A DECIMAL(15, 5)'], 8));
      after(dropTableRemoteDB('FIXED8_TABLE', 8));

      it('should insert and return valid FIXED8 decimals', function (done) {
        var insertValues = [
          [123456],
          [-10000.123456],
          ['1234.56789101234567'],
          ['-1289128378.00000'],
          ['9999.992'],
          ['9999999999.999989'],
          [null],
          [0],
        ];
        var expected = [{A: '123456.00000'}, {A: '-10000.12346'}, {A: '1234.56789'}, {A: '-1289128378.00000'}, {A: '9999.99200'},
          {A: '9999999999.99999'}, {A: null}, {A: '0.00000'}];
        testDataTypeValid('FIXED8_TABLE', insertValues, [81], expected, done);
      });

      it('should raise input type error', function (done) {
        // Overflow validations are done one at a time, and some are done on the server, so this test can take longer
        this.timeout(3000);
        var invalidTestData = [
          // Overflows 15 digit precision with 5 decimal places
          {value: '10000000000', errMessage: 'numeric overflow: Failed in "A" column with the value 10000000000.00000'},
          {value: '-10000000000', errMessage: 'numeric overflow: Failed in "A" column with the value -10000000000.00000'},
          {value: '-9999999999.999999', errMessage: 'numeric overflow: Failed in "A" column with the value -10000000000.00000'},
          // Exceed 8 byte representation
          {value: '9223372036854775808', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED8 type'},
          {value: '-8103103283140113886353743219674022396', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED8 type'},
        ];
        async.each(invalidTestData, testDataTypeError.bind(null, 'FIXED8_TABLE'), done);
      });
    });

    describeRemoteDB('FIXED12', function () {
      before(setUpTableRemoteDB('FIXED12_TABLE', ['A DECIMAL(23, 5)'], 8));
      after(dropTableRemoteDB('FIXED12_TABLE', 8));

      it('should insert and return valid FIXED12 decimals', function (done) {
        var insertValues = [
          [9007199254740991],
          [-7289481923.5612479],
          ['61274182.56789101234567'],
          ['-128127498912.00000'],
          ['999999999999999999.992'],
          ['999999999999999999.999989'],
          [null],
          [0],
        ];
        var expected = [{A: '9007199254740991.00000'}, {A: '-7289481923.56125'}, {A: '61274182.56789'}, {A: '-128127498912.00000'},
          {A: '999999999999999999.99200'}, {A: '999999999999999999.99999'}, {A: null}, {A: '0.00000'}];
        testDataTypeValid('FIXED12_TABLE', insertValues, [82], expected, done);
      });

      it('should raise input type error', function (done) {
        // Same as before, some overflow validations are on the server, so this test can take longer
        this.timeout(3000);
        var invalidTestData = [
          // Overflows 23 digit precision with 5 decimal places
          {value: '1000000000000000000', errMessage: 'numeric overflow: Failed in "A" column with the value 1000000000000000000.00000'},
          {value: '-1000000000000000000', errMessage: 'numeric overflow: Failed in "A" column with the value -1000000000000000000.00000'},
          {value: '-999999999999999999.999999', errMessage: 'numeric overflow: Failed in "A" column with the value -1000000000000000000.00000'},
          // Exceed 12 byte representation
          {value: '39614081257132168796771975168', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED12 type'},
          {value: '-89542859971670557702231615814500106944', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED12 type'},
        ];
        async.each(invalidTestData, testDataTypeError.bind(null, 'FIXED12_TABLE'), done);
      });
    });

    describeRemoteDB('FIXED16', function () {
      before(setUpTableRemoteDB('FIXED16_TABLE', ['A DECIMAL(35, 5)'], 8));
      after(dropTableRemoteDB('FIXED16_TABLE', 8));

      it('should insert and return valid FIXED16 decimals', function (done) {
        var insertValues = [
          ['682104294101148412963771036529'],
          ['-964060612622724383174786442765.465905'],
          [18724.230],
          [-123456.903],
          ['8312612546512631264781627841.7819453'],
          ['-257283749723.00000'],
          ['999999999999999999999999999999.992'],
          ['999999999999999999999999999999.999989'],
          [null],
          [0],
        ];
        var expected = [{A: '682104294101148412963771036529.00000'}, {A: '-964060612622724383174786442765.46591'},
          {A: '18724.23000'}, {A: '-123456.90300'}, {A: '8312612546512631264781627841.78195'}, {A: '-257283749723.00000'},
          {A: '999999999999999999999999999999.99200'}, {A: '999999999999999999999999999999.99999'}, {A: null}, {A: '0.00000'}];
        testDataTypeValid('FIXED16_TABLE', insertValues, [76], expected, done);
      });

      it('should raise input type error', function (done) {
        // Same as before, some overflow validations are on the server, so this test can take longer
        this.timeout(3000);
        var invalidTestData = [
          // Overflows 35 digit precision with 5 decimal places
          {
            value: '1000000000000000000000000000000',
            errMessage: 'numeric overflow: Failed in "A" column with the value 1000000000000000000000000000000.00000'
          },
          {
            value: '-1000000000000000000000000000000',
            errMessage: 'numeric overflow: Failed in "A" column with the value -1000000000000000000000000000000.00000'
          },
          {
            value: '-999999999999999999999999999999.999999',
            errMessage: 'numeric overflow: Failed in "A" column with the value -1000000000000000000000000000000.00000'
          },
          // Overflows maximum 38 digit precision with 5 decimals
          {value: '9999999999999999999999999999999999', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED16 type'},
          {value: '-9999999999999999999999999999999999', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED16 type'},
        ];
        async.each(invalidTestData, testDataTypeError.bind(null, 'FIXED16_TABLE'), done);
      });
    });
  });
});