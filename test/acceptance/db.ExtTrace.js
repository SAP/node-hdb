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
var RemoteDB = require('../db/RemoteDB');
var util = require('../../lib/util');
// Both Dynatrace and OpenTelemetry are considered External tracers (ExtTrace)
var hanaDynatrace = require('../../extension/Dynatrace');
var dynatraceSDK; // either the real @dynatrace/oneagent-sdk Dynatrace SDK or the mock one
var hanaOpenTel = require('../../extension/OpenTelemetry');
var openTelAPI; // either the real @opentelemetry/api OpenTelemetry API or the mock one
var mockExtTrace; // either mock @dynatrace/oneagent-sdk or mock @opentelemetry/api
var http, server, request;
var db, isRemoteDB;
const openTelTestVar = process.env.ENABLE_NODE_OPENTEL_TESTS;
const testOpenTel = openTelTestVar && openTelTestVar != '0' && openTelTestVar.toLowerCase() != 'false';
try {
  if (testOpenTel) {
    // Avoid getting dynatrace tracing (should be redundant since OpenTelemetry is preferred
    // over dynatrace)
    db = require('../db')({dynatrace: false});
    openTelAPI = require('@opentelemetry/api');
    if (openTelAPI.getTraceData !== undefined) {
      // Using mock @opentelemetry/api
      mockExtTrace = openTelAPI;
    } else {
      // Using real @opentelemetry/api, so setup web request
      http = require('http');
    }
  } else {
    dynatraceSDK = require('@dynatrace/oneagent-sdk');
    // When testing dynatrace, disable open telemetry so that the tracing will go to dynatrace
    db = require('../db')({openTelemetry: false});
    if (dynatraceSDK.getTraceData !== undefined) {
        // Using mock @dynatrace/oneagent-sdk
        mockExtTrace = dynatraceSDK;
    } else {
      // Using real @dynatrace/oneagent-sdk, so setup web request
      http = require('http');
    }
  }
  isRemoteDB = db instanceof RemoteDB;
} catch (err) {
  // No @dynatrace/oneagent-sdk / @opentelemetry/api, skip this test, see
  // MockDynatraceSDK / MockOpenTelemetryAPI to "install" the mock to run
  // these tests
}

var describeExtTrace = (db instanceof RemoteDB && ((!testOpenTel && dynatraceSDK !== undefined) ||
  (testOpenTel && openTelAPI !== undefined))) ? describe : describe.skip;

function isMockExtTraceEnabled() {
  if (testOpenTel) {
    return mockExtTrace && hanaOpenTel.isOpenTelemetryEnabled();
  } else {
    return mockExtTrace && hanaDynatrace.isDynatraceEnabled();
  }
}

describeExtTrace('db', function () {
  before(function (done) {
    if (isMockExtTraceEnabled()) {
      mockExtTrace.enableTrace();
    }
    if (mockExtTrace) {
      db.init.bind(db)(done);
    } else {
      // Real external trace, create an inbound web request
      server = http.createServer(function onRequest(req, res) {
        request = res;
        db.init.bind(db)(done);
      }).listen(8001).on("listening", () => http.get("http://localhost:" + server.address().port));;
    }
  });
  after(function (done) {
    if (isMockExtTraceEnabled()) {
      mockExtTrace.disableTrace();
    }
    if (mockExtTrace) {
      db.end.bind(db)(done);
    } else {
      // Real external trace, stop the web request
      request.end();
      server.close();
      db.end.bind(db)(done);
    }
  });
  // If the db is undefined, we will skip the tests
  var client = db ? db.client : undefined;

  describeExtTrace('external trace', function () {
    it('should trace a prepared statement exec', function (done) {
      var sql = 'SELECT 1 FROM DUMMY';
      var destInfo = getDestInfoForExtTrace();
      client.prepare(sql, function (err, stmt) {
        if (err) done(err);
        verifyOpenTelData('prepare - ' + sql, destInfo, sql);
        stmt.exec([], function (err, rows) {
          if (err) done(err);
          rows.should.have.length(1);
          rows[0]['1'].should.equal(1);
          verifyOpenTelSpan('exec - ' + sql);
          verifyExtTraceData(destInfo, sql, 1);
          cleanup(stmt, done);
        });
      });
    });

    it('should trace a client exec', function (done) {
      var destInfo = getDestInfoForExtTrace();
      var sql = 'SELECT TOP 10 * FROM OBJECTS';
      client.exec(sql, function (err, rows) {
        if (err) done(err);
        rows.should.have.length(10);
        verifyOpenTelSpan('exec - ' + sql);
        verifyExtTraceData(destInfo, sql, 10);
        done();
      });
    });

    it('should trace exec / prepare errors', function (done) {
      var destInfo = getDestInfoForExtTrace();
      function testExecSqlSyntaxError(input) {
        return function execError(cb) {
          client.exec(input, function (err) {
            err.should.be.an.instanceOf(Error);
            // When the sql input is not a string, we log an empty string for the sql in the external trace
            verifyOpenTelSpan((typeof input === 'string' ? 'exec - ' + input : 'exec'));
            verifyExtTraceData(destInfo, typeof input === 'string' ? input : '', undefined, { code: 257 });
            cb();
          })
        }
      }
      function testPrepareSqlSyntaxError(input) {
        return function prepareError(cb) {
          client.prepare(input, function (err, statement) {
            (!!statement).should.not.be.ok;
            err.should.be.an.instanceOf(Error);
            verifyOpenTelSpan((typeof input === 'string' ? 'prepare - ' + input : 'prepare'));
            verifyExtTraceData(destInfo, typeof input === 'string' ? input : '', undefined, { code: 257 });
            cb();
          })
        }
      }
      function castError(cb) {
        var sql = 'SELECT CAST(? AS INT) FROM DUMMY';
        client.prepare(sql, function (err, statement) {
          if (err) cb(err);
          verifyOpenTelData('prepare - ' + sql, destInfo, sql);
          // Check server version since HANA 2 SPS05 gives a server error
          var version = db.getHANAFullVersion();
          var versionSplit = version.split(".");
          var major = Number(versionSplit[0]);
          var revision = Number(versionSplit[2]);
          if (!(major == 2 && revision < 70)) {
            statement.exec(['string to int cast'], function (err) {
              err.should.be.an.instanceOf(Error);
              verifyOpenTelSpan('exec - ' + sql);
              verifyExtTraceData(destInfo, sql, undefined, {
                message: 'Cannot set parameter at row: 1. Wrong input for INT type'
              });
              cleanup(statement, cb);
            });
          } else {
            // Skip part of test on pre HANA2sp7
            cb();
          }
        });
      }

      async.series([testExecSqlSyntaxError('SELECT 2 SYNTAX ERROR'), testExecSqlSyntaxError([2]),
        testExecSqlSyntaxError('SELECT * FROM /* SYNTAX ERROR */'),
        testPrepareSqlSyntaxError('SELECT 3 SYNTAX ERROR'), testPrepareSqlSyntaxError([3]),
        testPrepareSqlSyntaxError('SELECT /* SYNTAX ERROR */ FROM DUMMY'), castError], done);
    });

    it('should trace a statement exec unbound parameters error', function (done) {
      var destInfo = getDestInfoForExtTrace();
      var sql = 'SELECT ? FROM DUMMY';
      client.prepare(sql, function (err, stmt) {
        if (err) done(err);
        verifyOpenTelData('prepare - ' + sql, destInfo, sql);
        stmt.exec([], function (err, rows) {
          err.should.be.an.instanceOf(Error);
          verifyOpenTelSpan('exec - ' + sql);
          verifyExtTraceData(destInfo, sql, undefined, { message: "Unbound parameters found." });
          cleanup(stmt, done);
        });
      });
    });

    it('should time an exec', function (done) {
      var destInfo = getDestInfoForExtTrace();
      var sql = 'SELECT 2 FROM DUMMY';
      client.prepare(sql, function (err, stmt) {
        if (err) done(err);
        verifyOpenTelData('prepare - ' + sql, destInfo, sql);
        var beforeExecTime = new Date();
        stmt.exec([], function (err, rows) {
          var afterExecTime = new Date();
          if (err) done(err);
          rows.should.have.length(1);
          rows[0]['2'].should.equal(2);
          var elapsedExecTime = afterExecTime - beforeExecTime;
          verifyExtTraceRequestTime(Math.max(0, elapsedExecTime - 1000), elapsedExecTime);
          verifyOpenTelSpan('exec - ' + sql);
          verifyExtTraceData(destInfo, sql, 1);
          cleanup(stmt, done);
        })
      });
    });

    it('should time a 2 second procedure', function (done) {
      this.timeout(3000);
      var destInfo = getDestInfoForExtTrace();
      var sql = 'DO BEGIN CALL SQLSCRIPT_SYNC:SLEEP_SECONDS(2); END';
      client.prepare(sql, function (err, stmt) {
        if (err) done(err);
        verifyOpenTelData('prepare - ' + sql, destInfo, sql);
        var beforeExecTime = new Date();
        stmt.exec([], function (err, params) {
          var afterExecTime = new Date();
          if (err) done(err);
          var elapsedExecTime = afterExecTime - beforeExecTime;
          elapsedExecTime.should.be.aboveOrEqual(1900);
          verifyExtTraceRequestTime(Math.max(1900, elapsedExecTime - 1000), elapsedExecTime);
          verifyOpenTelSpan('exec - ' + sql);
          // This db call does not return any rows, so the behaviour is to not log any rowsReturned
          verifyExtTraceData(destInfo, sql, undefined);
          cleanup(stmt, done);
        });
      });
    });

    it('should trace multiple exec with a statement', function (done) {
      var destInfo = getDestInfoForExtTrace();
      var sql = 'SELECT ? FROM DUMMY';
      var statement;
      function prepare (cb) {
        client.prepare(sql, function (err, ps) {
          if (err) done(err);
          statement = ps;
          verifyOpenTelData('prepare - ' + sql, destInfo, sql);
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
            verifyExtTraceRequestTime(Math.max(0, elapsedExecTime - 1000), elapsedExecTime);
            verifyOpenTelSpan('exec - ' + sql);
            verifyExtTraceData(destInfo, sql, 1);
            rows.should.have.length(1);
            rows[0][':1'].should.equal(input[0]);
            cb();
          });
        };
      }
      // Test that commits are traced for OpenTelemetry, since auto commit is on
      // the commit has no effect
      function commit(cb) {
        client.commit(function (err) {
          if (err) done(err);
          verifyOpenTelData('commit', destInfo);
          cb();
        });
      }
      function dropStatement(cb) {
        cleanup(statement, cb);
      }

      async.waterfall([prepare, testExecStatement(['1']), testExecStatement(['2']), commit, dropStatement], done);
    });

    it('should trace a client exec with 2k length sql', function (done) {
      var destInfo = getDestInfoForExtTrace();
      var sql = "SELECT '" + 'A'.repeat(2000) + "' FROM DUMMY";
      client.exec(sql, function (err, rows) {
        if (err) done(err);
        rows.should.have.length(1);
        // Our extension/OpenTelemetry.js truncates the span name to 80 characters
        // and sql to 1000 chars.
        // Our extension/Dynatrace.js does not truncate sql since Dynatrace itself
        // sanitizes SQL and limits it to 1000 characters.
        var sqlTrunc1000 = sql.substring(0, 999) + '…';
        var spanNameTrunc80 = ("exec - " + sql).substring(0, 79) + '…';
        verifyOpenTelSpan(spanNameTrunc80);
        verifyExtTraceData(destInfo, testOpenTel ? sqlTrunc1000 : sql, 1);
        done();
      });
    });

    it('should trace a client execute with a result set with 10 rows', function (done) {
      var destInfo = getDestInfoForExtTrace();
      var sql = 'SELECT TOP 10 * FROM OBJECTS';
      client.execute(sql, function (err, rs) {
        if (err) done(err);
        verifyOpenTelSpan('execute - ' + sql);
        verifyExtTraceData(destInfo, sql, 10);
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

    function testExtTraceExecuteNRows(numRows, cb) {
      var destInfo = getDestInfoForExtTrace();
      var sql = 'SELECT TOP ? * FROM OBJECTS';
      client.prepare(sql, function (err, stmt) {
        if (err) cb(err);
        verifyOpenTelData('prepare - ' + sql, destInfo, sql);
        stmt.execute([numRows], function (err, rs) {
          if (err) cb(err);
          // FYI, we define the ExtTrace end as when the execQuery callback is called
          // If there are more than 32 rows, we don't know the number of rows returned
          // because we only know the actual number of rows when we've received the last
          // fetch chunk.
          const expectedNumRows = (numRows > 32) ? undefined : numRows;
          verifyOpenTelSpan('execute - ' + sql);
          verifyExtTraceData(destInfo, sql, expectedNumRows);
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

    it('should trace a statement execute with a result set with 1 row', function (done) {
      testExtTraceExecuteNRows(1, done);
    });
    it('should trace a statement execute with a result set with 32 rows', function (done) {
      testExtTraceExecuteNRows(32, done);
    });
    it('should trace a statement execute with a result set with 33 rows', function (done) {
      testExtTraceExecuteNRows(33, done);
    });
    it('should trace a statement execute with a result set with 0 rows', function (done) {
      var destInfo = getDestInfoForExtTrace();
      var sql = 'SELECT 3 FROM DUMMY WHERE 1 = 0';
      client.prepare(sql, function (err, stmt) {
        if (err) done(err);
        verifyOpenTelData('prepare - ' + sql, destInfo, sql);
        stmt.execute([], function (err, rs) {
          if (err) done(err);
          verifyOpenTelSpan('execute - ' + sql);
          verifyExtTraceData(destInfo, sql, 0);
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
      var destInfo = getDestInfoForExtTrace();
      var sql = 'SELECT 1 FROM DUMMY WHERE 1 = ?';
      var statement;
      function clearTraceData(cb) {
        if (isMockExtTraceEnabled()) {
          mockExtTrace.clearTraceData();
          mockExtTrace.getTraceData().should.be.empty;
        }
        cb();
      }
      function prepare (cb) {
        client.prepare(sql, function (err, ps) {
          if (err) done(err);
          statement = ps;
          verifyOpenTelData('prepare - ' + sql, destInfo, sql);
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
            if (isMockExtTraceEnabled()) {
              Object.keys(mockExtTrace.getTraceData()).should.have.length(1);
            }
            verifyExtTraceRequestTime(Math.max(0, elapsedExecTime - 1000), elapsedExecTime);
            verifyOpenTelSpan('execute - ' + sql);
            verifyExtTraceData(destInfo, sql, expectedRows.length);
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
      // Test that rollbacks are traced for OpenTelemetry, since auto commit is on
      // the rollback has no effect
      function rollback(cb) {
        client.rollback(function (err) {
          if (err) done(err);
          verifyOpenTelData('rollback', destInfo);
          cb();
        });
      }
      function dropStatement(cb) {
        cleanup(statement, cb);
      }

      async.waterfall([clearTraceData, prepare, testExecuteStatement(['1'], [{ '1': 1 }]),
        testExecuteStatement(['2'], []), rollback, dropStatement], done);
    });

    it('should trace the first rows result in a DB call', function (done) {
      var destInfo = getDestInfoForExtTrace();
      var sql = `DO (IN P1 INTEGER => ?, OUT P2 INTEGER => ?, OUT P3 INTEGER => ?)
                 BEGIN
                   P2 = :P1 + 1;
                   P3 = :P1 + 2;
                   SELECT TOP 10 * FROM OBJECTS;
                   SELECT 'A' AS A FROM DUMMY;
                 END`;
      client.prepare(sql, function (err, stmt) {
        if (err) done(err);
        // Our extension/OpenTelemetry.js truncates the span name to 80 characters
        var spanPrepName80 = ("prepare - " + sql).substring(0, 79) + '…';
        verifyOpenTelData(spanPrepName80, destInfo, sql);
        stmt.exec([1], function (err, params, objRows, dummyRows) {
          if (err) done(err);
          params.should.eql({ P2: 2, P3: 3 });
          objRows.should.have.length(10);
          dummyRows.should.have.length(1);
          var spanExecName80 = ("exec - " + sql).substring(0, 79) + '…';
          verifyOpenTelSpan(spanExecName80);
          // The current behaviour is that the rows returned is traced as the length
          // of the first rows result (not object parameters)
          verifyExtTraceData(destInfo, sql, 10);
          cleanup(stmt, done);
        });
      });
    });

    it('should disable Dynatrace / OpenTelemetry with environment variable', function (done) {
      if (testOpenTel) {
        var skipOpenTelemetry = process.env.HDB_NODEJS_SKIP_OPENTELEMETRY;
        process.env.HDB_NODEJS_SKIP_OPENTELEMETRY = true;
        hanaOpenTel.isOpenTelemetryEnabled().should.equal(false);
        if (skipOpenTelemetry) {
          process.env.HDB_NODEJS_SKIP_OPENTELEMETRY = skipOpenTelemetry;
        } else {
          delete process.env.HDB_NODEJS_SKIP_OPENTELEMETRY;
        }
      } else {
        var skipDynatrace = process.env.HDB_NODEJS_SKIP_DYNATRACE;
        process.env.HDB_NODEJS_SKIP_DYNATRACE = true;
        hanaDynatrace.isDynatraceEnabled().should.equal(false);
        if (skipDynatrace) {
          process.env.HDB_NODEJS_SKIP_DYNATRACE = skipDynatrace;
        } else {
          delete process.env.HDB_NODEJS_SKIP_DYNATRACE;
        }
      }
      done();
    });

    it('should disable Dynatrace / OpenTelemetry with dynatrace / openTelemetry connect ' +
       'option (only tested on mock)', function (done) {
      if (!isMockExtTraceEnabled()) {
        // The disabling of Dynatrace / OpenTelemetry using the dynatrace / openTelemetry connect
        // option can only be validated when Dynatrace / OpenTelemetry is enabled (no skip env
        // and oneagent-sdk / opentelemetry/api exists) and we are using the mock
        this.skip();
      } else {
        var destInfo = getDestInfoForExtTrace();
        var sql = 'SELECT 1 FROM DUMMY';
        mockExtTrace.clearTraceData();
        var nonExtTraceDB = require('../db')({dynatrace: false, openTelemetry: false});
        nonExtTraceDB.init(function (err) {
          if (err) done(err);
          var nonExtTraceClient = nonExtTraceDB.client;
          nonExtTraceClient.exec(sql, function (err, rows) {
            if (err) done(err);
            rows.should.have.length(1);
            Object.keys(mockExtTrace.getTraceData()).length.should.equal(0);

            // Manually re-enable the Dynatrace / OpenTelemetry extension
            if (testOpenTel) {
              hanaOpenTel.openTelemetryConnection(nonExtTraceClient, destInfo);
            } else {
              hanaDynatrace.dynatraceConnection(nonExtTraceClient, destInfo);
            }
            nonExtTraceClient.exec(sql, function (err, rows) {
              if (err) done(err);
              Object.keys(mockExtTrace.getTraceData()).length.should.equal(1);
              verifyOpenTelSpan('exec - ' + sql);
              verifyExtTraceData(destInfo, sql, 1);
              nonExtTraceDB.end(done);
            });
          });
        });
      }
    });

    it('should configure a dynatraceTenant / openTelemetryTenant option', function (done) {
      var tenantName = 'ExternalTraceTenant';
      var destInfo = getDestInfoForExtTrace(tenantName);
      var sql = 'SELECT 1 FROM DUMMY';
      if (isMockExtTraceEnabled()) {
        mockExtTrace.clearTraceData();
      }
      var tenantDB;
      if (testOpenTel) {
        tenantDB = require('../db')({openTelemetry: true});
        // The db module will save settings, so we set the tenant settings directly in the client
        // as they cannot be easily rewritten once saved
        tenantDB.client.set('openTelemetryTenant', tenantName);
      } else {
        tenantDB = require('../db')({dynatrace: true});
        tenantDB.client.set('dynatraceTenant', tenantName);
      }
      tenantDB.init(function (err) {
        if (err) done(err);
        var tenantClient = tenantDB.client;
        tenantClient.exec(sql, function (err, rows) {
          if (err) done(err);
          verifyOpenTelSpan('exec - ' + sql);
          verifyExtTraceData(destInfo, sql, 1);
          tenantDB.end(done);
        });
      });
    });

    it('should prefer OpenTelemetry over Dynatrace', function (done) {
      if (!(isMockExtTraceEnabled() && hanaOpenTel.isOpenTelemetryEnabled()
        && hanaDynatrace.isDynatraceEnabled())) {
        // Preferring OpenTelemetry can only be tested when OpenTelemetry and Dynatrace
        // are enabled and we are using the mock of Dynatrace or OpenTelemetry
        this.skip();
      } else {
        var destInfo = getDestInfoForExtTrace();
        var sql = 'SELECT 1 FROM DUMMY';
        var noPreferenceDB = require('../db')({dynatrace: true, openTelemetry: true});
        noPreferenceDB.init(function (err) {
          if (err) done(err);
          var noPrefClient = noPreferenceDB.client;
          noPrefClient.exec(sql, function (err, rows) {
            if (err) done(err);
            rows.should.have.length(1);
            if (testOpenTel) {
              // ensure we traced to OpenTelemetry even though Dynatrace was avaliable
              Object.keys(mockExtTrace.getTraceData()).length.should.equal(1);
              verifyOpenTelData('exec - ' + sql, destInfo, sql, 1);
            } else {
              // since OpenTelemetry was avaliable, we should have no Dynatrace data
              Object.keys(mockExtTrace.getTraceData()).length.should.equal(0);
            }
            noPreferenceDB.end(done);
          });
        });
      }
    });

    describeExtTrace('using table', function () {
      beforeEach(function (done) {
        if (isRemoteDB) {
          db.createTable.bind(db)('TEST_EXT_TRACE', ['ID INT UNIQUE NOT NULL'], null, done);
        } else {
          this.skip();
          done();
        }
      });
      afterEach(function (done) {
        if (isRemoteDB) {
          db.dropTable.bind(db)('TEST_EXT_TRACE', done);
        } else {
          done();
        }
      });

      it('should trace a client insert', function (done) {
        var destInfo = getDestInfoForExtTrace();
        var sql = 'INSERT INTO TEST_EXT_TRACE VALUES(1)';
        client.exec(sql, function (err, rowsAffected) {
          if (err) done(err);
          rowsAffected.should.equal(1);
          verifyOpenTelSpan('exec - ' + sql);
          // Trace rows affected as rows returned
          verifyExtTraceData(destInfo, sql, 1);
          client.exec('SELECT COUNT(*) FROM TEST_EXT_TRACE', {rowsAsArray: true}, function (err, rows) {
            if (err) done(err);
            rows[0][0].should.equal(1);
            done();
          });
        });
      });

      it('should trace a prepared statement delete', function (done) {
        var destInfo = getDestInfoForExtTrace();
        var sql = 'DELETE FROM TEST_EXT_TRACE';
        client.exec('INSERT INTO TEST_EXT_TRACE VALUES(1)', function (err, rowsAffected) {
          if (err) done(err);
          client.exec('INSERT INTO TEST_EXT_TRACE VALUES(2)', function (err, rowsAffected) {
            if (err) done(err);
            client.prepare(sql, function (err, stmt) {
              if (err) done(err);
              verifyOpenTelData('prepare - ' + sql, destInfo, sql);
              stmt.exec([], function (err, rowsAffected) {
                rowsAffected.should.equal(2);
                verifyOpenTelSpan('exec - ' + sql);
                verifyExtTraceData(destInfo, sql, 2);
                client.exec('SELECT COUNT(*) FROM TEST_EXT_TRACE', {rowsAsArray: true}, function (err, rows) {
                  if (err) done(err);
                  rows[0][0].should.equal(0);
                  cleanup(stmt, done);
                });
              });
            });
          });
        });
      });

      function testStatementBatchInsert(useExec, done) {
        var destInfo = getDestInfoForExtTrace();
        var sql = 'INSERT INTO TEST_EXT_TRACE VALUES(?)';
        var statement;

        function validateInsert(err, rowsAffected) {
          if (err) done(err);
          rowsAffected.should.eql([1, 1, 1, 1]);
          verifyOpenTelSpan((useExec ? 'exec' : 'execute') + ' - ' + sql);
          verifyExtTraceData(destInfo, sql, 4);
          client.exec('SELECT COUNT(*) FROM TEST_EXT_TRACE', {rowsAsArray: true}, function (err, rows) {
            if (err) done(err);
            rows[0][0].should.equal(4);
            cleanup(statement, done);
          });
        }

        client.prepare(sql, function (err, stmt) {
          if (err) done(err);
          verifyOpenTelData('prepare - ' + sql, destInfo, sql);
          statement = stmt;
          if (useExec) {
            statement.exec([[1], [2], [3], [4]], validateInsert);
          } else {
            statement.execute([[1], [2], [3], [4]], validateInsert);
          }
        });
      }

      it('should trace a statement batch exec', function (done) {
        testStatementBatchInsert(true, done);
      });

      it('should trace a statement batch execute', function (done) {
        testStatementBatchInsert(false, done);
      });

      it('should trace a statement batch exec error', function (done) {
        var destInfo = getDestInfoForExtTrace();
        var sql = 'INSERT INTO TEST_EXT_TRACE VALUES(?)';
        client.prepare(sql, function (err, stmt) {
          if (err) done(err);
          verifyOpenTelData('prepare - ' + sql, destInfo, sql);
          stmt.exec([['string going to int column'], ['2']], function (err, rowsAffected) {
            err.should.be.an.instanceOf(Error);
            (!!rowsAffected).should.not.be.ok;
            verifyOpenTelSpan('exec - ' + sql);
            verifyExtTraceData(destInfo, sql, undefined, {
              message: 'Cannot set parameter at row: 1. Wrong input for INT type'
            });
            cleanup(stmt, done);
          });
        });
      });
    });
  });

  function getDestInfoForExtTrace(tenant) {
    return { host: client.get('host'), port: client.get('port'), tenant: tenant };
  }
});

function verifyExtTraceData(destInfo, sql, expectedRowsReturned, expectedError) {
  if(isMockExtTraceEnabled()) { // Only validate the data on the mock
    var got = mockExtTrace.getTraceData()[mockExtTrace.getLastTraceNum()];
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
        if (sql !== undefined) {
          got.sql.should.eql(sql);
        } else {
          (got.sql === undefined).should.be.ok;
        }
        
        got.startTime.should.not.be.undefined;
        if (expectedRowsReturned !== undefined) {
          got.rowsReturned.should.equal(expectedRowsReturned);
        } else {
          (got.rowsReturned === undefined).should.be.ok;
        }
        got.endTime.should.not.be.undefined;
        got.endTime.should.be.aboveOrEqual(got.startTime);
    }
    mockExtTrace.clearTraceData();
  }
}

// must be called before verifyExtTraceData since that clears the trace data
function verifyExtTraceRequestTime(minAllowedMS, maxAllowedMS) {
  if(isMockExtTraceEnabled()) {
    var got = mockExtTrace.getTraceData()[mockExtTrace.getLastTraceNum()];
    got.should.not.be.undefined;
    if(got) {
        var gotElapsedTime = got.endTime - got.startTime;
        gotElapsedTime.should.be.aboveOrEqual(minAllowedMS);
        gotElapsedTime.should.be.belowOrEqual(maxAllowedMS);
    }
  }
}

// Verifies span name when open telemetry is running, does not clear trace data
function verifyOpenTelSpan(spanName) {
  // Only validate the data on the mock opentelemetry
  if(testOpenTel && isMockExtTraceEnabled()) {
    var got = mockExtTrace.getTraceData()[mockExtTrace.getLastTraceNum()];
    got.should.not.be.undefined;
    if(got) {
      got.spanName.should.eql(spanName);
    }
  }
}

// Verifies all data (including span name) when open telemetry is running, and
// does clear trace data
function verifyOpenTelData(spanName, destInfo, sql, expectedRowsReturned, expectedError) {
  // Only validate the data on the mock opentelemetry
  if(testOpenTel && isMockExtTraceEnabled()) {
    verifyOpenTelSpan(spanName);
    verifyExtTraceData(destInfo, sql, expectedRowsReturned, expectedError);
  }
}

function cleanup(stmt, cb) {
  stmt.drop(function (err) {
    // ignore error
    cb();
  })
}