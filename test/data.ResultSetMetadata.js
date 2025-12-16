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
var normalize = require('./normalize');
var PartKind = lib.common.PartKind;
var ParameterMode = lib.common.ParameterMode;
var READONLY = ParameterMode.READONLY;
var AUTO_INCREMENT = ParameterMode.AUTO_INCREMENT;
var MANDATORY = ParameterMode.MANDATORY;
var OPTIONAL = ParameterMode.OPTIONAL;
var ResultSetMetadata = lib.data[PartKind.RESULT_SET_METADATA];

var data = require('./fixtures/resultSetMetadata').VERSION_AND_CURRENT_USER;

describe('Data', function () {

  describe('#ResultSetMetadata', function () {

    it('should read resultSet metadata', function () {
      /* jshint bitwise: false */
      var resultSetMetadata = ResultSetMetadata.read(data.part);
      var columns = normalize(resultSetMetadata);
      columns.should.eql(data.columns);
      var argumentCount = ResultSetMetadata.getArgumentCount(columns);
      argumentCount.should.equal(data.columns.length);

      resultSetMetadata.forEach(function (column, index) {
        var mode = data.columns[index].mode;
        column.isReadOnly().should.equal(!!(mode & READONLY));
        column.isAutoIncrement().should.equal(!!(mode & AUTO_INCREMENT));
        column.isMandatory().should.equal(!!(mode & MANDATORY));
        column.isOptional().should.equal(!!(mode & OPTIONAL));
      });
    });

  });

});