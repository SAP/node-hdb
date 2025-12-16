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
var MessageType = lib.common.MessageType;
var Segment = lib.request.Segment;

describe('Req', function () {

  describe('#Segment', function () {

    it('should create a new Segment', function () {
      var segment = new Segment();
      segment.type.should.equal(MessageType.NIL);
      segment.commitImmediateley.should.equal(0);
      segment.commandOptions.should.equal(0);
      segment.parts.should.have.length(0);
      segment.addPart({
        kind: 1,
        args: true
      });
      segment.parts.should.have.length(1);
      segment.push(2, true);
      segment.parts.should.have.length(2);
      segment.add(3);
      segment.parts.should.have.length(2);
      segment.add({
        kind: 3,
        module: 'module'
      }, true);
      segment.parts.should.have.length(3);
    });

    it('should create a new Segment with set useCesu8', function () {
      var segment = new Segment(MessageType.NIL, 0, 0, true);
      segment.useCesu8.should.be.true;
    });

  });

});