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

    it('should convert date to daydate', function () {
      calendar.DATE(735284).should.equal('2014-02-18');
      calendar.DATE(577738).should.equal('1582-10-15');
      calendar.DATE(577737).should.equal('1582-10-04');
      calendar.DATE(1).should.equal('0001-01-01');
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
      calendar.DAYDATE(1582, 9, 5).should.equal(577738);
    });

  });

});