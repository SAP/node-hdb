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
var RemoteDB = require('../db/RemoteDB');
var util = require('../../lib/util');
var hanaDynatrace = require('../../extension/Dynatrace');
var dynatraceSDK; // either the real @dynatrace/oneagent-sdk Dynatrace SDK or the mock one
var mockDynatraceSDK; // our mock @dynatrace/oneagent-sdk for testing
var http, server, request;
try {
    dynatraceSDK = require('@dynatrace/oneagent-sdk');
    if (dynatraceSDK.getTraceData !== undefined) {
        // Using mock @dynatrace/oneagent-sdk
        mockDynatraceSDK = dynatraceSDK;
    } else {
      // Using real @dynatrace/oneagent-sdk, so setup web request
      http = require('http');
    }
} catch (err) {
    // No @dynatrace/oneagent-sdk, skip this test, see MockDynatraceSDK to "install" the mock
    // to run these tests
}

var describeDynatrace = db instanceof RemoteDB && dynatraceSDK !== undefined ? describe : describe.skip;

function isMockDynatraceEnabled() {
  return mockDynatraceSDK && hanaDynatrace.isDynatraceEnabled();
}

describeDynatrace('db', function () {
  before(function (done) {
    if (isMockDynatraceEnabled()) {
      mockDynatraceSDK.enableTrace();
    }
    if (mockDynatraceSDK) {
      db.init.bind(db)(done);
    } else {
      // Real dynatrace, create an inbound web request
      server = http.createServer(function onRequest(req, res) {
        request = res;
        db.init.bind(db)(done);
      }).listen(8001).on("listening", () => http.get("http://localhost:" + server.address().port));;
    }
    
  });
  after(function (done) {
    if (isMockDynatraceEnabled()) {
      mockDynatraceSDK.disableTrace();
    }
    if (mockDynatraceSDK) {
      db.end.bind(db)(done);
    } else {
      // Real dynatrace, stop the web request
      request.end();
      server.close();
      db.end.bind(db)(done);
    }
    
  })
  var client = db.client;

  describeDynatrace('Dynatrace', function () {
    it('should trace a prepared statement exec', function (done) {
      var sql = 'SELECT 1 FROM DUMMY';
      var destInfo = getDestInfoForDynatrace();
      client.prepare(sql, function (err, stmt) {
        if (err) done(err);
        stmt.exec([], function (err, rows) {
          if (err) done(err);
          rows.should.have.length(1);
          rows[0]['1'].should.equal(1);
          verifyDynatraceData(destInfo, sql, 1);
          cleanup(stmt, done);
        });
      });
    });

    it('should trace a client exec', function (done) {
      var destInfo = getDestInfoForDynatrace();
      var sql = 'SELECT TOP 10 * FROM OBJECTS';
      client.exec(sql, function (err, rows) {
        if (err) done(err);
        rows.should.have.length(10);
        verifyDynatraceData(destInfo, sql, 10);
        done();
      });
    });

    it('should trace exec / prepare errors', function (done) {
      var destInfo = getDestInfoForDynatrace();
      function testExecSqlSyntaxError(input) {
        return function execError(cb) {
          client.exec(input, function (err) {
            err.should.be.an.instanceOf(Error);
            // When the sql input is not a string, we log an empty string in dynatrace
            verifyDynatraceData(destInfo, typeof input === 'string' ? input : '', undefined, { code: 257 });
            cb();
          })
        }
      }
      function testPrepareSqlSyntaxError(input) {
        return function prepareError(cb) {
          client.prepare(input, function (err, statement) {
            (!!statement).should.not.be.ok;
            err.should.be.an.instanceOf(Error);
            verifyDynatraceData(destInfo, typeof input === 'string' ? input : '', undefined, { code: 257 });
            cb();
          })
        }
      }
      function castError(cb) {
        var sql = 'SELECT CAST(? AS INT) FROM DUMMY';
        client.prepare(sql, function (err, statement) {
          if (err) cb(err);
          statement.exec(['string to int cast'], function (err) {
            err.should.be.an.instanceOf(Error);
            verifyDynatraceData(destInfo, sql, undefined, {
              message: 'Cannot set parameter at row: 1. Wrong input for INT type'
            });
            cleanup(statement, cb);
          })
        });
      }

      async.series([testExecSqlSyntaxError('SELECT 2 SYNTAX ERROR'), testExecSqlSyntaxError([2]),
        testExecSqlSyntaxError('SELECT * FROM /* SYNTAX ERROR */'),
        testPrepareSqlSyntaxError('SELECT 3 SYNTAX ERROR'), testPrepareSqlSyntaxError([3]),
        testPrepareSqlSyntaxError('SELECT /* SYNTAX ERROR */ FROM DUMMY'), castError], done);
    });

    it('should trace a statement exec unbound parameters error', function (done) {
      var destInfo = getDestInfoForDynatrace();
      var sql = 'SELECT ? FROM DUMMY';
      client.prepare(sql, function (err, stmt) {
        if (err) done(err);
        stmt.exec([], function (err, rows) {
          err.should.be.an.instanceOf(Error);
          verifyDynatraceData(destInfo, sql, undefined, { message: "Unbound parameters found." });
          cleanup(stmt, done);
        });
      });
    });

    it('should time an exec', function (done) {
      var destInfo = getDestInfoForDynatrace();
      var sql = 'SELECT 2 FROM DUMMY';
      client.prepare(sql, function (err, stmt) {
        if (err) done(err);
        var beforeExecTime = new Date();
        stmt.exec([], function (err, rows) {
          var afterExecTime = new Date();
          if (err) done(err);
          rows.should.have.length(1);
          rows[0]['2'].should.equal(2);
          var elapsedExecTime = afterExecTime - beforeExecTime;
          verifyDynatraceRequestTime(Math.max(0, elapsedExecTime - 1000), elapsedExecTime);
          verifyDynatraceData(destInfo, sql, 1);
          cleanup(stmt, done);
        })
      });
    });

    it('should time a 2 second procedure', function (done) {
      this.timeout(3000);
      var destInfo = getDestInfoForDynatrace();
      var sql = 'DO BEGIN CALL SQLSCRIPT_SYNC:SLEEP_SECONDS(2); END';
      client.prepare(sql, function (err, stmt) {
        if (err) done(err);
        var beforeExecTime = new Date();
        stmt.exec([], function (err, params) {
          var afterExecTime = new Date();
          if (err) done(err);
          var elapsedExecTime = afterExecTime - beforeExecTime;
          elapsedExecTime.should.be.aboveOrEqual(1900);
          verifyDynatraceRequestTime(Math.max(1900, elapsedExecTime - 1000), elapsedExecTime);
          // This db call does not return any rows, so the behaviour is to not log any rowsReturned
          verifyDynatraceData(destInfo, sql, undefined);
          cleanup(stmt, done);
        });
      });
    });

    it('should trace multiple exec with a statement', function (done) {
      var destInfo = getDestInfoForDynatrace();
      var sql = 'SELECT ? FROM DUMMY';
      var statement;
      function prepare (cb) {
        client.prepare(sql, function (err, ps) {
          if (err) done(err);
          statement = ps;
          cb(err);
        });
      }
      function testExecStatement(input) {
        return function execStatement(cb) {
          var beforeExecTime = new Date();
          statement.exec(input, function (err, rows) {
            var afterExecTime = new Date();
            if (err) done(err);
            var elapsedExecTime = afterExecTime - beforeExecTime;
            verifyDynatraceRequestTime(Math.max(0, elapsedExecTime - 1000), elapsedExecTime);
            verifyDynatraceData(destInfo, sql, 1);
            rows.should.have.length(1);
            rows[0][':1'].should.equal(input[0]);
            cb();
          });
        };
      }
      function dropStatement(cb) {
        cleanup(statement, cb);
      }

      async.waterfall([prepare, testExecStatement(['1']), testExecStatement(['2']), dropStatement], done);
    });

    it('should trace a client execute', function (done) {
      var destInfo = getDestInfoForDynatrace();
      var sql = 'SELECT TOP 10 * FROM OBJECTS';
      client.execute(sql, function (err, rs) {
        if (err) done(err);
        verifyDynatraceData(destInfo, sql, 10);
        rs.fetch(function (err, rows) {
          if (err) done(err);
          rows.should.have.length(10);
          if (!rs.closed) {
            rs.close();
          }
          done();
        });
      });
    });

    function testDynatraceExecuteNRows(numRows, cb) {
      var destInfo = getDestInfoForDynatrace();
      var sql = 'SELECT TOP ? * FROM OBJECTS';
      client.prepare(sql, function (err, stmt) {
        if (err) cb(err);
        stmt.execute([numRows], function (err, rs) {
          if (err) cb(err);
          // FYI, we define the Dynatrace end as when the execQuery callback is called
          // If there are more than 32 rows, we don't know the number of rows returned
          // because we only know the actual number of rows when we've received the last
          // fetch chunk.
          const expectedNumRows = (numRows > 32) ? undefined : numRows;
          verifyDynatraceData(destInfo, sql, expectedNumRows);
          rs.fetch(function (err, rows) {
            if (err) cb(err);
            rows.should.have.length(numRows);
            if (!rs.closed) {
              rs.close();
            }
            cleanup(stmt, cb);
          });
        })
      });
    }

    it('should trace a execute with a result set with 1 row', function (done) {
      testDynatraceExecuteNRows(1, done);
    });
    it('should trace a execute with a result set with 32 rows', function (done) {
      testDynatraceExecuteNRows(32, done);
    });
    it('should trace a execute with a result set with 33 rows', function (done) {
      testDynatraceExecuteNRows(33, done);
    });
    it('should trace a execute with a result set with 0 rows', function (done) {
      var destInfo = getDestInfoForDynatrace();
      var sql = 'SELECT 3 FROM DUMMY WHERE 1 = 0';
      client.prepare(sql, function (err, stmt) {
        if (err) done(err);
        stmt.execute([], function (err, rs) {
          if (err) done(err);
          verifyDynatraceData(destInfo, sql, 0);
          rs.fetch(function (err, rows) {
            if (err) done(err);
            rows.should.have.length(0);
            if (!rs.closed) {
              rs.close();
            }
            cleanup(stmt, done);
          });
        })
      });
    });

    it('should trace multiple execute with a statement', function (done) {
      var destInfo = getDestInfoForDynatrace();
      var sql = 'SELECT 1 FROM DUMMY WHERE 1 = ?';
      var statement;
      function clearTraceData(cb) {
        if (isMockDynatraceEnabled()) {
          mockDynatraceSDK.clearTraceData();
          mockDynatraceSDK.getTraceData().should.be.empty;
        }
        cb();
      }
      function prepare (cb) {
        client.prepare(sql, function (err, ps) {
          if (err) done(err);
          statement = ps;
          cb(err);
        });
      }
      function testExecuteStatement(input, expectedRows) {
        return function executeStatement(cb) {
          var beforeExecTime = new Date();
          statement.execute(input, function (err, rs) {
            var afterExecTime = new Date();
            if (err) done(err);
            var elapsedExecTime = afterExecTime - beforeExecTime;
            if (isMockDynatraceEnabled()) {
              Object.keys(mockDynatraceSDK.getTraceData()).should.have.length(1);
            }
            verifyDynatraceRequestTime(Math.max(0, elapsedExecTime - 1000), elapsedExecTime);
            verifyDynatraceData(destInfo, sql, expectedRows.length);
            rs.fetch(function (err, rows) {
              rows.should.eql(expectedRows);
              if (!rs.closed) {
                rs.close();
              }
              cb();
            })
          });
        };
      }
      function dropStatement(cb) {
        cleanup(statement, cb);
      }

      async.waterfall([clearTraceData, prepare, testExecuteStatement(['1'], [{ '1': 1 }]),
        testExecuteStatement(['2'], []), dropStatement], done);
    });

    it('should disable dynatrace with environment variable', function (done) {
      var skipDynatrace = process.env.HDB_NODEJS_SKIP_DYNATRACE;
      process.env.HDB_NODEJS_SKIP_DYNATRACE = true;
      hanaDynatrace.isDynatraceEnabled().should.equal(false);
      if (skipDynatrace) {
        process.env.HDB_NODEJS_SKIP_DYNATRACE = skipDynatrace;
      } else {
        delete process.env.HDB_NODEJS_SKIP_DYNATRACE;
      }
      done();
    });

    it('should disable dynatrace with dynatrace connect option (only tested on mock)', function (done) {
      if (!isMockDynatraceEnabled()) {
        // The disabling of dynatrace using the dynatrace connect option can only be validated
        // when dynatrace is enabled (no skip env and oneagent-sdk exists) and we are using the mock
        this.skip();
      } else {
        var destInfo = getDestInfoForDynatrace();
        var sql = 'SELECT 1 FROM DUMMY';
        mockDynatraceSDK.clearTraceData();
        var nonDynatraceDB = require('../db')({dynatrace: false});
        nonDynatraceDB.init(function (err) {
          if (err) done(err);
          var nonDynatraceClient = nonDynatraceDB.client;
          nonDynatraceClient.exec(sql, function (err, rows) {
            if (err) done(err);
            rows.should.have.length(1);
            Object.keys(mockDynatraceSDK.getTraceData()).length.should.equal(0);

            // Manually re-enable the Dynatrace extension
            hanaDynatrace.dynatraceConnection(nonDynatraceClient, destInfo);
            nonDynatraceClient.exec(sql, function (err, rows) {
              if (err) done(err);
              Object.keys(mockDynatraceSDK.getTraceData()).length.should.equal(1);
              verifyDynatraceData(destInfo, sql, 1);
              nonDynatraceDB.end(done);
            });
          });
        });
      }
    });

    it('should configure a dynatraceTenant option', function (done) {
      var tenantName = 'DynatraceTenant';
      var destInfo = getDestInfoForDynatrace(tenantName);
      var sql = 'SELECT 1 FROM DUMMY';
      if (isMockDynatraceEnabled()) {
        mockDynatraceSDK.clearTraceData();
      }
      var tenantDB = require('../db')({dynatrace: true, dynatraceTenant: tenantName});
      tenantDB.init(function (err) {
        if (err) done(err);
        var tenantClient = tenantDB.client;
        tenantClient.exec(sql, function (err, rows) {
          if (err) done(err);
          verifyDynatraceData(destInfo, sql, 1);
          tenantDB.end(done);
        });
      });
    });

    describeDynatrace('using table', function () {
      beforeEach(db.createTable.bind(db, 'TEST_DYNATRACE', ['ID INT UNIQUE NOT NULL'], null));
      afterEach(db.dropTable.bind(db, 'TEST_DYNATRACE'));

      it('should trace a client insert', function (done) {
        var destInfo = getDestInfoForDynatrace();
        var sql = 'INSERT INTO TEST_DYNATRACE VALUES(1)';
        client.exec(sql, function (err, rowsAffected) {
          if (err) done(err);
          rowsAffected.should.equal(1);
          // Trace rows affected as rows returned
          verifyDynatraceData(destInfo, sql, 1);
          client.exec('SELECT COUNT(*) FROM TEST_DYNATRACE', {rowsAsArray: true}, function (err, rows) {
            if (err) done(err);
            rows[0][0].should.equal(1);
            done();
          });
        });
      });

      it('should trace a prepared statement delete', function (done) {
        var destInfo = getDestInfoForDynatrace();
        var sql = 'DELETE FROM TEST_DYNATRACE';
        client.exec('INSERT INTO TEST_DYNATRACE VALUES(1)', function (err, rowsAffected) {
          if (err) done(err);
          client.exec('INSERT INTO TEST_DYNATRACE VALUES(2)', function (err, rowsAffected) {
            if (err) done(err);
            client.prepare(sql, function (err, stmt) {
              if (err) done(err);
              stmt.exec([], function (err, rowsAffected) {
                rowsAffected.should.equal(2);
                verifyDynatraceData(destInfo, sql, 2);
                client.exec('SELECT COUNT(*) FROM TEST_DYNATRACE', {rowsAsArray: true}, function (err, rows) {
                  if (err) done(err);
                  rows[0][0].should.equal(0);
                  cleanup(stmt, done);
                });
              });
            });
          });
        });
      });

      it('should trace a statement batch exec', function (done) {
        var destInfo = getDestInfoForDynatrace();
        var sql = 'INSERT INTO TEST_DYNATRACE VALUES(?)';
        client.prepare(sql, function (err, stmt) {
          if (err) done(err);
          stmt.exec([[1], [2], [3], [4]], function (err, rowsAffected) {
            if (err) done(err);
            rowsAffected.should.eql([1, 1, 1, 1]);
            verifyDynatraceData(destInfo, sql, 4);
            client.exec('SELECT COUNT(*) FROM TEST_DYNATRACE', {rowsAsArray: true}, function (err, rows) {
              if (err) done(err);
              rows[0][0].should.equal(4);
              cleanup(stmt, done);
            });
          });
        });
      });

      it('should trace a statement batch exec error', function (done) {
        var destInfo = getDestInfoForDynatrace();
        var sql = 'INSERT INTO TEST_DYNATRACE VALUES(?)';
        client.prepare(sql, function (err, stmt) {
          if (err) done(err);
          stmt.exec([['string going to int column'], ['2']], function (err, rowsAffected) {
            err.should.be.an.instanceOf(Error);
            (!!rowsAffected).should.not.be.ok;
            verifyDynatraceData(destInfo, sql, undefined, {
              message: 'Cannot set parameter at row: 1. Wrong input for INT type'
            });
            cleanup(stmt, done);
          });
        });
      });
    });
  });

  function getDestInfoForDynatrace(tenant) {
    return { host: client.get('host'), port: client.get('port'), tenant: tenant };
  }
});

function verifyDynatraceData(destInfo, sql, expectedRowsReturned, expectedError) {
  if(isMockDynatraceEnabled()) { // Only validate the data on the mock dynatrace sdk
    var got = mockDynatraceSDK.getTraceData()[mockDynatraceSDK.getLastTraceNum()];
    got.should.not.be.undefined;
    if(got) {
        if (expectedError) {
          (!!got.error).should.be.ok;
          if (expectedError.code) {
            got.error.code.should.equal(expectedError.code);
          }
          if (expectedError.message) {
            got.error.message.should.equal(expectedError.message);
          }
        } else {
          (!!got.error).should.be.not.ok;
        }
        got.dbInfo.name.should.eql(destInfo.tenant ? 'SAPHANA-' + destInfo.tenant : 'SAPHANA');
        got.dbInfo.vendor.should.eql('HANADB');
        got.dbInfo.host.should.eql(destInfo.host);
        got.dbInfo.port.should.eql(Number(destInfo.port));
        got.sql.should.eql(sql);
        got.startTime.should.not.be.undefined;
        if (expectedRowsReturned !== undefined) {
          got.rowsReturned.should.equal(expectedRowsReturned);
        } else {
          (got.rowsReturned === undefined).should.be.ok;
        }
        got.endTime.should.not.be.undefined;
        got.endTime.should.be.aboveOrEqual(got.startTime);
    }
    mockDynatraceSDK.clearTraceData();
  }
}

// must be called before verifyDynatraceData since that clears the trace data
function verifyDynatraceRequestTime(minAllowedMS, maxAllowedMS) {
  if(isMockDynatraceEnabled()) {
    var got = mockDynatraceSDK.getTraceData()[mockDynatraceSDK.getLastTraceNum()];
    got.should.not.be.undefined;
    if(got) {
        var gotElapsedTime = got.endTime - got.startTime;
        gotElapsedTime.should.be.aboveOrEqual(minAllowedMS);
        gotElapsedTime.should.be.belowOrEqual(maxAllowedMS);
    }
  }
}

function cleanup(stmt, cb) {
  stmt.drop(function (err) {
    // ignore error
    cb();
  })
}