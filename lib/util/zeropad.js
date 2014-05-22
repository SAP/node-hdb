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
/* jshint curly: false */

var INT_10_1 = Math.pow(10, 1);
var INT_10_2 = Math.pow(10, 2);
var INT_10_3 = Math.pow(10, 3);
var INT_10_4 = Math.pow(10, 4);
var INT_10_5 = Math.pow(10, 5);
var INT_10_6 = Math.pow(10, 6);
var INT_10_7 = Math.pow(10, 7);
var INT_10_8 = Math.pow(10, 8);
var INT_10_9 = Math.pow(10, 9);
var INT_10_10 = Math.pow(10, 10);
var INT_10_11 = Math.pow(10, 11);
var INT_10_12 = Math.pow(10, 12);
var INT_10_13 = Math.pow(10, 13);

var ZERO_0 = '';
var ZERO_1 = '0';
var ZERO_2 = '00';
var ZERO_3 = '000';
var ZERO_4 = '0000';
var ZERO_5 = '00000';
var ZERO_6 = '000000';
var ZERO_7 = '0000000';
var ZERO_8 = '00000000';
var ZERO_9 = '000000000';
var ZERO_10 = '0000000000';
var ZERO_11 = '00000000000';
var ZERO_12 = '000000000000';
var ZERO_13 = '0000000000000';

/* Decimal zero padding */
var MAX_DECIMAL_LENGTH = 35;
var ZEROS = exports.ZEROS = [''];
for (var i = 1; i < MAX_DECIMAL_LENGTH; i++) {
  ZEROS.push(ZEROS[i - 1] + '0');
}

exports.lpad = function lpad(length, n) {
  var z = '' + n;
  while (z.length < length) {
    z = ZEROS[Math.min(length - z.length, MAX_DECIMAL_LENGTH - 1)] + z;
  }
  return z;
};

exports.lpad14 = function lpad14(n) {
  if (n >= INT_10_13) return ZERO_0 + n;
  if (n >= INT_10_12) return ZERO_1 + n;
  if (n >= INT_10_11) return ZERO_2 + n;
  if (n >= INT_10_10) return ZERO_3 + n;
  if (n >= INT_10_9) return ZERO_4 + n;
  if (n >= INT_10_8) return ZERO_5 + n;
  if (n >= INT_10_7) return ZERO_6 + n;
  if (n >= INT_10_6) return ZERO_7 + n;
  if (n >= INT_10_5) return ZERO_8 + n;
  if (n >= INT_10_4) return ZERO_9 + n;
  if (n >= INT_10_3) return ZERO_10 + n;
  if (n >= INT_10_2) return ZERO_11 + n;
  if (n >= INT_10_1) return ZERO_12 + n;
  return ZERO_13 + n;
};

exports.lpad7 = function lpad7(n) {
  if (n >= INT_10_6) return ZERO_0 + n;
  if (n >= INT_10_5) return ZERO_1 + n;
  if (n >= INT_10_4) return ZERO_2 + n;
  if (n >= INT_10_3) return ZERO_3 + n;
  if (n >= INT_10_2) return ZERO_4 + n;
  if (n >= INT_10_1) return ZERO_5 + n;
  return ZERO_6 + n;
};

exports.lpad4 = function lpad4(n) {
  if (n >= INT_10_3) return ZERO_0 + n;
  if (n >= INT_10_2) return ZERO_1 + n;
  if (n >= INT_10_1) return ZERO_2 + n;
  return ZERO_3 + n;
};

exports.lpad2 = function lpad2(n) {
  if (n >= INT_10_1) return ZERO_0 + n;
  return ZERO_1 + n;
};