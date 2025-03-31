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
const ORGINAL_DATA_FORMAT = 9;
var db = require('../db')({dataFormatSupport: ORGINAL_DATA_FORMAT});
var RemoteDB = require('../db/RemoteDB');
var lorem = require('../fixtures/lorem');
var util = require('../../lib/util');
const { DEFAULT_PACKET_SIZE } = require('../../lib/protocol/common/Constants');

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
        if (dataTypeCodes.includes(96) && db.getVectorOutputType() === 'Array') {
          // Check real vector is approximately accurate
          for (var i = 0; i < rows.length; i++) {
            if (rows[i].A === null) {
              rows[i].should.eql(expected[i]);
            } else {
              rows[i].A.should.have.length(expected[i].A.length);
              for (var j = 0; j < rows[i].A.length; j++) {
                rows[i].A[j].should.be.approximately(expected[i].A[j], 0.1);
              }
            }
            
          }
        } else {
          rows.should.eql(expected);
        }
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
      var insertSql = `insert into ${tableName} (${curTableCols.join(',')}) values `
      + `(${Array(curTableCols.length).fill('?').join(',')})`;
      client.prepare(insertSql, function (err, ps) {
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
      describeRemoteDB('ST_GEOMETRY', function () {
        beforeEach(setUpTable('ST_GEOMETRY_TABLE', ['A ST_GEOMETRY'], 5));
        afterEach(dropTable('ST_GEOMETRY_TABLE', 5));
  
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
        beforeEach(setUpTable('ST_POINT_TABLE', ['A ST_POINT'], 5));
        afterEach(dropTable('ST_POINT_TABLE', 5));
  
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
        beforeEach(setUpTable('ST_GEOMETRY_TABLE', ['A ST_GEOMETRY(4326)'], 5));
        afterEach(dropTable('ST_GEOMETRY_TABLE', 5));
  
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
        beforeEach(setUpTable('ST_POINT_TABLE', ['A ST_POINT'], 5));
        afterEach(dropTable('ST_POINT_TABLE', 5));
  
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
    before(setUpTable('BOOLEAN_TABLE', ['A BOOLEAN'], 7));
    after(dropTable('BOOLEAN_TABLE', 7));

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
    // FIXED8
    var fixed8InsertValues = [
      [123456],
      [-10000.123456],
      ['1234.56789101234567'],
      ['-1289128378.00000'],
      ['9999.992'],
      ['9999999999.999989'],
      ['-9999999999.999999'],
      ['123e+7'],
      ['-0.004567e-2'],
      ['12345678901.2345e-5'],
      [null],
      [0],
    ];
    var fixed8Expected = [{A: '123456.00000'}, {A: '-10000.12345'}, {A: '1234.56789'}, {A: '-1289128378.00000'},
      {A: '9999.99200'}, {A: '9999999999.99998'}, {A: '-9999999999.99999'}, {A: '1230000000.00000'},
      {A: '-0.00004'}, {A: '123456.78901'}, {A: null}, {A: '0.00000'}];

    var fixed8InvalidTestDataDFV8 = [
      // Overflows 15 digit precision with 5 decimal places
      {value: '10000000000', errMessage: 'numeric overflow: Failed in "A" column with the value 10000000000.00000'},
      {value: '-10000000000', errMessage: 'numeric overflow: Failed in "A" column with the value -10000000000.00000'},
      {value: '1e10', errMessage: 'numeric overflow: Failed in "A" column with the value 10000000000.00000'},
      {value: '-1e10', errMessage: 'numeric overflow: Failed in "A" column with the value -10000000000.00000'},
      // Exceed 8 byte representation
      {value: '9223372036854775808', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED8 type'},
      {value: '-8103103283140113886353743219674022396', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED8 type'},
      {value: '9.3e18', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED8 type'},
      {value: '-9.3e18', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED8 type'},
    ];
    // In DFV 7, the error messages are different
    var fixed8InvalidTestDataDFV7 = fixed8InvalidTestDataDFV8.map(function (testData, index) {
      if (index < 4) { // Overflows 15 digit precision with 5 decimal places
        return {
          value: testData.value,
          errMessage: 'numeric overflow: the precision of the decimal value is larger than the target precision: 15: type_code=5, index=1'
        };
      } else { // Exceed 8 byte representation
        return {
          value: testData.value,
          errMessage: 'numeric overflow: numeric overflow: type_code=5, index=1'
        };
      }
    });

    // FIXED12
    var fixed12InsertValues = [
      [9007199254740991],
      [-7289481923.5612479],
      ['61274182.56789101234567'],
      ['-128127498912.00000'],
      ['999999999999999999.992'],
      ['999999999999999999.999989'],
      ['-999999999999999999.999999'],
      ['-789012.891023e12'],
      ['67812.39812e-3'],
      ['-909090909090909.909099909e+3'],
      [null],
      [0],
    ];
    var fixed12Expected = [{A: '9007199254740991.00000'}, {A: '-7289481923.56124'}, {A: '61274182.56789'},
      {A: '-128127498912.00000'}, {A: '999999999999999999.99200'}, {A: '999999999999999999.99998'},
      {A: '-999999999999999999.99999'}, {A: '-789012891023000000.00000'}, {A: '67.81239'},
      {A: '-909090909090909909.09990'}, {A: null}, {A: '0.00000'}];

    var fixed12InvalidTestDataDFV8 = [
      // Overflows 23 digit precision with 5 decimal places
      {value: '1000000000000000000', errMessage: 'numeric overflow: Failed in "A" column with the value 1000000000000000000.00000'},
      {value: '-1000000000000000000', errMessage: 'numeric overflow: Failed in "A" column with the value -1000000000000000000.00000'},
      {value: '1e18', errMessage: 'numeric overflow: Failed in "A" column with the value 1000000000000000000.00000'},
      {value: '-1e18', errMessage: 'numeric overflow: Failed in "A" column with the value -1000000000000000000.00000'},
      // Exceed 12 byte representation
      {value: '39614081257132168796771975168', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED12 type'},
      {value: '-89542859971670557702231615814500106944', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED12 type'},
      {value: '3.962e28', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED12 type'},
      {value: '-3.962e28', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED12 type'},
    ];
    var fixed12InvalidTestDataDFV7 = fixed12InvalidTestDataDFV8.map(function (testData, index) {
      if (index < 4) { // Overflows 23 digit precision with 5 decimal places
        return {
          value: testData.value,
          errMessage: 'numeric overflow: the precision of the decimal value is larger than the target precision: 23: type_code=5, index=1'
        };
      } else { // Exceed 12 byte representation
        return {
          value: testData.value,
          errMessage: 'numeric overflow: numeric overflow: type_code=5, index=1'
        };
      }
    });

    // FIXED16
    var fixed16InsertValues = [
      ['682104294101148412963771036529'],
      ['-964060612622724383174786442765.465905'],
      [18724.230],
      [-123456.903],
      ['8312612546512631264781627841.7819453'],
      ['-257283749723.00000'],
      ['999999999999999999999999999999.992'],
      ['999999999999999999999999999999.999989'],
      ['-999999999999999999999999999999.999999'],
      ['123e+27'],
      ['-781923.004567e-2'],
      ['140.639601953246854334843221842051061083e22'],
      [null],
      [0],
    ];
    var fixed16ExpectedDFV8 = [{A: '682104294101148412963771036529.00000'}, {A: '-964060612622724383174786442765.46590'},
      {A: '18724.23000'}, {A: '-123456.90300'}, {A: '8312612546512631264781627841.78194'}, {A: '-257283749723.00000'},
      {A: '999999999999999999999999999999.99200'}, {A: '999999999999999999999999999999.99998'},
      {A: '-999999999999999999999999999999.99999'}, {A: '123000000000000000000000000000.00000'},
      {A: '-7819.23004'}, {A: '1406396019532468543348432.21842'}, {A: null}, {A: '0.00000'}];
    // In DFV7 and below, decimal precision is lower so data after 34 digits in fixed decimals is truncated
    var fixed16ExpectedDFV7 = fixed16ExpectedDFV8.map(function (expectedRow) {
      if (expectedRow.A === '999999999999999999999999999999.99998') {
        return {A: '999999999999999999999999999999.99990'};
      } else if (expectedRow.A === '-999999999999999999999999999999.99999') {
        return {A: '-999999999999999999999999999999.99990'};
      } else {
        return expectedRow;
      }
    });

    var fixed16InvalidTestDataDFV8 = [
      // Overflows 35 digit precision with 5 decimal places
      {
        value: '1000000000000000000000000000000',
        errMessage: 'numeric overflow: Failed in "A" column with the value 1000000000000000000000000000000.00000'
      },
      {
        value: '-1000000000000000000000000000000',
        errMessage: 'numeric overflow: Failed in "A" column with the value -1000000000000000000000000000000.00000'
      },
      {value: '1e30', errMessage: 'numeric overflow: Failed in "A" column with the value 1000000000000000000000000000000.00000'},
      {value: '-1e30', errMessage: 'numeric overflow: Failed in "A" column with the value -1000000000000000000000000000000.00000'},
      // Overflows maximum 38 digit precision with 5 decimals
      {value: '9999999999999999999999999999999999', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED16 type'},
      {value: '-9999999999999999999999999999999999', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED16 type'},
      {value: '123456789e+25', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED16 type'},
      {value: '-123456789e+25', errMessage: 'Cannot set parameter at row: 1. Wrong input for FIXED16 type'},
    ];
    var fixed16InvalidTestDataDFV7 = fixed16InvalidTestDataDFV8.map(function (testData, index) {
      if (index < 4 || index >= 6) { // Overflows 35 digit precision with 5 decimal places
        return {
          value: testData.value,
          errMessage: 'numeric overflow: the precision of the decimal value is larger than the target precision: 35: type_code=5, index=1'
        };
      } else { // Exceeds 16 byte representation
        return {
          value: testData.value,
          errMessage: 'numeric overflow: cannot convert the value to DECIMAL(35, 5): type_code=5, index=1'
        };
      }
    });

    describeRemoteDB('DFV >= 8', function () {
      describeRemoteDB('FIXED8', function () {
        before(setUpTableRemoteDB('FIXED8_TABLE', ['A DECIMAL(15, 5)'], 8));
        after(dropTableRemoteDB('FIXED8_TABLE', 8));
  
        it('should insert and return valid FIXED8 decimals', function (done) {
          testDataTypeValid('FIXED8_TABLE', fixed8InsertValues, [81], fixed8Expected, done);
        });
  
        it('should raise input type error', function (done) {
          // Overflow validations are done one at a time, and some are done on the server, so this test can take longer
          this.timeout(4000);
          async.each(fixed8InvalidTestDataDFV8, testDataTypeError.bind(null, 'FIXED8_TABLE'), done);
        });
      });

      describeRemoteDB('FIXED12', function () {
        before(setUpTableRemoteDB('FIXED12_TABLE', ['A DECIMAL(23, 5)'], 8));
        after(dropTableRemoteDB('FIXED12_TABLE', 8));

        it('should insert and return valid FIXED12 decimals', function (done) {
          testDataTypeValid('FIXED12_TABLE', fixed12InsertValues, [82], fixed12Expected, done);
        });

        it('should raise input type error', function (done) {
          // Same as before, some overflow validations are on the server, so this test can take longer
          this.timeout(4000);
          async.each(fixed12InvalidTestDataDFV8, testDataTypeError.bind(null, 'FIXED12_TABLE'), done);
        });
      });

      describeRemoteDB('FIXED16', function () {
        before(setUpTableRemoteDB('FIXED16_TABLE', ['A DECIMAL(35, 5)'], 8));
        after(dropTableRemoteDB('FIXED16_TABLE', 8));
  
        it('should insert and return valid FIXED16 decimals', function (done) {
          testDataTypeValid('FIXED16_TABLE', fixed16InsertValues, [76], fixed16ExpectedDFV8, done);
        });
  
        it('should raise input type error', function (done) {
          // Same as before, some overflow validations are on the server, so this test can take longer
          this.timeout(4000);
          async.each(fixed16InvalidTestDataDFV8, testDataTypeError.bind(null, 'FIXED16_TABLE'), done);
        });
      });
    });

    describeRemoteDB('DFV 7', function () {
      before(changeDataFormatSupport(7));
      after(changeDataFormatSupport(ORGINAL_DATA_FORMAT));

      describeRemoteDB('FIXED8', function () {
        before(setUpTableRemoteDB('FIXED8_TABLE', ['A DECIMAL(15, 5)'], 7));
        after(dropTableRemoteDB('FIXED8_TABLE', 7));

        it('should insert and return valid FIXED8 decimals', function (done) {
          testDataTypeValid('FIXED8_TABLE', fixed8InsertValues, [5], fixed8Expected, done);
        });

        it('should raise input type error', function (done) {
          // Overflow validations are done one at a time and all on the server in lower data format versions,
          // so this test can take even longer
          this.timeout(5000);
          async.each(fixed8InvalidTestDataDFV7, testDataTypeError.bind(null, 'FIXED8_TABLE'), done);
        });
      });

      describeRemoteDB('FIXED12', function () {
        before(setUpTableRemoteDB('FIXED12_TABLE', ['A DECIMAL(23, 5)'], 7));
        after(dropTableRemoteDB('FIXED12_TABLE', 7));

        it('should insert and return valid FIXED12 decimals', function (done) {
          testDataTypeValid('FIXED12_TABLE', fixed12InsertValues, [5], fixed12Expected, done);
        });

        it('should raise input type error', function (done) {
          // Same as before, all overflow validations are on the server, so this test can take longer
          this.timeout(5000);
          async.each(fixed12InvalidTestDataDFV7, testDataTypeError.bind(null, 'FIXED12_TABLE'), done);
        });
      });

      describeRemoteDB('FIXED16', function () {
        before(setUpTableRemoteDB('FIXED16_TABLE', ['A DECIMAL(35, 5)'], 7));
        after(dropTableRemoteDB('FIXED16_TABLE', 7));
  
        it('should insert and return valid FIXED16 decimals', function (done) {
          testDataTypeValid('FIXED16_TABLE', fixed16InsertValues, [5], fixed16ExpectedDFV7, done);
        });

        it('should support FIXED16 decimals larger than DECIMAL precision', function (done) {
          var expected = [{A: '100000000000000000000000000000000000000'}];
          validateDataSql('SELECT TO_DECIMAL(99999999999999999999999999999999999999, 38, 0) AS "A" FROM DUMMY',
            [5], expected, done);
        })
  
        it('should raise input type error', function (done) {
          // Same as before, all overflow validations are on the server, so this test can take longer
          this.timeout(5000);
          async.each(fixed16InvalidTestDataDFV7, testDataTypeError.bind(null, 'FIXED16_TABLE'), done);
        });
      });
    });
  });

  describeRemoteDB('REAL_VECTOR (only tested on HANA cloud)', function () {
    var skipTests = false;
    before(function (done) {
      var version = db.getHANAFullVersion();
      if (version === undefined || !version.startsWith("4.")) { // Skip tests on on-premise HANA
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

    function changeSettingReconnect(settings, dataFormatRequired) {
      return function changeSettingReconnectClosure(done) {
        if (skipTests || db.getDataFormatVersion2() < dataFormatRequired) {
          done();
        } else {
          for (var key in settings) {
            db.client.set(key, settings[key]);
          }
          db.end(function (err) {
            db.init(done);
          });
        }
      }
    }

    describe('REAL_VECTOR', function () {
      describe('dynamic length', function () {
        before(setUpTable('REAL_VECTOR_TABLE', ['A REAL_VECTOR'], 9));
        after(dropTable('REAL_VECTOR_TABLE', 9));

        it('should return valid real vectors via callback', function (done) {
          var insertValues = [
            [Buffer.from("050000000000803F0000004000004040000080400000A040", "hex")],
            [[0]],
            [[-100, 200, -3000.458]],
            [[-3.4028234663852886e+38, 1.1754943508222875e-38, 3.4028234663852886e+38, -1.1754943508222875e-38]],
            [null],
          ];
          var expected = [{A: Buffer.from("050000000000803F0000004000004040000080400000A040", "hex")}, {A: Buffer.from("0100000000000000", "hex")},
            {A: Buffer.from("030000000000C8C20000484354873BC5", "hex")}, {A: Buffer.from("04000000FFFF7FFF00008000FFFF7F7F00008080", "hex")}, {A: null}];
          testDataTypeValid('REAL_VECTOR_TABLE', insertValues, [96], expected, done);
        });

        it('should raise input type error', function (done) {
          var invalidTestData = [
            {
              value: 5,
              errMessage: 'Cannot set parameter at row: 1. Wrong input for REAL_VECTOR type'
            },
            {
              value: ['3.12'],
              errMessage: 'Cannot set parameter at row: 1. Wrong input for REAL_VECTOR type'
            },
            {
              value: Buffer.from("0100000000803F"),
              errMessage: 'Cannot set parameter at row: 1. Invalid length or indicator value for REAL_VECTOR type'
            },
            {
              value: Buffer.from("00000000"),
              errMessage: 'Cannot set parameter at row: 1. Invalid length or indicator value for REAL_VECTOR type'
            },
            {
              value: Buffer.from("020000000000803F0000004000004040000080400000A040"),
              errMessage: 'Cannot set parameter at row: 1. Invalid length or indicator value for REAL_VECTOR type'
            },
            {value: [], errMessage: 'Cannot set parameter at row: 1. Invalid length or indicator value for REAL_VECTOR type'},
          ];
          async.each(invalidTestData, testDataTypeError.bind(null, 'REAL_VECTOR_TABLE'), done);
        });
      });

      describe('vectorOutputType Array', function () {
        before(changeSettingReconnect({ vectorOutputType: 'Array', packetSizeLimit: Math.pow(2, 19) }, 9));
        after(changeSettingReconnect({ vectorOutputType: 'Buffer', packetSizeLimit: DEFAULT_PACKET_SIZE }, 9));
        beforeEach(setUpTable('REAL_VECTOR_TABLE', ['A REAL_VECTOR'], 9));
        afterEach(dropTable('REAL_VECTOR_TABLE', 9));

        it('should return valid real vectors as arrays', function (done) {
          var insertValues = [
            [null],
            [[0]],
            [Buffer.from("0100000066E64046", "hex")],
            [[-8912.323, 5781234, -0.57083]],
            [Buffer.from("050000000000803F0000004000004040000080400000A040", "hex")],
            [[12345, 56.789, -1, 1, 100.09, 150000.4, 19023.237]],
          ];
          var expected = [{A: null}, {A: [0]}, {A: [12345.6]}, {A: [-8912.323, 5781234, -0.57083]},
            {A: [1, 2, 3, 4, 5]}, {A: [12345, 56.789, -1, 1, 100.09, 150000.4, 19023.237]}];
          testDataTypeValid('REAL_VECTOR_TABLE', insertValues, [96], expected, done);
        });

        it('should insert and return maximum size real vectors', function (done) {
          this.timeout(5000);
          var buildVector = Array.from(Array(65000).keys()); // 0, 1, ..., 65000
          var insertValues = [buildVector];
          var expected = [{A: buildVector}];
          testDataTypeValid('REAL_VECTOR_TABLE', insertValues, [96], expected, done);
        });
      });

      describe('fixed length', function () {
        before(setUpTable('REAL_VECTOR_TABLE', ['A REAL_VECTOR(3)'], 9));
        after(dropTable('REAL_VECTOR_TABLE', 9));

        it('should return valid real vectors via callback', function (done) {
          var insertValues = [
            [[0, 0, 0]],
            [Buffer.from("030000000000803F0000004000004040", "hex")],
            [[78124.230, 0.0012738, -0.0098654]],
            [[-100, 200, -3000.458]],
            [[-3.4028234663852886e+38, 1.1754943508222875e-38, 500.123]],
            [[3.4028234663852886e+38, -1.1754943508222875e-38, -500.123]],
            [null],
          ];
          var expected = [{A: Buffer.from("03000000000000000000000000000000", "hex")}, {A: Buffer.from("030000000000803F0000004000004040", "hex")},
            {A: Buffer.from("030000001D969847A3F5A63A7DA221BC", "hex")}, {A: Buffer.from("030000000000C8C20000484354873BC5", "hex")},
            {A: Buffer.from("03000000FFFF7FFF00008000BE0FFA43", "hex")}, {A: Buffer.from("03000000FFFF7F7F00008080BE0FFAC3", "hex")}, {A: null}];
          testDataTypeValid('REAL_VECTOR_TABLE', insertValues, [96], expected, done);
        });

        it('should raise input type error', function (done) {
          var invalidTestData = [
            {
              value: Buffer.from("030000000000803F0000004000004040000080400000A040", "hex"),
              errMessage: 'Cannot set parameter at row: 1. Invalid length or indicator value for REAL_VECTOR type'
            },
            {
              value: [3, 4, 5, 6, 7],
              errMessage: 'Cannot set parameter at row: 1. The source dimension is different from the target dimension for REAL_VECTOR type'
            },
            {
              value: [1, 2],
              errMessage: 'Cannot set parameter at row: 1. The source dimension is different from the target dimension for REAL_VECTOR type'
            },
            {
              value: Buffer.from("0100000000007A44", "hex"),
              errMessage: 'Cannot set parameter at row: 1. The source dimension is different from the target dimension for REAL_VECTOR type'
            },
          ];
          async.each(invalidTestData, testDataTypeError.bind(null, 'REAL_VECTOR_TABLE'), done);
        });
      });
    });
  });
});
