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

// The hdb driver will automatically use this to add OpenTelemetry
// support when @opentelemetry/api is already installed.

var ResultSet = require('../lib/protocol/ResultSet');
var OTel = {};
try {
    // @opentelemetry/api must be installed by the application in order for
    // the client to use it.
    OTel.API = require('@opentelemetry/api');
    var pjson = require('../package.json');
    OTel.Tracer = OTel.API.trace.getTracer('hdb', pjson.version);
    // Future: ideally use SEMATTRS_ values from OTel.semConv = require('@opentelemetry/semantic-conventions')
    // Currently do not to avoid the problem of what if @opentelemtry/api is installed but not
    // @opentelemetry/semantic-conventions?
} catch (err) {
    // If module was not found, do not do anything
    if(OTel.Tracer) {
        OTel.Tracer = undefined;
    }
}

function isOpenTelemetryEnabled() {
    if(OTel.Tracer === undefined) {
        return false;
    }
    const envVar = process.env.HDB_NODEJS_SKIP_OPENTELEMETRY;
    if(envVar && envVar != '0' && envVar.toLowerCase() != 'false') {
        return false;
    }
    return true;
}

function _getSpanNameAndStatus(op, sql, conn) {
    // spanName and attributes roughly follow:
    // https://github.tools.sap/CPA/telemetry-semantic-conventions/blob/main/docs/database/database-spans.md
    // Note the above SAP copy differs from the OpenTelemetry spec of:
    // https://opentelemetry.io/docs/specs/semconv/database/database-span

    // The specs says the span name could be <db.operation> <db.name>.<db.sql.table>,
    // but instead follow CAP and postgresql which roughly use "<operation> - <sql>"
    var spanName = op;
    if(sql) {
        spanName = op + " - " + sql;
        if(spanName.length > 80) {
            spanName = spanName.substring(0, 79) + '…'; // based on what CAP used
        }
    }
    // Future: consider using OTel.semConv.SEMATTRS_DB_ values instead of hardcoding attribute names
    // FYI CAP and postgresql use net.peer.name, and net.peer.port instead of server.address and server.port
    var spanOptions = {kind: OTel.API.SpanKind.CLIENT,
                        attributes: {'db.system' : 'hanadb', // FYI OT spec says sap.hana
                                     'server.address': conn._destinationInfo.host,}};
    if(conn._destinationInfo.port) {
        try {
            spanOptions.attributes['server.port'] = Number(conn._destinationInfo.port);
        } catch (err) {
            // ignore conversion error
        }
    }
    if(typeof(sql) === 'string') {
        // Follow Dynatrace which limits SQL to 1000 characters
        var sql_text = sql.length > 1000 ? sql.substring(0, 999) + '…' : sql;
        spanOptions.attributes['db.statement'] = sql_text;
    }
    if(conn._destinationInfo.tenant) {
        spanOptions.attributes['db.name'] = conn._destinationInfo.tenant;
    }
    return {spanName: spanName, spanOptions: spanOptions};
}

function _setSpanStatus(span, err) {
    if(err) {
        span.setStatus(Object.assign({code: OTel.API.SpanStatusCode.ERROR }, err.message ? { message: err.message } : undefined));
        if(err.code) {
            // https://opentelemetry.io/docs/specs/semconv/attributes-registry/db/ says this value should be a string
            span.setAttribute('db.response.status_code', err.code.toString());
        }
    } else {
        span.setStatus({code: OTel.API.SpanStatusCode.OK});
    }
}

function _openTelemetryResultCallback(span, activeCtx, cb) {
    return function (err, ...args) {
        _setSpanStatus(span, err);
        var results = args[0];
        // With DB calls, the first argument can potentially be output parameters
        // In that case, we consider the next parameter
        if (typeof results === 'object' && results !== null && !Array.isArray(results)) {
            results = args[1];
        }
        if(results !== undefined) {
            // In 0.19.12, results will typically be an array, but for non-batch insert / 
            // delete / update, results will be a number. This may be changed later to 
            // match hana-client which returns rows affected as a number even for batches.
            span.setAttribute('db.response.returned_rows', (results && results.length) || results);
        }
        span.end();
        // propagate the active context for async calls
        // (otherwise spans started within cb will not know the parent span)
        return OTel.API.context.with(activeCtx, function() {
            return cb(err, ...args);
        });
    };
}

function _openTelemetryResultSetCallback(span, activeCtx, cb) {
    return function (err, ...args) {
        var resultSet = args[0];
        // With DB calls, the first argument can potentially be output parameters
        // In that case, we consider the next parameter
        if (typeof resultSet === 'object' && resultSet !== null && !(resultSet instanceof ResultSet)
            && !Array.isArray(resultSet)) {
            resultSet = args[1];
        }
        _setSpanStatus(span, err);
        if(resultSet instanceof ResultSet) {
            const rowCount = resultSet.getRowCount();
            // A negative rowCount means the number of rows is unknown.
            // This happens if the client hasn't received the last fetch chunk yet (with default server configuration,
            // this happens if the result set is larger than 32 rows)
            if(rowCount >= 0) {
                span.setAttribute('db.response.returned_rows', rowCount);
            }
            // modify resultSet for OpenTelemetry after a successful execute
            // async methods that do not trace to OpenTelemetry
            _setPropagateContextWrapper(resultSet, resultSet.close, "close");
            _setPropagateContextWrapper(resultSet, resultSet.fetch, "fetch");
        } else if (resultSet !== undefined) {
            // Same as above, sometimes resultSet can be a number for non-batch insert / delete / update
            span.setAttribute('db.response.returned_rows', (resultSet && resultSet.length) || resultSet);
        }
        span.end();
        // propagate the active context for async calls
        // (otherwise spans started within cb will not know the parent span)
        return OTel.API.context.with(activeCtx, function() {
            return cb(err, ...args);
        });
    };
}

// Wrapper for thisArg.origFn that we do NOT want to create a span for (eg stmt.drop)
// but we still want to propagate the active context on an async call.
// The method's callback first parameter must the error object.
function _propagateContextWrapperFn(thisArg, origFn) {
    // args can end with a callback
    return function (...args) {
        var cb;
        if (args.length > 0 && typeof args[args.length - 1] === 'function') {
            cb = args[args.length - 1];
        }
        // Sometimes cb can be undefined for disconnect and drop
        if(cb) {
            const activeCtx = OTel.API.context.active();
            origFn.call(thisArg, ...args.slice(0, args.length - 1), function (...cbArgs) {
                // propagate the active context for async calls
                // (otherwise spans started within cb will not know the parent span)
                OTel.API.context.with(activeCtx, function() {
                    cb(...cbArgs);
                });
            });
        } else {
            // No callback so no need to pass context
            return origFn.call(thisArg, ...args);
        }
    }
}

// thisArg is the class, origFn is the method, fnName is a string (name of method)
function _setPropagateContextWrapper(thisArg, origFn, fnName) {
    Object.defineProperty(thisArg, fnName, {value: _propagateContextWrapperFn(thisArg, origFn)});
}

// Wrapper for thisArg.origFn that is not a prepare or execute method (eg conn.commit)
// to create a span for the operation.
// The method's callback first parameter must the error object.
function _generalWrapperFn(thisArg, origFn, op, conn) {
    // args should end with a callback
    return function (...args) {
        var cb;
        var activeCtx = OTel.API.context.active();
        if (args.length > 0 && typeof args[args.length - 1] === 'function') {
            cb = args[args.length - 1];
        }
        const {spanName, spanOptions} = _getSpanNameAndStatus(op, undefined, conn);
        return OTel.Tracer.startActiveSpan(spanName, spanOptions, function(span) {
            // async method call
            // cb can potentially be undefined but the function will still go through, so we log but throw an error
            // when cb tries to be run
            return origFn.call(thisArg, ...args.slice(0, args.length - 1), function (...cbArgs) {
                // if cbArgs is empty, cbArgs[0] is undefined, so this is safe
                _setSpanStatus(span, cbArgs[0]);
                span.end();
                // propagate the active context for async calls
                // (otherwise spans started within cb will not know the parent span)
                OTel.API.context.with(activeCtx, function() {
                    cb(...cbArgs);
                });
            });
        });
    }
}

// wrapper for exec and execute
function _executeWrapperFn(thisArg, conn, execFn, op, resultCB, sql) {
    // connection exec args = [sql, options, callback] --> options is optional
    // stmt exec args = [options, callback] --> options is optional
    return function (...args) {
        if(thisArg === conn && args.length > 0) {
            sql = args[0];
        }
        if(typeof(sql) !== 'string') {
            sql = ''; // execute will fail, but need sql for when the error is traced
        }
        var cb;
        var activeCtx = OTel.API.context.active();
        if (args.length > 0 && typeof args[args.length - 1] === 'function') {
            cb = args[args.length - 1];
        }
        const {spanName, spanOptions} = _getSpanNameAndStatus(op, sql, conn);
        return OTel.Tracer.startActiveSpan(spanName, spanOptions, function(span) {
            // async execute
            // cb can potentially be undefined but the execute will still go through, so we log but throw an error
            // when cb tries to be run
            return execFn.call(thisArg, ...args.slice(0, args.length - 1), resultCB(span, activeCtx, cb));
        });
    }
}

// modify stmt for OpenTelemetry after a successful prepare
function _modifyStmt(stmt, conn, sql) {
    const originalExecFn = stmt.exec;
    stmt.exec = _executeWrapperFn(stmt, conn, originalExecFn, "exec", _openTelemetryResultCallback, sql);

    const originalExecuteFn = stmt.execute;
    stmt.execute = _executeWrapperFn(stmt, conn, originalExecuteFn, "execute", _openTelemetryResultSetCallback, sql);

    // async methods that do not trace to OpenTelemetry
    _setPropagateContextWrapper(stmt, stmt.drop, "drop");
}

function _prepareWrapperFn(conn, prepareFn) {
    // args = [sql, options, callback] --> options is optional
    return function (...args) {
        var cb;
        var activeCtx = OTel.API.context.active();
        if(args.length > 0 && typeof args[args.length - 1] === 'function') {
            cb = args[args.length - 1];
        }
        var sql = args[0];
        if(typeof(sql) !== 'string') {
            sql = ''; // prepare will fail, but need sql for when the error is traced
        }
        const {spanName, spanOptions} = _getSpanNameAndStatus("prepare", sql, conn);
        return OTel.Tracer.startActiveSpan(spanName, spanOptions, function(span) {
            // async prepare
            // same as before, cb can be undefined but we still log, but throw an error after
            prepareFn.call(conn, ...args.slice(0, args.length - 1), function prepare_handler(err, stmt) {
                _setSpanStatus(span, err);
                span.end();
                // propagate the active context for async calls
                // (otherwise spans started within cb will not know the parent span)
                OTel.API.context.with(activeCtx, function() {
                    if (err) {
                        cb(err);
                    } else {
                        _modifyStmt(stmt, conn, sql);
                        cb(err, stmt);
                    }
                });
            });
        });
    }
}

// destinationInfo is an object with host, port and optionally tenant keys
function openTelemetryConnection(conn, destinationInfo) {
    if(OTel.Tracer === undefined) {
        return conn;
    }
    if(conn._destinationInfo) {
        // openTelemetryConnection has already been called on conn, use new destinationInfo
        // in case it changed, but don't wrap conn again
        conn._destinationInfo = destinationInfo;
        return conn;
    }
    conn._destinationInfo = destinationInfo;

    const originalExecFn = conn.exec;
    conn.exec = _executeWrapperFn(conn, conn, originalExecFn, "exec", _openTelemetryResultCallback);
    const originalExecuteFn = conn.execute;
    conn.execute = _executeWrapperFn(conn, conn, originalExecuteFn, "execute", _openTelemetryResultSetCallback);
    const originalPrepareFn = conn.prepare;
    Object.defineProperty(conn, 'prepare', {value: _prepareWrapperFn(conn, originalPrepareFn)});

    const originalCommitFn = conn.commit;
    Object.defineProperty(conn, 'commit', {value: _generalWrapperFn(conn, originalCommitFn, "commit", conn)});
    const originalRollbackFn = conn.rollback;
    Object.defineProperty(conn, 'rollback', {value: _generalWrapperFn(conn, originalRollbackFn, "rollback", conn)});

    // async methods that do not trace to OpenTelemetry
    _setPropagateContextWrapper(conn, conn.disconnect, "disconnect");

    return conn;
}

module.exports = { openTelemetryConnection, isOpenTelemetryEnabled };
