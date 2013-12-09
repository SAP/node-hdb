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

var lib = require('./lib');
var PartKind = lib.common.PartKind;
var Parameters = lib.data[PartKind.PARAMETERS];

var data = require('./fixtures/parametersData');

describe('Data', function () {

  describe('#Parameters', function () {

    it('should write default parameters', function () {
      var params = Parameters.write({}, data.DEFAULT.values);
      params.should.eql(data.DEFAULT.part);
    });

    it('should write all types', function () {
      var params = Parameters.write({}, data.ALL_TYPES.values);
      params.should.eql(data.ALL_TYPES.part);
    });

  });

});