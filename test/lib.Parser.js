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
/*jshint expr:true*/

var lib = require('../lib');
var TypeCode = lib.common.TypeCode;
var metadata = [{
  dataType: TypeCode.DECIMAL,
  tableName: 'a',
  fraction: 1,
  columnDisplayName: 'foo'
}, {
  dataType: TypeCode.SMALLINT,
  tableName: 'a',
  columnDisplayName: 'bar'
}, {
  dataType: TypeCode.DECIMAL,
  tableName: 'b',
  fraction: 2,
  columnDisplayName: 'foo'
}];

var reader = {
  readSmallInt: function readSmallInt() {
    return 42;
  },
  readDecimal: function readDecimal(fraction) {
    return fraction;
  }
};

describe('Lib', function () {

  describe('#Parser', function () {

    it('should create a parser via constructor', function () {
      var parser = new lib.Parser(metadata);
      parser.honest.should.be.false;
      parser.metadata.should.have.length(3);
    });

    it('should create an evil parse function', function () {
      var parser = lib.Parser.create(metadata);
      parser.honest = false;
      var parseRow = parser.createParseRowFunction();
      parseRow.name.should.not.be.ok;
      var row = parseRow.call(reader);
      row.should.eql({
        foo: 2,
        bar: 42
      });
    });

    it('should create a honest parse function', function () {
      var parser = lib.Parser.create(metadata);
      parser.honest = true;
      var parseRow = parser.createParseRowFunction();
      parseRow.name.should.equal('parse');
      var row = parseRow.call(reader);
      row.should.eql({
        foo: 2,
        bar: 42
      });
    });

    it('should parse rows with nestTables = true', function () {
      var parser = lib.Parser.create(metadata);
      var options = {
        nestTables: true
      };
      var expectedRow = {
        a: {
          foo: 1,
          bar: 42
        },
        b: {
          foo: 2
        }
      };
      var parseRow = parser.createParseRowFunction(options);
      parseRow.call(reader).should.eql(expectedRow);
      parser.honest = true;
      var parseRowHonestly = parser.createParseRowFunction(options);
      parseRowHonestly.call(reader).should.eql(expectedRow);
    });

    it('should parse rows with nestTables = "_"', function () {
      /* jshint camelcase: false */
      var parser = lib.Parser.create(metadata);
      var options = {
        nestTables: '_'
      };
      var expectedRow = {
        a_foo: 1,
        a_bar: 42,
        b_foo: 2
      };
      var parseRow = parser.createParseRowFunction(options);
      parseRow.call(reader).should.eql(expectedRow);
      parser.honest = true;
      var parseRowHonestly = parser.createParseRowFunction(options);
      parseRowHonestly.call(reader).should.eql(expectedRow);
    });

    it('should parse rows with nameProperty = false', function () {
      var parser = lib.Parser.create(metadata);
      var options = {
        nameProperty: false
      };
      var expectedRow = [1, 42, 2];
      var parseRow = parser.createParseRowFunction(options);
      parseRow.call(reader).should.eql(expectedRow);
      parser.honest = true;
      var parseRowHonestly = parser.createParseRowFunction(options);
      parseRowHonestly.call(reader).should.eql(expectedRow);
    });

  });

});