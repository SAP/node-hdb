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
/* jshint bitwise:false */

var zeropad = require('./zeropad');
var lpad4 = zeropad.lpad4;
var lpad2 = zeropad.lpad2;

var TURN_OF_ERAS = 1721424;
var GREGORIAN = 2299161;

exports.DAYDATE = function DAYDATE(year, month, day) {
  var A, B, C, E, F, Z;

  if (!month) {
    var date = year;
    if (typeof date === 'string') {
      month = +date.substring(5, 7);
      day = +date.substring(8, 10);
      year = +date.substring(0, 4);
    } else if (typeof date === 'object') {
      month = date.getUTCMonth() + 1;
      day = year.getUTCDate();
      year = year.getUTCFullYear();
    }
  } else {
    month += 1;
  }

  if (month < 3) {
    year -= 1;
    month += 12;
  }

  if ((year > 1582) ||
    (year === 1582 && month > 10) ||
    (year === 1582 && month === 10 && day >= 15)) {
    A = ~~ (year / 100);
    B = ~~ (A / 4);
    C = 2 - A + B;
  } else {
    C = 0;
  }
  E = ~~ (365.25 * (year + 4716));
  F = ~~ (30.6001 * (month + 1));
  Z = C + day + E + F - 1524;
  return Z + 1 - TURN_OF_ERAS;
};

exports.DATE = function DATE(daydate) {
  var Z, W, X, A, B, C, D, E, F, year, month, day;

  Z = ~~ (daydate - 1 + TURN_OF_ERAS);
  if (Z >= GREGORIAN) {
    W = ~~ ((Z - 1867216.25) / 36524.25);
    X = ~~ (W / 4);
    A = Z + 1 + W - X;
  } else {
    A = Z;
  }
  B = A + 1524;
  C = ~~ ((B - 122.1) / 365.25);
  D = ~~ (365.25 * C);
  E = ~~ ((B - D) / 30.6001);
  F = ~~ (30.6001 * E);
  day = B - D - F;
  month = E - 1;
  if (month > 12) {
    month -= 12;
  }
  if (month < 3) {
    year = C - 4715;
  } else {
    year = C - 4716;
  }
  return lpad4(year) + '-' + lpad2(month) + '-' + lpad2(day);
};