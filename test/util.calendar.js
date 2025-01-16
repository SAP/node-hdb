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

var lib = require('../lib');
var calendar = lib.util.calendar;

describe('Util', function () {

  describe('#DATE', function () {

    it('should convert daydate to date', function () {
      calendar.DATE(735284).should.deepEqual({y: 2014, m: 2, d: 18});
      calendar.DATE(577738).should.deepEqual({y: 1582, m: 10, d: 15});
      calendar.DATE(577737).should.deepEqual({y: 1582, m: 10, d: 4});
      calendar.DATE(1).should.deepEqual({y: 1, m: 1, d: 1});
    });

  });

  describe('#DAYDATE', function () {

    it('should convert date string to daydate', function () {
      calendar.DAYDATE('2014-02-18').should.equal(735284);
      calendar.DAYDATE('1582-10-15').should.equal(577738);
      calendar.DAYDATE('1582-10-04').should.equal(577737);
      calendar.DAYDATE('0001-01-01').should.equal(1);
    });

    it('should convert date object to daydate', function () {
      calendar.DAYDATE(new Date('1582-10-14')).should.equal(577747);
    });

    it('should convert year, month and day values to daydate', function () {
      calendar.DAYDATE(1582, 10, 5).should.equal(577738);
    });

  });

  describe('#DATETIMEVALIDITY', function () {

    it('should identify invalid days', function() {
      calendar.isValidDay(20, 11, 1995).should.equal(true);
      calendar.isValidDay(31, 11, 1995).should.equal(false);
      calendar.isValidDay(20, 13, 1995).should.equal(false);
      calendar.isValidDay(20, 11, 10000).should.equal(false);
    });

    it('should identify invalid times', function() {
      calendar.isValidTime(59, 59, 23).should.equal(true);
      calendar.isValidTime(60, 59, 23).should.equal(false);
      calendar.isValidTime(59, 60, 23).should.equal(false);
      calendar.isValidTime(59, 59, 24).should.equal(false);
    });

    it('should identify leap years', function() {
      calendar.isValidDay(29, 2, 2023).should.equal(false);
      calendar.isValidDay(29, 2, 2024).should.equal(true);
      calendar.isValidDay(29, 2, 2100).should.equal(false);
      calendar.isValidDay(29, 2, 2000).should.equal(true);
    });
  });

});
