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

function mustConvertToGregorian(year, month, day) {
  const IGREG = (15 + 31 * (10 + 12 * 1582));
  return day + 31 * (month + 12 * year) >= IGREG;
}

exports.DAYDATE = function DAYDATE(year, month, day) {
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
  }

  var julienMonth = month;
  var julienYear = year;

  if (julienMonth > 2) {
    julienMonth += 1;
  } else {
    julienYear -= 1;
    julienMonth += 13;
  }

  var julienDayNumber = ~~ (365.25 * julienYear) + ~~ (30.6001 * julienMonth) + day + 1720995;

  if (mustConvertToGregorian(year, month, day)) {
    var a = ~~ (julienYear / 100);
    var b = ~~ (a / 4);
    julienDayNumber += 2 - a + b;
  }

  return julienDayNumber - TURN_OF_ERAS + 1;
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
  return {y: year, m: month, d: day};
};

exports.isZeroDay = function isZeroDay(day, month, year) {
  return (year === 0 && month === 0 && day === 0);
}

exports.isZeroTime = function isZeroTime(seconds, minutes, hours) {
  return (hours === 0 && minutes === 0 && seconds === 0);
}

exports.isValidDay = function isValidDay(day, month, year) {
  if(  (year < 1) || (year > 9999) || (month < 1) || (month > 12)
    || (day < 1)  || (day > 31)) {
    return false;
  }
  const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if(day <= daysInMonth[month]) {
    return true;
  } else if( ((~~(year % 4) == 0) && ~~(year % 100))
          || (~~(year % 400) == 0)) {
    if(month == 2 && day == 29) {
      return true;
    }
  }
  return false;
}

exports.isValidTime = function isValidTime(seconds, minutes, hours) {
  return ((hours >= 0) && (hours < 24) && (minutes >= 0) && (minutes < 60)
       && (seconds >= 0) && (seconds < 60));
}
