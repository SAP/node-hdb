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
var Parser = lib.Parser;

var metadata = require('./fixtures/resultSetMetadata').TABLES;
var data = require('./fixtures/resultSetData').TABLES;

describe('Data', function () {

  describe('#ResultSet', function () {

    var count = data.part.argumentCount;
    var first = 0;
    var last = count - 1;

    it('deserialize from part buffer', function (done) {
      var parser = new Parser(metadata.columns);
      var rows = parser.parse(data.part.buffer);
      rows.should.have.length(count);
      rows[first].should.eql(data.rows[first]);
      rows[last].should.eql(data.rows[last]);
      done();
    });

  });

});