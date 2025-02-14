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

var ResultSet = require('../lib/protocol/ResultSet');
const dynatrace = {};
try {
  // @dynatrace/oneagent-sdk must be installed by the application in order for
  // the client to use it.
  dynatrace.sdk = require('@dynatrace/oneagent-sdk');
  dynatrace.api = dynatrace.sdk.createInstance();
} catch (err) {
  // If module was not found, do not do anything
}

function isDynatraceEnabled() {
  if(dynatrace.api === undefined) {
    return false;
  }
  const envVar = process.env.HDB_NODEJS_SKIP_DYNATRACE;
  if(envVar && envVar != '0' && envVar.toLowerCase() != 'false') {
    return false;
  }
  return true;
}

function _dynatraceResultCallback(tracer, cb) {
  return function (err, ...args) {
    var results = args[0];

    // With DB calls, the first argument can potentially be output parameters
    // In that case, we consider the next parameter
    if (typeof results === 'object' && results !== null && !Array.isArray(results)) {
      results = args[1];
    }

    if (err) {
      tracer.error(err);
    } else if(results !== undefined) {
      tracer.setResultData({
        rowsReturned: (results && results.length) || results
      });
    }
    tracer.end(cb, err, ...args);
  };
}

function _dynatraceResultSetCallback(tracer, cb) {
  return function (err, ...args) {
    var resultSet = args[0];

    // With DB calls, the first argument can potentially be output parameters
    // In that case, we consider the next parameter
    if (typeof resultSet === 'object' && resultSet !== null && !(resultSet instanceof ResultSet)) {
      resultSet = args[1];
    }

    if (err) {
      tracer.error(err);
    } else if(resultSet) {
      const rowCount = resultSet.getRowCount();
      // A negative rowCount means the number of rows is unknown.
      // This happens if the client hasn't received the last fetch chunk yet (with default server configuration,
      // this happens if the result set is larger than 32 rows)
      if(rowCount >= 0) {
        tracer.setResultData({rowsReturned: rowCount});
      }
    }
    tracer.end(cb, err, ...args);
  };
}

function _ExecuteWrapperFn(stmtOrConn, conn, execFn, resultCB, sql) {
    // connection exec args = [sql, options, callback] --> options is optional
    // stmt exec args = [values, options, callback] --> options is optional
    return function (...args) {
        if(stmtOrConn === conn && args.length > 0) {
            sql = args[0];
        }
        if(typeof(sql) !== 'string') {
            sql = ''; // execute will fail, but need sql for when the error is traced
        }
        // get dbInfo from the conn in case it changes since the first time dynatraceConnection was called
        const tracer = dynatrace.api.traceSQLDatabaseRequest(conn._dbInfo, {statement: sql});
        var cb;
        if (args.length > 0 && typeof args[args.length - 1] === 'function') {
            cb = args[args.length - 1];
        }
        // async execute
        // cb can potentially be undefined but the execute will still go through, so we log but throw an error
        // when cb tries to be run
        tracer.startWithContext(execFn, stmtOrConn, ...args.slice(0, args.length - 1), resultCB(tracer, cb));
    }
}

// modify stmt for Dynatrace after a successful prepare
function _DynatraceStmt(stmt, conn, sql) {
    const originalExecFn = stmt.exec;
    stmt.exec = _ExecuteWrapperFn(stmt, conn, originalExecFn, _dynatraceResultCallback, sql);
    const originalExecuteFn = stmt.execute;
    stmt.execute = _ExecuteWrapperFn(stmt, conn, originalExecuteFn, _dynatraceResultSetCallback, sql);
}

function _prepareStmtUsingDynatrace(conn, prepareFn) {
  // args = [sql, options, callback] --> options is optional
  return function (...args) {
    const cb = args[args.length - 1];
    var sql = args[0];
    if(typeof(sql) !== 'string') {
        sql = ''; // prepare will fail, but need sql for when the error is traced
    }

    // same as before, cb can be undefined / not a function but we still log, but throw an error after
    prepareFn.call(conn, ...args.slice(0, args.length - 1), dynatrace.api.passContext(function prepare_handler(err, stmt) {
      if (err) {
        // The prepare failed, so trace the SQL and the error
        // We didn't start the tracer yet, so the trace start time will be inaccurate.
        const tracer = dynatrace.api.traceSQLDatabaseRequest(conn._dbInfo, {statement: sql});
        tracer.start(function prepare_error_handler() {
          tracer.error(err);
          tracer.end(cb, err);
        });
      } else {
        _DynatraceStmt(stmt, conn, sql);
        cb(err, stmt);
      }
    }));
  }
}

function _createDbInfo(destinationInfo) {
  const dbInfo = {
    name: `SAPHANA${destinationInfo.tenant ? `-${destinationInfo.tenant}` : ''}`,
    vendor: dynatrace.sdk.DatabaseVendor.HANADB,
    host: destinationInfo.host,
    port: Number(destinationInfo.port)
  };
  return dbInfo;
}

function dynatraceConnection(conn, destinationInfo) {
  if(dynatrace.api === undefined) {
    return conn;
  }
  const dbInfo = _createDbInfo(destinationInfo);
  if(conn._dbInfo) {
    // dynatraceConnection has already been called on conn, use new destinationInfo
    // in case it changed, but don't wrap conn again
    conn._dbInfo = dbInfo;
    return conn;
  }
  conn._dbInfo = dbInfo;
  // hana-client does not like decorating.
  // because of that, we need to override the fn and pass the original fn for execution
  const originalExecFn = conn.exec;
  conn.exec = _ExecuteWrapperFn(conn, conn, originalExecFn, _dynatraceResultCallback);
  const originalExecuteFn = conn.execute;
  conn.execute = _ExecuteWrapperFn(conn, conn, originalExecuteFn, _dynatraceResultSetCallback);
  const originalPrepareFn = conn.prepare;
  conn.prepare = _prepareStmtUsingDynatrace(conn, originalPrepareFn);

  return conn;
}

module.exports = { dynatraceConnection, isDynatraceEnabled };
