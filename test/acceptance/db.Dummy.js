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
/* jshint undef:false, expr:true */

var db = require('../db')();

describe('db', function () {
  before(db.init.bind(db));
  after(db.end.bind(db));
  describe('DUMMY  ', function () {

    describe('direct execute of Query', function () {

      it('should return a single row', function (done) {
        var sql = 'select * from DUMMY';
        db.client.exec(sql, function (err, rows) {
          (!!err).should.be.not.ok;
          rows.should.eql([{
            DUMMY: 'X'
          }]);
          done();
        });
      });

      it('should return a single row as array', function (done) {
        var sql = 'select * from DUMMY';
        db.client.exec({
          sql: sql,
          rowsAsArray: true
        }, function (err, rows) {
          (!!err).should.be.not.ok;
          rows.should.eql([
            ['X']
          ]);
          done();
        });
      });

      it('should return a single row with name nest tables', function (done) {
        var sql = 'select * from DUMMY';
        db.client.exec(sql, {
          nestTables: true
        }, function (err, rows) {
          (!!err).should.be.not.ok;
          rows.should.eql([{
            DUMMY: {
              DUMMY: 'X'
            }
          }]);
          done();
        });
      });

    });

    describe('prepared execute of a Query', function () {

      it('should return a single row with name nest tables', function (done) {
        var sql = 'select * from dummy where dummy = ?';
        db.client.prepare({
          sql: sql,
          nestTables: true
        }, function (err, statement) {
          (!!err).should.be.not.ok;
          statement.exec({
            parameters: ['X']
          }, function (err, rows) {
            (!!err).should.be.not.ok;
            rows.should.eql([{
              DUMMY: {
                DUMMY: 'X'
              }
            }]);
            statement.drop(done);
          });

        });
      });

    });

  });
});