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

/* jshint camelcase:false */

var util = require('util');
var stream = require('stream');
var path = require('path');
var os = require('os');
var fs = require('fs');

Object.defineProperties(exports, {
  setImmediate: {
    get: function setImmediate() {
      if (typeof global.setImmediate === 'function') {
        return global.setImmediate;
      }
      return process.nextTick;
    }
  },
  cid: {
    get: function getClientId() {
      return [exports.pid || 'nodejs', os.hostname()].join('@');
    }
  }
});

exports.pid = process.pid;
exports._debuglog = util.debuglog;
exports.os_user = os.userInfo().username;

exports.debuglog = function debuglog() {
  if (typeof exports._debuglog === 'function') {
    return exports._debuglog.apply(null, arguments);
  }
  return function dummyDebuglog() {};
};

var debug = exports.debuglog('hdb_util');

exports.tracefile = function tracefile() {
  var timestamp = Math.floor(Date.now() / 1000);
  var filename = 'hdb.trace.' + timestamp + '.log';
  return path.join(os.tmpdir(), filename);
};

exports._appendFileSync = fs.appendFileSync;
exports.tracelog = function tracelog() {
  if (!process.env.HDB_TRACE) {
    return function dummyTracelog() {};
  }

  var filename = exports.tracefile();
  debug('Trace to file', filename);
  return function tracelog(kind, segment) {
    exports._appendFileSync(filename,
      kind + '\n' +
      util.inspect(segment, {
        depth: 9
      }));
  };
};

exports.stream = {
  Readable: stream.Readable,
  Writable: stream.Writable,
  Duplex: stream.Duplex,
  Transform: stream.Transform
};

function exportNativeUtil(fn) {
  exports[fn] = util[fn];
}

[
  'format',
  'debug',
  'error',
  'puts',
  'print',
  'log',
  'inspect',
  'isArray',
  'isRegExp',
  'isDate',
  'isError',
  'inherits'
].forEach(exportNativeUtil);

exports.bignum = require('./bignum');
exports.calendar = require('./calendar');
exports.convert = require('./convert');
exports.Queue = require('./Queue');
extend(exports, require('./zeropad'));

function extend(obj) {
  function extendOnce(source) {
    /* jshint forin:false */
    if (source) {
      for (var prop in source) {
        obj[prop] = source[prop];
      }
    }
  }
  Array.prototype.slice.call(arguments, 1).forEach(extendOnce);
  return obj;
}
exports.extend = extend;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function alignLength(length, alignment) {
  if (length % alignment === 0) {
    return length;
  }
  return length + alignment - length % alignment;
}
exports.alignLength = alignLength;

function cc2_(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
}
exports.cc2_ = cc2_;

function _2cc(str) {
  return str.toLowerCase().replace(/_([a-z])/g, function toUpperCase(match,
    str) {
    return str.toUpperCase();
  });
}
exports._2cc = _2cc;

function readData(ds, cb) {
  var length = 0;
  var chunks = [];

  function done(err) {
    ds.removeListener('error', onerror);
    ds.removeListener('data', ondata);
    ds.removeListener('end', onend);
    if (isFunction(cb)) {
      if (err) {
        return cb(err);
      }
      cb(null, Buffer.concat(chunks, length));
    }
  }

  function onerror(err) {
    done(err);
  }
  ds.on('error', onerror);

  function ondata(chunk) {
    chunks.push(chunk);
    length += chunk.length;
  }
  ds.on('data', ondata);

  function onend() {
    done(null);
  }
  ds.on('end', onend);
  ds.resume();
}
exports.readData = readData;

function proxyEvents(source, target, events) {

  function proxyEvent(ev) {
    source.on(ev, target.emit.bind(target, ev));
  }
  events.forEach(proxyEvent);
  return target;
}
exports.proxyEvents = proxyEvents;

function createReadStream(ds, events, options) {
  if (!util.isArray(events)) {
    options = events;
    events = ['error', 'close'];
  }

  var readable = new stream.Readable(options);
  readable._read = function _read() {
    ds.resume();
  };

  function onend() {
    readable.push(null);
  }
  ds.once('end', onend);

  function ondata(chunk) {
    if (!chunk || !chunk.length || readable._readableState.ended) {
      return;
    }
    if (!readable.push(chunk)) {
      ds.pause();
    }
  }
  ds.on('data', ondata);

  proxyEvents(ds, readable, events);
  return readable;
}
exports.createReadStream = createReadStream;

function pipe(source, target, events) {
  proxyEvents(source, target, events || ['error']);
  return source.pipe(target);
}
exports.pipe = pipe;

function filter(keys) {
  /* jshint validthis:true */
  var obj = {};
  var key;
  for (var i = 0; i < keys.length; i++) {
    key = keys[i];
    if (Object.prototype.hasOwnProperty.call(this, key)) {
      obj[key] = this[key];
    }
  }
  return obj;
}
exports.filter = filter;
