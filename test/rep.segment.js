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
/* jshint expr: true */

const lib = require('../lib');
const PartKind = lib.common.PartKind;
const SegmentKind = lib.common.SegmentKind;
const FunctionCode = lib.common.FunctionCode;
const Segment = lib.reply.Segment;
const Part = lib.reply.Part;
const {
  HOST_NAME,
  HOST_PORT_NUMBER,
  TENANT_NAME,
  LOAD_FACTOR,
  VOLUME_ID,
  IS_COORDINATOR,
  IS_CURRENT_SESSION,
  SERVICE_TYPE,
} = require("../lib/protocol/common/TopologyInformation");
const {TopologyTestUtils} = require("./TestUtil");

describe('Rep', function () {

  describe('#Segment', function () {

    const data = new Buffer(
      '180000000000000000000100000000000000000000000000', 'hex');

    it('should create a new Segment', function () {
      const segment = new Segment();
      segment.kind.should.equal(SegmentKind.INVALID);
      segment.functionCode.should.equal(FunctionCode.NIL);
      segment.parts.should.have.length(0);
    });

    it('should write a Segment to buffer', function () {
      const segment = new Segment();
      segment.toBuffer(0).should.eql(data);
    });

    it('should inspect a Segment', function () {
      const segment = new Segment();
      segment.push({
        inspect: function inspect(options) {
          options.should.eql({
            indentOffset: 4
          });
          return '';
        }
      });
      segment.inspect().should.equal([
        '{',
        '  kind: SegmentKind.INVALID,',
        '  functionCode: FunctionCode.NIL,',
        '  parts: [',
        '',
        '  ]',
        '}\n'
      ].join('\n'));
    });

    it('should get a Part', function () {
      const segment = new Segment();
      (!segment.getPart(1)).should.be.ok;
      const parts = [{
        kind: 1,
        buffer: new Buffer([1])
      }, {
        kind: 1,
        buffer: new Buffer([2])
      }];
      segment.parts = parts.slice(0, 1);
      segment.getPart(1).should.eql(parts[0]);
      segment.parts = parts.slice(0);
      segment.getPart(1).should.eql(parts);
    });

    it('should add some Parts to a Segment', function () {
      var segment = new Segment();
      segment.push({
        kind: PartKind.COMMAND,
        buffer: new Buffer('foo', 'utf8')
      });
      segment.push({
        kind: PartKind.COMMAND,
        buffer: new Buffer('bar', 'utf8')
      });
      segment.push({
        kind: PartKind.COMMAND,
        buffer: new Buffer('foobar', 'utf8')
      });
      var reply = segment.getReply();
      reply.command.should.eql(['foo', 'bar', 'foobar']);
    });

    it('should serialize a segment to a buffer', function () {
      var part = new Part(PartKind.ROWS_AFFECTED, 0, 1, new Buffer([1, 0, 0, 0]));
      var segment = new Segment();
      segment.push(part);
      var buffer = segment.toBuffer(256);
      buffer.readUInt32LE(0).should.equal(48);
      buffer.readUInt16LE(8).should.equal(1);
      buffer.readUInt32LE(10).should.equal(1);
      buffer.readUInt16LE(24).should.equal(PartKind.ROWS_AFFECTED);
      buffer.readUInt16LE(40).should.equal(1);
    });

  });

  describe("#Reply", function () {
    describe("Topology Information Update Records", function () {
      it("should not record any topology information update if no topology information provided", () => {
        const testSeg = new Segment(SegmentKind.REPLY);
        const testReply = testSeg.getReply();
        // no parameter (<=> undefined)
        testReply.addTopologyUpdateRecords();
        testReply.topologyUpdateRecords.should.have.length(0);
        // undefined
        testReply.addTopologyUpdateRecords(undefined);
        testReply.topologyUpdateRecords.should.have.length(0);
        // null
        testReply.addTopologyUpdateRecords(null);
        testReply.topologyUpdateRecords.should.have.length(0);
      });

      it("should not record any topology information update if wrong type of parameter provided", () => {
        const testSeg = new Segment(SegmentKind.REPLY);
        const testReply = testSeg.getReply();
        // string
        testReply.addTopologyUpdateRecords("topology information");
        testReply.topologyUpdateRecords.should.have.length(0);
        // number
        testReply.addTopologyUpdateRecords(5);
        testReply.topologyUpdateRecords.should.have.length(0);
        // object
        testReply.addTopologyUpdateRecords({1: "invalid input"});
        testReply.topologyUpdateRecords.should.have.length(0);
        // function
        testReply.addTopologyUpdateRecords(() => {
          return 1;
        });
        testReply.topologyUpdateRecords.should.have.length(0);
      });

      const invalidTopologyInfo1 = [];
      const invalidTopologyInfo2 = null;
      const validTopologyInfo1 = [
        {name: VOLUME_ID, type: 3, value: 2},
        {name: HOST_NAME, type: 29, value: "myHostname1"},
        {name: HOST_PORT_NUMBER, type: 3, value: 35615},
        {name: TENANT_NAME, type: 29, value: ""},
        {name: LOAD_FACTOR, type: 7, value: 1},
        {name: IS_COORDINATOR, type: 28, value: true},
        {name: IS_CURRENT_SESSION, type: 28, value: true},
        {name: SERVICE_TYPE, type: 3, value: 3},
      ];
      const expectedValues1 = {
        [HOST_NAME]: "myHostname1",
        [HOST_PORT_NUMBER]: 35615,
        [TENANT_NAME]: "",
        [LOAD_FACTOR]: 1,
        [VOLUME_ID]: 2,
        [IS_COORDINATOR]: true,
        [IS_CURRENT_SESSION]: true,
        [SERVICE_TYPE]: 3,
      };
      const validTopologyInfo2 = [
        {name: VOLUME_ID, type: 3, value: 4},
        {name: HOST_NAME, type: 29, value: "myHostname2"},
        {name: HOST_PORT_NUMBER, type: 3, value: 30015},
        {name: TENANT_NAME, type: 29, value: ""},
        {name: LOAD_FACTOR, type: 7, value: 1},
        {name: IS_COORDINATOR, type: 28, value: true},
        {name: IS_CURRENT_SESSION, type: 28, value: true},
        {name: SERVICE_TYPE, type: 3, value: 3},
      ];
      const expectedValues2 = {
        [HOST_NAME]: "myHostname2",
        [HOST_PORT_NUMBER]: 30015,
        [TENANT_NAME]: "",
        [LOAD_FACTOR]: 1,
        [VOLUME_ID]: 4,
        [IS_COORDINATOR]: true,
        [IS_CURRENT_SESSION]: true,
        [SERVICE_TYPE]: 3,
      };

      it("should not record any update if only invalid topology information list provided", () => {
        const testSeg = new Segment(SegmentKind.REPLY);
        const testReply = testSeg.getReply();
        testReply.addTopologyUpdateRecords([invalidTopologyInfo1, invalidTopologyInfo2]);
        testReply.topologyUpdateRecords.should.have.length(0);
      });

      it("should record update if multiple valid topology information provided", () => {
        const testSeg = new Segment(SegmentKind.REPLY);
        const testReply = testSeg.getReply();
        testReply.addTopologyUpdateRecords([validTopologyInfo1, validTopologyInfo2]);
        testReply.topologyUpdateRecords.should.have.length(2);
        TopologyTestUtils.checkTopologyUpdateRecord(
          testReply.topologyUpdateRecords[0],
          expectedValues1,
        );
        TopologyTestUtils.checkTopologyUpdateRecord(
          testReply.topologyUpdateRecords[1],
          expectedValues2,
        );
      });

      it("should record valid update if valid and invalid topology information provided", () => {
        const testSeg = new Segment(SegmentKind.REPLY);
        const testReply = testSeg.getReply();
        testReply.addTopologyUpdateRecords([
          invalidTopologyInfo1,
          validTopologyInfo1,
          invalidTopologyInfo2,
          validTopologyInfo2,
        ]);
        testReply.topologyUpdateRecords.should.have.length(2);
        TopologyTestUtils.checkTopologyUpdateRecord(
          testReply.topologyUpdateRecords[0],
          expectedValues1,
        );
        TopologyTestUtils.checkTopologyUpdateRecord(
          testReply.topologyUpdateRecords[1],
          expectedValues2,
        );
      });

      it("should record valid update if topology information provided by parts", () => {
        const testSeg = new Segment(SegmentKind.REPLY);
        const testReply = testSeg.getReply();
        const testPart = TopologyTestUtils.generateTopologyInformationPart([
          invalidTopologyInfo1,
          validTopologyInfo1,
          validTopologyInfo2,
        ]);
        testReply.add(testPart);
        testReply.topologyUpdateRecords.should.have.length(2);
        TopologyTestUtils.checkTopologyUpdateRecord(
          testReply.topologyUpdateRecords[0],
          expectedValues1,
        );
        TopologyTestUtils.checkTopologyUpdateRecord(
          testReply.topologyUpdateRecords[1],
          expectedValues2,
        );
      });
    });
  });

});
