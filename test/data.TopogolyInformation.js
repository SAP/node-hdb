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
var PartKind = lib.common.PartKind;
var MultilineOptions = lib.data[PartKind.TOPOLOGY_INFORMATION];

var data = require('./fixtures/topogolyInformation').DEFAULT;

describe('Data', function () {

  describe('#TopologyInformation', function () {

    it('should write topology information', function () {
      MultilineOptions.write({}, data.options).should.eql(data.part);
      MultilineOptions.write.call(data.options).should.eql(data.part);
    });

    it('should deserialize options from buffer', function () {
      MultilineOptions.read(data.part).should.eql(data.options);
    });

  });

});