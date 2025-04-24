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
const ORGINAL_DATA_FORMAT = 7;
var db = require('../db')({dataFormatSupport: ORGINAL_DATA_FORMAT});
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
      var sql = `insert into ${tableName} (${curTableCols.join(',')}) values `
      + `(${Array(curTableCols.length).fill('?').join(',')})`;
      client.prepare(sql, function (err, ps) {
        statement = ps;
        cb(err);
      });
    }

    function insert(cb) {
      statement.exec(values, function (err, rowsAffected) {
        if (err) cb(err);
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
      var sql = `insert into ${tableName} (${curTableCols.join(',')}) values `
      + `(${Array(curTableCols.length).fill('?').join(',')})`;
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

  // Indicator to skip tests and test setup (some tests are only run on HANA cloud / on premise)
  var skipTests = false;

  // Functions used to setup and drop tables only when the db is a RemoteDB, we are not skipping the test,
  // and the data format is greater or equal to that required.
  function setUpTable(tableName, columns, dataFormatRequired) {
    // Returns a closure which has access to the parameters above and the 'this'
    // argument will be the describe context when used in a mocha before hook
    return function setUpTableClosure(done) {
      if (isRemoteDB && !skipTests && db.getDataFormatVersion2() >= dataFormatRequired) {
        // Tables have an ID column auto generated to preserve order between elements
        setCurTableCols(columns);
        db.createTable.bind(db)(tableName, ['ID INT GENERATED BY DEFAULT AS IDENTITY'].concat(columns), null, done);
      } else {
        this.skip();
        done();
      }
    }
  }

  function dropTable(tableName, dataFormatRequired) {
    return function dropTableClosure(done) {
      if (isRemoteDB && !skipTests && db.getDataFormatVersion2() >= dataFormatRequired) {
        db.dropTable.bind(db)(tableName, done);
      } else {
        done();
      }
    }
  }

  // Function used to skip all tests if running on HANA cloud until reset skip is called
  function setSkipHANACloud (done) {
    var version = db.getHANAFullVersion();
    if (version === undefined || version.startsWith("4.")) { // Skip tests on HANA cloud
      skipTests = true;
      this.test.parent.pending = true;
      this.skip();
    }
    done();
  }

  function resetSkip(done) {
    skipTests = false;
    done();
  }

  // Function used to reconnect to the db with a new data format version
  function changeDataFormatSupport(newDataFormat) {
    return function DFVReconnect(done) {
      if (isRemoteDB) {
        db.client.set('dataFormatSupport', newDataFormat);
        db.end(function (err) {
          db.init(done);
        });
      } else {
        done();
      }
    }
  }

  // DFV 4 types also includes BINTEXT (DFV 6) to group it within the on-premise HANA only types
  describeRemoteDB('DFV 4 types', function () {
    // DAYDATE
    var daydateInsertValues = [
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
    var daydateExpected = [{A: '2023-05-04'}, {A: '1990-12-31'}, {A: '0001-01-01'}, {A: '2001-02-12'},
      {A: '9999-12-31'}, {A: null}, {A: '1582-10-15'}, {A: '1582-10-04'}, {A: '1582-10-20'}];
    var daydateInvalidTestDataDFV4 = [
      {value: '2460684', errMessage: "Cannot set parameter at row: 1. Wrong input for DATE type"},
      {value: '10000-01-12', errMessage: "Cannot set parameter at row: 1. Wrong input for DAYDATE type"},
      {value: '2020-14-20', errMessage: "Cannot set parameter at row: 1. Wrong input for DAYDATE type"}
    ];
    // In DFV1, some error messages are derived from the server
    var daydateInvalidTestDataDFV1 = [
      {value: '2460684', errMessage: "Cannot set parameter at row: 1. Wrong input for DATE type"},
      {value: '10000-01-12', errMessage: "invalid DATE, TIME or TIMESTAMP value: year must be between "
        + "-4713 and +9999, and not be 0: 0: type_code=14, index=1"},
      {value: '2020-14-20', errMessage: "invalid DATE, TIME or TIMESTAMP value: not a valid month: 14: "
        + "type_code=14, index=1"}
    ];

    // SECONDDATE
    var secondDateInsertValues = [
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
    var secondDateExpectedDFV4 = [{A: '2025-01-13 04:27:32'}, {A: '1990-12-03 10:20:29'}, {A: '0001-01-01 00:00:00'},
      {A: '2011-01-01 11:12:13'}, {A: '2000-02-29 23:59:59'}, {A: '9999-12-31 23:59:59'}, {A: null},
      {A: '1582-10-15 00:00:00'}, {A: '1582-10-04 23:59:59'}, {A: '1582-10-20 12:00:00'}];
    // In DFV1, values are returned as TIMESTAMP's which have a T instead of space between
    var secondDateExpectedDFV1 = secondDateExpectedDFV4.map(function (row) {
      if (row.A) {
        return {A: row.A.replace(' ', 'T')};
      } else {
        return row;
      }
    });
    var secondDateInvalidValues = ['2015-02-10', '10000-01-12 14:01:02', '1998-06-25 25:59:59'];
    // Add the same expected error message to the values for DFV4
    var secondDateInvalidTestDataDFV4 = secondDateInvalidValues.map(function (testValue) {
      return {value: testValue, errMessage: "Cannot set parameter at row: 1. Wrong input for SECONDDATE type"};
    });
    var secondDateInvalidTestDataDFV1 = [
      {value: '2015-02-10', errMessage: "Cannot set parameter at row: 1. Wrong input for TIMESTAMP type"},
      {value: '10000-01-12 14:01:02', errMessage: "invalid DATE, TIME or TIMESTAMP value: year must be between "
        + "-4713 and +9999, and not be 0: 0: type_code=16, index=1"},
      {value: '1998-06-25 25:59:59', errMessage: "invalid DATE, TIME or TIMESTAMP value: not a valid hour: 25: "
        + "type_code=16, index=1"},
    ];

    // LONGDATE
    var longDateInsertValues = [
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
    var longDateExpectedDFV4 = [{A: '2025-01-13 04:27:32.789123400'}, {A: '1990-12-03 10:20:29.000000000'},
      {A: '0001-01-01 00:00:00.000000000'}, {A: '2011-01-01 11:12:13.167832000'}, {A: '2000-02-29 23:59:59.999999900'},
      {A: '9999-12-31 23:59:59.999999900'}, {A: null}, {A: '1582-10-15 00:00:00.123456700'},
      {A: '1582-10-04 23:59:59.581921200'}, {A: '1582-10-20 12:00:00.000000000'}];
    // In DFV1, values are TIMESTAMP's which have lower precision and have a T instead of a space
    var longDateExpectedDFV1 = [{A: '2025-01-13T04:27:32.789'}, {A: '1990-12-03T10:20:29'},
      {A: '0001-01-01T00:00:00'}, {A: '2011-01-01T11:12:13.167'}, {A: '2000-02-29T23:59:59.999'},
      {A: '9999-12-31T23:59:59.999'}, {A: null}, {A: '1582-10-15T00:00:00.123'},
      {A: '1582-10-04T23:59:59.581'}, {A: '1582-10-20T12:00:00'}];
    var longDateInvalidValues = ['2015-02-10', '10000-01-12 14:01:02', '1998-06-25 25:59:59', '1900-02-29 12:00:00',
      '0000-00-00 12:00:00'];
    var longDateInvalidTestDataDFV4 = longDateInvalidValues.map(function (testValue) {
      return {value: testValue, errMessage: "Cannot set parameter at row: 1. Wrong input for LONGDATE type"};
    });
    var longDateInvalidTestDataDFV1 = [
      {value: '2015-02-10', errMessage: "Cannot set parameter at row: 1. Wrong input for TIMESTAMP type"},
      {value: '10000-01-12 14:01:02', errMessage: "invalid DATE, TIME or TIMESTAMP value: year must be between "
        + "-4713 and +9999, and not be 0: 0: type_code=16, index=1"},
      {value: '1998-06-25 25:59:59', errMessage: "invalid DATE, TIME or TIMESTAMP value: not a valid hour: 25: "
        + "type_code=16, index=1"},
      {value: '1900-02-29 12:00:00', errMessage: "invalid DATE, TIME or TIMESTAMP value: day of month must be "
        + "between 1 and last day of month: 29: type_code=16, index=1"},
      {value: '0000-00-00 12:00:00', errMessage: "invalid DATE, TIME or TIMESTAMP value: year must be between "
        + "-4713 and +9999, and not be 0: 0: type_code=16, index=1"},
    ];
    
    // SECONDTIME
    var secondTimeInsertValues = [
      ['04:27:32.7891234'],
      ['10:20:29'],
      ['00:00:00'],
      ['11:12:13.167832'],
      ['23:59:59.9999999'],
      [null],
      // ['9:9:9 AM'],
      // ['3:28:03 PM']
    ];
    var secondTimeExpected = [{A: '04:27:32'}, {A: '10:20:29'}, {A: '00:00:00'}, {A: '11:12:13'},
      {A: '23:59:59'}, {A: null}];
    // When AM / PM are added, the result should instead be
    // var secondTimeExpected = [{A: '04:27:32'}, {A: '10:20:29'}, {A: '00:00:00'}, {A: '11:12:13'},
    //   {A: '23:59:59'}, {A: null}, {A: '09:09:09'}, {A: '15:28:03'}];
    var secondTimeInvalidValues = ['2015-02-10', '11:50:62', '24:00:01', '00:00-01', '11:60:02'];
    var secondTimeInvalidTestDataDFV4 = secondTimeInvalidValues.map(function (testValue) {
      return {value: testValue, errMessage: "Cannot set parameter at row: 1. Wrong input for SECONDTIME type"};
    });
    var secondTimeInvalidTestDataDFV1 = [
      {value: '2015-02-10', errMessage: "Cannot set parameter at row: 1. Wrong input for TIME type"},
      {value: '11:50:62', errMessage: "invalid DATE, TIME or TIMESTAMP value: not a valid millisecond: "
        + "62000: type_code=15, index=1"},
      {value: '24:00:01', errMessage: "invalid DATE, TIME or TIMESTAMP value: not a valid hour: 24: type_code=15, index=1"},
      {value: '00:00-01', errMessage: "Cannot set parameter at row: 1. Wrong input for TIME type"},
      {value: '11:60:02', errMessage: "invalid DATE, TIME or TIMESTAMP value: not a valid minute: 60: type_code=15, index=1"},
    ];

    // ALPHANUM
    var alphanumInsertValues = [
      ['ABC123'],
      ['9017123461226781'],
      ['12893'],
      [''],
      [null],
    ];
    var alphanumExpected = [{A: 'ABC123'}, {A: '9017123461226781'}, {A: '0000000000012893'}, {A: ''}, {A: null}];
    var alphanumInvalidTestData = [{value: 'ABCDEFG1234567890',
      errMessage: 'inserted value too large for column: Failed in "A" column with the value \'ABCDEFG1234567890\''}];

    // TEXT
    var textInsertValues = [
      ['Some regular length strings'],
      ['!@#$%^&*()-_=`~|}{\\:"\'<>,.?/1234567890'],
      [lorem.LONG],
      [''],
      [Buffer.from('Buffers can also be inserted for text', 'utf8')],
      [null],
    ];
    var textExpected = [{A: Buffer.from('Some regular length strings', "utf-8")},
      {A: Buffer.from('!@#$%^&*()-_=`~|}{\\:"\'<>,.?/1234567890', "utf-8")}, {A: Buffer.from(lorem.LONG, "utf-8")},
      {A: Buffer.from('', "utf-8")}, {A: Buffer.from('Buffers can also be inserted for text', "utf8")},
      {A: null}];

    // SHORTTEXT
    var shortTextInsertValues = [
      ['Some regular length strings'],
      ['!@#$%^&*()-_=`~|}{\\:"\'<>,.?/1234567890'],
      ['50 length-----------------------------------------'],
      [''],
      [null],
    ];
    var shortTextExpected = [{A: 'Some regular length strings'}, {A: '!@#$%^&*()-_=`~|}{\\:"\'<>,.?/1234567890'}, 
      {A: '50 length-----------------------------------------'}, {A: ''}, {A: null}];
    var shortTextInvalidTestData = [{value: 'Too large in length (51)---------------------------',
      errMessage: 'inserted value too large for column: Failed in "A" column with the value \'Too large in length (51)---------------------------\''}];

    // BINTEXT
    var binTextInsertValues = [
      [Buffer.from("Here is a regular string", "utf-8")],
      [Buffer.alloc(0)],
      ['Strings can also be used as input'],
      [''],
      [null],
    ];
    var binTextExpected = [{A: Buffer.from("Here is a regular string", "utf-8")}, {A: Buffer.alloc(0)},
      {A: Buffer.from("Strings can also be used as input", "utf-8")}, {A: Buffer.from("", "utf-8")}, {A: null}];
    var binTextInvalidValues = [Buffer.from('61c7', 'hex'), Buffer.from('c7', 'hex'), Buffer.from('f09f9880f09f9988', 'hex'),
      Buffer.from('010100000083b2f2ffadfaa3430564e1fc74b64643', 'hex'), false, 123];
    var binTextInvalidTestData = binTextInvalidValues.map(function (testValue) {
      if (Buffer.isBuffer(testValue)) {
        return {value: testValue, errMessage: "fatal error: invalid CESU-8 encoding for Unicode string"};
      } else {
        return {value: testValue, errMessage: "Cannot set parameter at row: 1. Wrong input for LOB type"};
      }
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

    describeRemoteDB('DFV >= 4', function () {
      describeRemoteDB('DATES', function () {
        describeRemoteDB('DAYDATE', function () {
          // Setup a daydate table only if the db is a RemoteDB and dataFormatVersion is at least 4
          before(setUpTable('DAYDATE_TABLE', ['A DAYDATE'], 4));
          after(dropTable('DAYDATE_TABLE', 4));
    
          it('should return valid date via callback', function (done) {
            testDataTypeValid('DAYDATE_TABLE', daydateInsertValues, [63], daydateExpected, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(daydateInvalidTestDataDFV4, testDataTypeError.bind(null, 'DAYDATE_TABLE'), done);
          });
        });

        describeRemoteDB('SECONDDATE', function () {
          before(setUpTable('SECONDDATE_TABLE', ['A SECONDDATE'], 4));
          after(dropTable('SECONDDATE_TABLE', 4));
    
          it('should return valid dates via callback', function (done) {
            testDataTypeValid('SECONDDATE_TABLE', secondDateInsertValues, [62], secondDateExpectedDFV4, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(secondDateInvalidTestDataDFV4, testDataTypeError.bind(null, 'SECONDDATE_TABLE'), done);
          });
        });

        describeRemoteDB('LONGDATE', function () {
          before(setUpTable('LONGDATE_TABLE', ['A LONGDATE'], 4));
          after(dropTable('LONGDATE_TABLE', 4));
    
          it('should return valid dates via callback', function (done) {
            testDataTypeValid('LONGDATE_TABLE', longDateInsertValues, [61], longDateExpectedDFV4, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(longDateInvalidTestDataDFV4, testDataTypeError.bind(null, 'LONGDATE_TABLE'), done);
          });
        });

        describeRemoteDB('SECONDTIME', function () {
          before(setUpTable('SECONDTIME_TABLE', ['A SECONDTIME'], 4));
          after(dropTable('SECONDTIME_TABLE', 4));
    
          it('should return valid times via callback', function (done) {
            testDataTypeValid('SECONDTIME_TABLE', secondTimeInsertValues, [64], secondTimeExpected, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(secondTimeInvalidTestDataDFV4, testDataTypeError.bind(null, 'SECONDTIME_TABLE'), done);
          });
        });
      });

      describeRemoteDB('ALPHANUM, TEXT, SHORTTEXT, BINTEXT (only tested on on-premise HANA)', function () {
        before(setSkipHANACloud);
        after(resetSkip);
    
        describe('ALPHANUM', function () {
          before(setUpTable('ALPHANUM_TABLE', ['A ALPHANUM(16)'], 4));
          after(dropTable('ALPHANUM_TABLE', 4));
    
          it('should return valid alphanums via callback', function (done) {
            testDataTypeValid('ALPHANUM_TABLE', alphanumInsertValues, [55], alphanumExpected, done);
          });
      
          it('should raise input type error', function (done) {
            async.each(alphanumInvalidTestData, testDataTypeError.bind(null, 'ALPHANUM_TABLE'), done);
          });
        });
    
        describe('TEXT', function () {
          beforeEach(setUpTable('TEXT_TABLE', ['A TEXT'], 4));
          afterEach(dropTable('TEXT_TABLE', 4));
    
          it('should insert and return valid text via callback', function (done) {
            testDataTypeValid('TEXT_TABLE', textInsertValues, [51], textExpected, done);
          });
      
          it('should support fuzzy search', function (done) {
            testFuzzySearch('TEXT_TABLE', 51, done);
          });
        });
    
        describe('SHORTTEXT', function () {
          beforeEach(setUpTable('SHORTTEXT_TABLE', ['A SHORTTEXT(50)'], 4));
          afterEach(dropTable('SHORTTEXT_TABLE', 4));
    
          it('should insert and return valid text via callback', function (done) {
            testDataTypeValid('SHORTTEXT_TABLE', shortTextInsertValues, [52], shortTextExpected, done);
          });
      
          it('should support fuzzy search', function (done) {
            testFuzzySearch('SHORTTEXT_TABLE', 52, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(shortTextInvalidTestData, testDataTypeError.bind(null, 'SHORTTEXT_TABLE'), done);
          });
        });
    
        describe('BINTEXT', function () {
          beforeEach(setUpTable('BINTEXT_TABLE', ['A BINTEXT'], 6));
          afterEach(dropTable('BINTEXT_TABLE', 6));
    
          it('should insert and return valid text via callback', function (done) {
            testDataTypeValid('BINTEXT_TABLE', binTextInsertValues, [53], binTextExpected, done);
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
    
          it('should raise input type error', function (done) {
            // Character conversion validations are done on the server one at a time, so this test will take longer
            this.timeout(3000);
            async.each(binTextInvalidTestData, testDataTypeError.bind(null, 'BINTEXT_TABLE'), done);
          });
        });
      });
    });

    describeRemoteDB('DFV 1', function () {
      before(changeDataFormatSupport(1));
      after(changeDataFormatSupport(ORGINAL_DATA_FORMAT));

      describeRemoteDB('DATES', function () {
        describeRemoteDB('DAYDATE', function () {
          before(setUpTable('DAYDATE_TABLE', ['A DAYDATE'], 1));
          after(dropTable('DAYDATE_TABLE', 1));
    
          it('should return valid date via callback', function (done) {
            testDataTypeValid('DAYDATE_TABLE', daydateInsertValues, [14], daydateExpected, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(daydateInvalidTestDataDFV1, testDataTypeError.bind(null, 'DAYDATE_TABLE'), done);
          });
        });

        describeRemoteDB('SECONDDATE', function () {
          before(setUpTable('SECONDDATE_TABLE', ['A SECONDDATE'], 1));
          after(dropTable('SECONDDATE_TABLE', 1));
    
          it('should return valid dates via callback', function (done) {
            testDataTypeValid('SECONDDATE_TABLE', secondDateInsertValues, [16], secondDateExpectedDFV1, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(secondDateInvalidTestDataDFV1, testDataTypeError.bind(null, 'SECONDDATE_TABLE'), done);
          });
        });

        describeRemoteDB('LONGDATE', function () {
          before(setUpTable('LONGDATE_TABLE', ['A LONGDATE'], 1));
          after(dropTable('LONGDATE_TABLE', 1));
    
          it('should return valid dates via callback', function (done) {
            testDataTypeValid('LONGDATE_TABLE', longDateInsertValues, [16], longDateExpectedDFV1, done);
          });
    
          it('should raise input type error', function (done) {
            // In DFV1, most error validations are done on the server so this test can take longer
            this.timeout(3000);
            async.each(longDateInvalidTestDataDFV1, testDataTypeError.bind(null, 'LONGDATE_TABLE'), done);
          });
        });

        describeRemoteDB('SECONDTIME', function () {
          before(setUpTable('SECONDTIME_TABLE', ['A SECONDTIME'], 1));
          after(dropTable('SECONDTIME_TABLE', 1));
    
          it('should return valid times via callback', function (done) {
            testDataTypeValid('SECONDTIME_TABLE', secondTimeInsertValues, [15], secondTimeExpected, done);
          });
    
          it('should raise input type error', function (done) {
            // Same as LONGDATE, in DFV1, most error validations are done on the server, so this test can take longer
            this.timeout(3000);
            async.each(secondTimeInvalidTestDataDFV1, testDataTypeError.bind(null, 'SECONDTIME_TABLE'), done);
          });
        });
      });

      describeRemoteDB('ALPHANUM, TEXT, SHORTTEXT, BINTEXT (only tested on on-premise HANA)', function () {
        before(setSkipHANACloud);
        after(resetSkip);
    
        describe('ALPHANUM', function () {
          before(setUpTable('ALPHANUM_TABLE', ['A ALPHANUM(16)'], 1));
          after(dropTable('ALPHANUM_TABLE', 1));
    
          it('should return valid alphanums via callback', function (done) {
            testDataTypeValid('ALPHANUM_TABLE', alphanumInsertValues, [11], alphanumExpected, done);
          });
      
          it('should raise input type error', function (done) {
            async.each(alphanumInvalidTestData, testDataTypeError.bind(null, 'ALPHANUM_TABLE'), done);
          });
        });
    
        describe('TEXT', function () {
          beforeEach(setUpTable('TEXT_TABLE', ['A TEXT'], 1));
          afterEach(dropTable('TEXT_TABLE', 1));
    
          it('should insert and return valid text via callback', function (done) {
            testDataTypeValid('TEXT_TABLE', textInsertValues, [26], textExpected, done);
          });
        });
    
        describe('SHORTTEXT', function () {
          beforeEach(setUpTable('SHORTTEXT_TABLE', ['A SHORTTEXT(50)'], 1));
          afterEach(dropTable('SHORTTEXT_TABLE', 1));
    
          it('should insert and return valid text via callback', function (done) {
            testDataTypeValid('SHORTTEXT_TABLE', shortTextInsertValues, [11], shortTextExpected, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(shortTextInvalidTestData, testDataTypeError.bind(null, 'SHORTTEXT_TABLE'), done);
          });
        });
    
        describe('BINTEXT', function () {
          beforeEach(setUpTable('BINTEXT_TABLE', ['A BINTEXT'], 1));
          afterEach(dropTable('BINTEXT_TABLE', 1));
    
          it('should insert and return valid text via callback', function (done) {
            testDataTypeValid('BINTEXT_TABLE', binTextInsertValues, [26], binTextExpected, done);
          });
    
          it('should raise input type error', function (done) {
            // Character conversion validations are done on the server one at a time, so this test will take longer
            this.timeout(3000);
            async.each(binTextInvalidTestData, testDataTypeError.bind(null, 'BINTEXT_TABLE'), done);
          });
        });
      });
    });
  });

  describeRemoteDB('Spatial', function () {
    describeRemoteDB('default spatialTypes', function () {
      // ST_GEOMETRY (default spatialTypes)
      var geometryValuesDFV5 = [
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
      var geometryInsertValuesDFV5 = geometryValuesDFV5.map(function (val) { return [val]; });
      var geometryExpected = geometryValuesDFV5.map(function (val) {
        if (util.isString(val)) {
          return {A: Buffer.from(val, "hex")};
        } else {
          return {A: val};
        }
      });
      // In DFV1, the parameter type becomes BINARY, so string input is not allowed
      var geometryInsertValuesDFV1 = geometryExpected.map(function (row) { return [row.A]; });
      // EWKT conversion
      var geometryEWKTInsertValues = [
        Buffer.from("0108000000030000000000000000000000000000000000000"
          + "0000000000000f03f000000000000f03f000000000000000000000000"
          + "00000040", "hex")
      ];
      var geometryEWKTExpected = [{EWKTEXT: Buffer.from("SRID=0;CIRCULARSTRING (0 0,1 1,0 2)", "utf8")}];
      // Large ST_GEOMETRY
      // Generate a multiline's hex that is 29282 bytes
      var hexStr = "0105000000910100000";
      for (var i = 0; i < 400; i++) {
        hexStr += "1020000000400000000000000000000000000000000000000000000000000000000000000"
                + "0000f03f000000000000f03f000000000000f03f000000000000f03f00000000000000000";
      }
      hexStr += "1020000000400000000000000000000000000000000000000000000000000000000000000"
              + "0000f03f000000000000f03f000000000000f03f000000000000f03f0000000000000000";
      var geometryLargeInsertValuesDFV5 = [[hexStr]];
      // In DFV1, only buffers are supported as input
      var geometryLargeInsertValuesDFV1 = [[Buffer.from(hexStr, 'hex')]];
      var geometryLargeExpected = [{A: Buffer.from(hexStr, 'hex')}];
      // Invalid ST_GEOMETRY
      var geometryInvalidTestDataDFV5 = [
        {
          value: 'Strings must be hex in this option',
          errMessage: 'spatial error: Unexpected end of WKB at position 0: type_code=12, index=1'
        },
        {value: 12345, errMessage: 'Cannot set parameter at row: 1. Argument must be a string or Buffer'}
      ];
      var geometryInvalidTestDataDFV1 = [
        {
          value: Buffer.from('Strings must be hex in this option', 'hex'),
          errMessage: 'spatial error: Unexpected end of WKB at position 0: type_code=12, index=1'
        },
        {value: 12345, errMessage: 'Cannot set parameter at row: 1. Wrong input for BINARY type'}
      ];

      // ST_POINT (default spatialTypes)
      var pointValuesDFV5 = [
        null,
        Buffer.from("010100000000000000000024400000000000003440", "hex"),
        '0101000000000000c078e91b400000000000b6a5c0',
        Buffer.from("010100000083b2f2ffadfaa3430564e1fc74b64643", "hex"),
      ];
      var pointInsertValuesDFV5 = pointValuesDFV5.map(function (val) { return [val]; });
      var pointExpected = pointValuesDFV5.map(function (val) {
        if (util.isString(val)) {
          return {A: Buffer.from(val, "hex")};
        } else {
          return {A: val};
        }
      });
      // In DFV1, the parameter type becomes BINARY, so string input is not allowed
      var pointInsertValuesDFV1 = pointExpected.map(function (row) { return [row.A]; });

      // Invalid ST_POINT
      // Keep the same tests as in ST_GEOMETRY
      var pointInvalidTestDataDFV5 = geometryInvalidTestDataDFV5.slice();
      var pointInvalidTestDataDFV1 = geometryInvalidTestDataDFV1.slice();
      // Add a test for a ST_POINT that does not match
      var mismatchPointInvalidTest = {
        value: Buffer.from('01e9030000000000000000244000000000000034400000000000003e40', 'hex'),
        errMessage: "spatial error: exception 1620502: The geometry type 'ST_Point' with dimension 'XYZ' is not allowed in column "
        + "of type ST_POINT due to column constraints, which only allows 2-dimensional ST_Point types\n: type_code=12, index=1"
      };
      pointInvalidTestDataDFV1.push(mismatchPointInvalidTest);
      pointInvalidTestDataDFV5.push(mismatchPointInvalidTest);

      describeRemoteDB('DFV >= 5', function () {
        describeRemoteDB('ST_GEOMETRY', function () {
          beforeEach(setUpTable('ST_GEOMETRY_TABLE', ['A ST_GEOMETRY'], 5));
          afterEach(dropTable('ST_GEOMETRY_TABLE', 5));
    
          it('should return valid ST_GEOMETRY types', function (done) {
            testDataTypeValid('ST_GEOMETRY_TABLE', geometryInsertValuesDFV5, [74], geometryExpected, done);
          });
    
          it('should return valid EWKT conversions', function (done) {
            testDataTypeValidSql('ST_GEOMETRY_TABLE', "SELECT A.ST_AsEWKT() EWKTEXT FROM ST_GEOMETRY_TABLE",
              geometryEWKTInsertValues, [[25, 26]], geometryEWKTExpected, done);
          });
  
          it('should insert and return large ST_GEOMETRY types', function (done) {
            testDataTypeValid('ST_GEOMETRY_TABLE', geometryLargeInsertValuesDFV5, [74], geometryLargeExpected, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(geometryInvalidTestDataDFV5, testDataTypeError.bind(null, 'ST_GEOMETRY_TABLE'), done);
          });
        });
    
        describeRemoteDB('ST_POINT', function () {
          beforeEach(setUpTable('ST_POINT_TABLE', ['A ST_POINT'], 5));
          afterEach(dropTable('ST_POINT_TABLE', 5));
    
          it('should return valid ST_POINT types', function (done) {
            testDataTypeValid('ST_POINT_TABLE', pointInsertValuesDFV5, [75], pointExpected, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(pointInvalidTestDataDFV5, testDataTypeError.bind(null, 'ST_POINT_TABLE'), done);
          });
        });
      });

      describeRemoteDB('DFV 1', function () {
        before(changeDataFormatSupport(1));
        after(changeDataFormatSupport(ORGINAL_DATA_FORMAT));

        describeRemoteDB('ST_GEOMETRY', function () {
          beforeEach(setUpTable('ST_GEOMETRY_TABLE', ['A ST_GEOMETRY'], 1));
          afterEach(dropTable('ST_GEOMETRY_TABLE', 1));
    
          it('should return valid ST_GEOMETRY types', function (done) {
            testDataTypeValid('ST_GEOMETRY_TABLE', geometryInsertValuesDFV1, [13], geometryExpected, done);
          });
    
          it('should return valid EWKT conversions', function (done) {
            testDataTypeValidSql('ST_GEOMETRY_TABLE', "SELECT A.ST_AsEWKT() EWKTEXT FROM ST_GEOMETRY_TABLE",
              geometryEWKTInsertValues, [[25, 26]], geometryEWKTExpected, done);
          });
  
          it('should insert and return large ST_GEOMETRY types', function (done) {
            testDataTypeValid('ST_GEOMETRY_TABLE', geometryLargeInsertValuesDFV1, [13], geometryLargeExpected, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(geometryInvalidTestDataDFV1, testDataTypeError.bind(null, 'ST_GEOMETRY_TABLE'), done);
          });
        });
    
        describeRemoteDB('ST_POINT', function () {
          beforeEach(setUpTable('ST_POINT_TABLE', ['A ST_POINT'], 1));
          afterEach(dropTable('ST_POINT_TABLE', 1));
    
          it('should return valid ST_POINT types', function (done) {
            testDataTypeValid('ST_POINT_TABLE', pointInsertValuesDFV1, [13], pointExpected, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(pointInvalidTestDataDFV1, testDataTypeError.bind(null, 'ST_POINT_TABLE'), done);
          });
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

      // ST_GEOMETRY (spatialTypes 1)
      var geometryInsertValuesDFV5 = [
        [null],
        [Buffer.from("010100000000000000000024400000000000002440", "hex")],
        ['MultiLineString ((10 10, 12 12), (14 10, 16 12))'],
        ['GeometryCollection (LineString(5 10, 10 12, 15 10), Polygon ((10 -5, 15 5, 5 5, 10 -5)))'],
        ['MultiPolygon Z(((-5 -5 4, 5 -5 7, 0 5 1, -5 -5 4), (-2 -2 9, -2 0 4, 2 0 4, 2 -2 1, -2 -2 9)), ((10 -5 2, 15 5 2, 5 5 3, 10 -5 2)))'],
      ];
      var geometryExpected = [
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
      // Even in spatialTypes 1, DFV 1 only supports buffers since the parameter type
      // becomes BINARY
      var geometryInsertValuesDFV1 = geometryExpected.map(function (row) {
        return [row.A];
      });
      // EWKT conversion
      var geometryEWKTInsertValuesDFV5 = [
        ['LineString ZM(0 0 3 6, 5 10 4 8)'],
        ['MultiPoint ZM((10 10 12 1), (12 12 14 1), (14 10 10 1))'],
      ];
      var geometryEWKTExpectedDFV5 = [
        {EWKTEXT: Buffer.from("SRID=4326;LINESTRING ZM (0 0 3 6,5 10 4 8)", "utf8")},
        {EWKTEXT: Buffer.from("SRID=4326;MULTIPOINT ZM ((10 10 12 1),(12 12 14 1),(14 10 10 1))", "utf8")},
      ];
      // Large ST_GEOMETRY
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
      var geometryLargeInsertValuesDFV5 = [[lines]];
      var geometryLargeExpectedDFV5 = [{EWKTEXT: Buffer.from("SRID=4326;" + lines, "utf8")}];
      // Invalid ST_GEOMETRY
      var geometryInvalidTestDataDFV5 = [
        {
          value: '010100000000000000000000000000000000000000',
          errMessage: "spatial error: Invalid or unsupported geometry type '010100000000000000000000000000000000000000' at "
          + "position 0 of WKT 010100000000000000000000000000000000000000: type_code=29, index=1"
        },
        {value: 12345, errMessage: 'Cannot set parameter at row: 1. Argument must be a string or Buffer'}
      ];
      var geometryInvalidTestDataDFV1 = [
        {
          value: 'MultiLineString ((10 10, 12 12), (14 10, 16 12))', // Check that strings are not valid input in DFV 1
          errMessage: "Cannot set parameter at row: 1. Wrong input for BINARY type"
        },
        {value: 12345, errMessage: 'Cannot set parameter at row: 1. Wrong input for BINARY type'}
      ];

      // ST_POINT (spatialTypes 1)
      var pointInsertValuesDFV5 = [
        [null],
        [Buffer.from("010100000000000000000000400000000000000840", "hex")],
        ['Point (-10 0)'],
        ['Point (0.5 0.5)'],
      ];
      var pointExpected = [
        {A: null},
        {A: Buffer.from("010100000000000000000000400000000000000840", "hex")},
        {A: Buffer.from("010100000000000000000024c00000000000000000", "hex")},
        {A: Buffer.from("0101000000000000000000e03f000000000000e03f", "hex")}
      ];
      // Same as before, even in spatialTypes 1, DFV 1 only supports buffers
      var pointInsertValuesDFV1 = pointExpected.map(function (row) {
        return [row.A];
      });
      // Invalid ST_POINT
      var pointInvalidTestDataDFV5 = [
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
      var pointInvalidTestDataDFV1 = [
        // Check that strings are not valid input in DFV 1
        {value: 'Point (25 25)', errMessage: "Cannot set parameter at row: 1. Wrong input for BINARY type"},
        {value: 12345, errMessage: 'Cannot set parameter at row: 1. Wrong input for BINARY type'},
        {
          value: Buffer.from('01e9030000000000000000244000000000000034400000000000003e40', 'hex'),
          errMessage: "spatial error: exception 1620502: The geometry type 'ST_Point' with dimension 'XYZ' is not allowed in "
          + "column of type ST_POINT due to column constraints, which only allows 2-dimensional ST_Point types\n: type_code=12, index=1"
        }
      ];

      describeRemoteDB('DFV >= 5', function () {
        describeRemoteDB('ST_GEOMETRY', function () {
          beforeEach(setUpTable('ST_GEOMETRY_TABLE', ['A ST_GEOMETRY(4326)'], 5));
          afterEach(dropTable('ST_GEOMETRY_TABLE', 5));
    
          it('should return valid ST_GEOMETRY types', function (done) {
            testDataTypeValid('ST_GEOMETRY_TABLE', geometryInsertValuesDFV5, [74], geometryExpected, done);
          });
    
          it('should return valid EWKT conversions', function (done) {
            testDataTypeValidSql('ST_GEOMETRY_TABLE', "SELECT A.ST_AsEWKT() EWKTEXT FROM ST_GEOMETRY_TABLE",
              geometryEWKTInsertValuesDFV5, [[25, 26]], geometryEWKTExpectedDFV5, done);
          });
  
          it('should insert and return large ST_GEOMETRY types', function (done) {
            testDataTypeValidSql('ST_GEOMETRY_TABLE', "SELECT A.ST_AsEWKT() EWKTEXT FROM ST_GEOMETRY_TABLE",
              geometryLargeInsertValuesDFV5, [[25, 26]], geometryLargeExpectedDFV5, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(geometryInvalidTestDataDFV5, testDataTypeError.bind(null, 'ST_GEOMETRY_TABLE'), done);
          });
        });
  
        describeRemoteDB('ST_POINT', function () {
          beforeEach(setUpTable('ST_POINT_TABLE', ['A ST_POINT'], 5));
          afterEach(dropTable('ST_POINT_TABLE', 5));
    
          it('should return valid ST_POINT types', function (done) {
            testDataTypeValid('ST_POINT_TABLE', pointInsertValuesDFV5, [75], pointExpected, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(pointInvalidTestDataDFV5, testDataTypeError.bind(null, 'ST_POINT_TABLE'), done);
          });
        });
      });

      describeRemoteDB('DFV 1', function () {
        before(changeDataFormatSupport(1));
        after(changeDataFormatSupport(ORGINAL_DATA_FORMAT));

        describeRemoteDB('ST_GEOMETRY', function () {
          beforeEach(setUpTable('ST_GEOMETRY_TABLE', ['A ST_GEOMETRY(4326)'], 1));
          afterEach(dropTable('ST_GEOMETRY_TABLE', 1));
    
          it('should return valid ST_GEOMETRY types', function (done) {
            testDataTypeValid('ST_GEOMETRY_TABLE', geometryInsertValuesDFV1, [13], geometryExpected, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(geometryInvalidTestDataDFV1, testDataTypeError.bind(null, 'ST_GEOMETRY_TABLE'), done);
          });
        });
  
        describeRemoteDB('ST_POINT', function () {
          beforeEach(setUpTable('ST_POINT_TABLE', ['A ST_POINT'], 1));
          afterEach(dropTable('ST_POINT_TABLE', 1));
    
          it('should return valid ST_POINT types', function (done) {
            testDataTypeValid('ST_POINT_TABLE', pointInsertValuesDFV1, [13], pointExpected, done);
          });
    
          it('should raise input type error', function (done) {
            async.each(pointInvalidTestDataDFV1, testDataTypeError.bind(null, 'ST_POINT_TABLE'), done);
          });
        });
      });
    });
  });

  describeRemoteDB('DFV 7 (BOOLEAN)', function () {
    var booleanInsertValuesDFV7 = [
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
    var booleanExpectedDFV7 = [{A: true}, {A: null}, {A: false}, {A: true}, {A: true},
      {A: false}, {A: true}, {A: false}, {A: null}, {A: true},
      {A: false}, {A: null}];
    // In DFV1, non number strings are not supported ('true', 'unknown').
    var booleanInsertValuesDFV1 = [
      [true],
      [null],
      [false],
      [1],
      [10.5],
      [0],
      ['1'],
      ['0'],
      [''],
    ];
    var booleanExpectedDFV1 = [{A: 1}, {A: null}, {A: 0}, {A: 1}, {A: 1}, {A: 0}, {A: 1}, {A: 0}, {A: 0}];
    var booleanInvalidValuesDFV7 = ['String not boolean', Buffer.from("01", "hex")];
    // Add the same expected error message to the values
    var booleanInvalidTestDataDFV7 = booleanInvalidValuesDFV7.map(function (testValue) {
      return {value: testValue, errMessage: "Cannot set parameter at row: 1. Wrong input for BOOLEAN type"};
    });
    // In DFV1, the error message is for the TINYINT type and boolean strings like 'true' cannot be added
    var booleanInvalidValuesDFV1 = ['true', 'String not boolean', Buffer.from("01", "hex")];
    var booleanInvalidTestDataDFV1 = booleanInvalidValuesDFV1.map(function (testValue) {
      return {value: testValue, errMessage: "Cannot set parameter at row: 1. Wrong input for TINYINT type"};
    });

    describeRemoteDB('DFV >= 7', function () {
      describeRemoteDB('BOOLEAN', function () {
        before(setUpTable('BOOLEAN_TABLE', ['A BOOLEAN'], 7));
        after(dropTable('BOOLEAN_TABLE', 7));

        it('should add valid booleans using different parameter types', function (done) {
          testDataTypeValid('BOOLEAN_TABLE', booleanInsertValuesDFV7, [28], booleanExpectedDFV7, done);
        });

        it('should raise input type error', function (done) {
          async.each(booleanInvalidTestDataDFV7, testDataTypeError.bind(null, 'BOOLEAN_TABLE'), done);
        });
      });
    });

    describeRemoteDB('DFV 1', function () {
      before(changeDataFormatSupport(1));
      after(changeDataFormatSupport(ORGINAL_DATA_FORMAT));

      describeRemoteDB('BOOLEAN', function () {
        before(setUpTable('BOOLEAN_TABLE', ['A BOOLEAN'], 1));
        after(dropTable('BOOLEAN_TABLE', 1));

        it('should add valid booleans using different parameter types', function (done) {
          testDataTypeValid('BOOLEAN_TABLE', booleanInsertValuesDFV1, [1], booleanExpectedDFV1, done);
        });

        it('should raise input type error', function (done) {
          async.each(booleanInvalidTestDataDFV1, testDataTypeError.bind(null, 'BOOLEAN_TABLE'), done);
        });
      });
    });
  });
});