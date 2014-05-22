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

var should = require('should');
var lib = require('./hdb').lib;
var TypeCode = lib.common.TypeCode;
var metadata = [{
  dataType: TypeCode.SMALLINT,
  name: 'bar',
  columnDisplayName: 'foo'
}];

var reader = {
  readSmallInt: function readSmallInt() {
    return 42;
  }
};

describe('Lib', function () {

  describe('#Parser', function () {

    it('should create a parser via constructor', function () {
      var parser = new lib.Parser(metadata);
      parser.honest.should.be.false;
      parser.metadata.should.have.length(1);
    });

    it('should create an evil parse function', function () {
      var parser = lib.Parser.create(metadata);
      parser.honest = false;
      var parseRow = parser.createParseFunction();
      parseRow.name.should.not.be.ok;
      var row = parseRow.call(reader);
      row.should.have.property('foo', 42);
    });

    it('should create a honest parse function', function () {
      var parser = lib.Parser.create(metadata);
      parser.honest = true;
      var parseRow = parser.createParseFunction();
      parseRow.name.should.equal('parseRow');
      var row = parseRow.call(reader);
      row.should.have.property('foo', 42);
    });

  });

});