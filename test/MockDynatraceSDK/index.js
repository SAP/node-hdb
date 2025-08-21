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

// This module is a mock of the @dynatrace/oneagent-sdk module for
// HANA client testing purposes

// To "install" this mock, copy this index.js and the package.json in the
// same directory to the node_modules/@dynatrace/oneagent-sdk directory.

// traceData is an object with keys that are numbers (traceNum) and
// values that are objects with keys:
//   {dbInfo, sql, startTime, endTime, error, rowsReturned}
var traceData = {};
var traceEnabled = false;
var lastTraceNum = 0;

// matching drop-in replacement for a subset of the @dynatrace/oneagent-sdk interface
class DBTracer {
    constructor(api, dbinfo, sql, traceNum) {
        this.traceNum = traceNum;
        if(traceNum) {
            traceData[traceNum] = {dbInfo: dbinfo, sql: sql};
        }
    }

    // trace start and call cb(...params)
    start(cb, ...params) {
        if(this.traceNum) {
            if(traceData[this.traceNum].startTime) {
                console.log("Error: DBTracer.start or startWithContext called more than once");
            }
            traceData[this.traceNum].startTime = new Date();
        }
        cb(...params);
    }

    // trace start and call obj.fn(...params)
    startWithContext(fn, obj, ...params) {
        if(this.traceNum) {
            if(traceData[this.traceNum].startTime) {
                console.log("Error: DBTracer.startWithContext or start called more than once");
            }
            traceData[this.traceNum].startTime = new Date();
        }
        fn.apply(obj, params);
    }

    // trace result set data (only interested in prop.rowsReturned)
    setResultData(prop) {
        if(this.traceNum) {
            traceData[this.traceNum].rowsReturned = prop.rowsReturned;
        }
    }

    // trace error
    error(err) {
        if(this.traceNum) {
            if(traceData[this.traceNum].error) {
                console.log("Error: DBTracer.error called more than once");
            }
            traceData[this.traceNum].error = err;
        }
    }

    // end of trace object, so trace end and call cb(...params) if cb is passed in
    end(cb, ...params) {
        if(this.traceNum) {
            if(traceData[this.traceNum].endTime) {
                console.log("Error: DBTracer.end called more than once");
            }
            traceData[this.traceNum].endTime = new Date();
        }
        if(cb) {
            cb(...params);
        }
    }

    // data members: traceNum (undefined if not tracing)
}

class API {
    constructor() {
        //console.log('in API constructor');
    }

    traceSQLDatabaseRequest(dbinfo, prop) {
        var traceNum; // undefined if trace is not enabled
        if(traceEnabled) {
            traceNum = ++lastTraceNum;
        }
        return new DBTracer(this, dbinfo, prop.statement, traceNum);
    }

    passContext(fn) {
        return fn;
    }
}

exports.createInstance = function() {
    return new API();
}

exports.DatabaseVendor = {HANADB: 'HANADB'};

// functions so tests can get and clear the mocked trace data
exports.enableTrace = function() {
    traceEnabled = true;
}
exports.disableTrace = function() {
    traceEnabled = false;
}
exports.getTraceData = function() {
    return traceData;
}
exports.getLastTraceNum = function() {
    return lastTraceNum;
}
exports.clearTraceData = function() {
    traceData = {};
}
