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

var util = require('util');

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
].forEach(function exportNativeUtils(fn) {
  exports[fn] = util[fn];
});

exports.bignum = require('./bignum');

exports.Queue = require('./Queue');

function extend(obj) {
  Array.prototype.slice.call(arguments, 1).forEach(function extendOnce(source) {
    /* jshint forin:false */
    if (source) {
      for (var prop in source) {
        obj[prop] = source[prop];
      }
    }
  });
  return obj;
}
exports.extend = extend;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

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

function isBuffer(arg) {
  return arg instanceof Buffer;
}
exports.isBuffer = isBuffer;

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
  return str.toLowerCase().replace(/_([a-z])/g, function toUpperCase(match, str) {
    return str.toUpperCase();
  });
}
exports._2cc = _2cc;