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

// This module is a mock of the @opentelemetry/api module for
// HANA client testing purposes

// To "install" this mock, copy this index.js and the package.json in the
// same directory to the node_modules/@opentelemetry/api directory.
// OR run `npm install /path/to/MockOpenTelemetryAPI`

// traceData is an object with keys that are numbers (traceNum) and
// values that are objects with keys:
//   {spanName, dbInfo, sql, startTime, endTime, error, rowsReturned}
// (traceData values are defined this way so the contents are the same as for MockDynatraceSDK)
var traceData = {};
var traceEnabled = false;
var lastTraceNum = 0;


// matching drop-in replacement for a subset of the @opentelemetry/api interface
const StatusCodeEnum = {OK: 1, ERROR: 2};
const ActiveContext = "Active Context";

class Span {
    constructor(name, options, traceNum) {
        this.traceNum = traceNum;
        if(traceNum) {
            var dbInfo = {host: options.attributes['server.address'],
                          port: options.attributes['server.port'],
                          name: 'SAPHANA',
                          vendor: 'HANADB'};
            if(options.attributes['db.name']) {
                dbInfo.name = 'SAPHANA-' + options.attributes['db.name'];
            }
            // TODO consider validating the other attributes
            // console.log("spanName: " + name + ", options: " + JSON.stringify(options)); // for debugging
            traceData[traceNum] = {spanName: name, dbInfo: dbInfo, sql: options.attributes['db.statement'], startTime: new Date()};
        }
    }

    setStatus(status) {
        if(this.traceNum && status.code == StatusCodeEnum.ERROR) {
            var err = {statusCode: status.code};
            if(status.message) {
                err.message = status.message;
            }
            traceData[this.traceNum].error = err;
        }
    }

    // trace returned_rows and status_code
    setAttribute(name, value) {
        if(this.traceNum) {
            if(name === 'db.response.returned_rows') {
                traceData[this.traceNum].rowsReturned = value;
            } else if(name === 'db.response.status_code' && traceData[this.traceNum].error) {
                traceData[this.traceNum].error.code = Number(value);
            } else {
                console.log("Error: Span.setAttribute called with unexpected name: " + name);
            }
        }
    }

    end() {
        if(this.traceNum) {
            if(traceData[this.traceNum].endTime) {
                console.log("Error: Span.end called more than once");
            }
            traceData[this.traceNum].endTime = new Date();
        }
    }

    // data members: traceNum (undefined if not tracing)
}

class Tracer {
    constructor(name, version) {
        // console.log('in Tracer constructor name: ' + name + ', version:' + version);
    }

    startSpan(name, options) {
        var traceNum; // undefined if trace is not enabled
        if(traceEnabled) {
            traceNum = ++lastTraceNum;
        }
        return new Span(name, options, traceNum);
    }

    startActiveSpan(name, options, fn) {
        var traceNum; // undefined if trace is not enabled
        if(traceEnabled) {
            traceNum = ++lastTraceNum;
        }
        return fn(new Span(name, options, traceNum));
    }
}

// @opentelemetry/api interface replacement
exports.trace = {
    getTracer: function getTracer(name, version) {
        return new Tracer(name, version);
    }
}
exports.context = {
    active: function () {
        return ActiveContext;
    },

    with: function (context, fn) {
        if(context !== ActiveContext) {
            console.log("Error: context.with called with unexpected context");
        }
        return fn();
    }
}
exports.SpanKind = {CLIENT: 2};
exports.SpanStatusCode = StatusCodeEnum;

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
