// Copyright 2026 SAP AG.
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
"use strict";

const assert = require("assert");
const {
  HOST_NAME,
  HOST_PORT_NUMBER,
  TENANT_NAME,
  LOAD_FACTOR,
  VOLUME_ID,
  IS_COORDINATOR,
  IS_CURRENT_SESSION,
  SERVICE_TYPE,
  NETWORK_DOMAIN, // NOTE: deprecated
  IS_STANDBY,
  ALL_IP_ADDRESSES, // NOTE: deprecated
  ALL_HOST_NAMES, // NOTE: deprecated
  SITE_TYPE,
  SMVR_ROLE,
} = require("../lib/protocol/common/TopologyInformation");
const {TopologyUpdateRecord, IgnoreTopologyEnum} = require("../lib/protocol/ConnectionTopology");
const {TopologyTestUtils} = require("./TestUtil");

// Test helper functions for ConnectionTopology tests
function createDummyTopologyUpdateRecord() {
  // The type key `UNKNOWN_TOPOLOGY_INFO_NAME` is used for making sure a TopologyUpdateRecord
  // object with no field will be returned instead of null.
  // This `UNKNOWN_TOPOLOGY_INFO_NAME` type key will be ignored.
  const dummyTopologyInfo = [
    {name: TopologyTestUtils.UNKNOWN_TOPOLOGY_INFO_NAME, type: 3, value: 2},
  ];
  return TopologyUpdateRecord.create(dummyTopologyInfo);
}

describe("Lib", function () {
  describe("#ConnectionTopology", function () {
    describe("TopologyUpdateRecord", function () {
      // TopologyUpdateRecord tests
      it("should create nothing if no topology information provided", () => {
        assert.strictEqual(TopologyUpdateRecord.create(null), null);
        assert.strictEqual(TopologyUpdateRecord.create(undefined), null);
        assert.strictEqual(TopologyUpdateRecord.create([]), null);
      });

      it("should create nothing if provided topology information type is incorrect", () => {
        assert.strictEqual(TopologyUpdateRecord.create("a string"), null);
        assert.strictEqual(TopologyUpdateRecord.create({2: "hostname"}), null);
        assert.strictEqual(TopologyUpdateRecord.create(1), null);
        assert.strictEqual(
          TopologyUpdateRecord.create(() => {
            return 1;
          }),
          null,
        );
      });

      it("should not record if unknown topology information is provided", () => {
        const unknownTopologyInfo = [
          {name: TopologyTestUtils.UNKNOWN_TOPOLOGY_INFO_NAME, type: 3, value: 3},
        ];
        const topologyRecord = TopologyUpdateRecord.create(unknownTopologyInfo);
        TopologyTestUtils.checkTopologyUpdateRecord(topologyRecord, {});
      });

      it("should not record if deprecated topology information is provided", () => {
        const deprecatedTopologyInfo = [
          {name: NETWORK_DOMAIN, type: 3, value: 3},
          {name: ALL_HOST_NAMES, type: 3, value: 3},
          {name: ALL_IP_ADDRESSES, type: 3, value: 3},
        ];
        const topologyRecord = TopologyUpdateRecord.create(deprecatedTopologyInfo);
        TopologyTestUtils.checkTopologyUpdateRecord(topologyRecord, {});
      });

      it("should successfully create correct TopologyUpdateRecord", () => {
        const topologyInfo = [
          {name: VOLUME_ID, type: 3, value: 2},
          {name: HOST_NAME, type: 29, value: "myHostname"},
          {name: HOST_PORT_NUMBER, type: 3, value: 35615},
          {name: TENANT_NAME, type: 29, value: ""},
          {name: LOAD_FACTOR, type: 7, value: 1},
          {name: IS_COORDINATOR, type: 28, value: true},
          {name: IS_CURRENT_SESSION, type: 28, value: true},
          {name: SERVICE_TYPE, type: 3, value: 3},
        ];
        const expectedValues = {
          [HOST_NAME]: "myHostname",
          [HOST_PORT_NUMBER]: 35615,
          [TENANT_NAME]: "",
          [LOAD_FACTOR]: 1,
          [VOLUME_ID]: 2,
          [SITE_TYPE]: undefined,
          [SMVR_ROLE]: undefined,
          [IS_COORDINATOR]: true,
          [IS_CURRENT_SESSION]: true,
          [SERVICE_TYPE]: 3,
          [IS_STANDBY]: undefined,
        };
        const topologyUpdateRecord = TopologyUpdateRecord.create(topologyInfo);
        TopologyTestUtils.checkTopologyUpdateRecord(topologyUpdateRecord, expectedValues);
      });

      it("should mark record invalid if host is not specified", () => {
        let testTopologyUpdateRecord = createDummyTopologyUpdateRecord();
        let validationRet;
        // no .host field
        validationRet = testTopologyUpdateRecord.validateAndUpdate(30015);
        assert.strictEqual(validationRet.isValid, false);
        assert.strictEqual(
          validationRet.failureReason,
          IgnoreTopologyEnum.IgnoreTopology_InvalidTopology,
        );
        // undefined
        testTopologyUpdateRecord.host = undefined;
        validationRet = testTopologyUpdateRecord.validateAndUpdate(30015);
        assert.strictEqual(validationRet.isValid, false);
        assert.strictEqual(
          validationRet.failureReason,
          IgnoreTopologyEnum.IgnoreTopology_InvalidTopology,
        );
        // null
        testTopologyUpdateRecord.host = null;
        validationRet = testTopologyUpdateRecord.validateAndUpdate(30015);
        assert.strictEqual(validationRet.isValid, false);
        assert.strictEqual(
          validationRet.failureReason,
          IgnoreTopologyEnum.IgnoreTopology_InvalidTopology,
        );
      });

      it("should mark record invalid if host is an empty string", () => {
        let testTopologyUpdateRecord = createDummyTopologyUpdateRecord();
        testTopologyUpdateRecord.host = "";
        let validationRet = testTopologyUpdateRecord.validateAndUpdate(30015);
        assert.strictEqual(validationRet.isValid, false);
        assert.strictEqual(
          validationRet.failureReason,
          IgnoreTopologyEnum.IgnoreTopology_InvalidTopology,
        );
      });

      it("should mark record invalid if host is an invalid address", () => {
        let testTopologyUpdateRecord = createDummyTopologyUpdateRecord();
        testTopologyUpdateRecord.host = "host[]name";
        let validationRet = testTopologyUpdateRecord.validateAndUpdate(30015);
        assert.strictEqual(validationRet.isValid, false);
        assert.strictEqual(
          validationRet.failureReason,
          IgnoreTopologyEnum.IgnoreTopology_InvalidTopology,
        );
      });

      it("should mark record invalid if original port is invalid", () => {
        let testTopologyUpdateRecord = createDummyTopologyUpdateRecord();
        testTopologyUpdateRecord.host = "my-hostname";
        let validationRet;
        // <= 0
        testTopologyUpdateRecord.port = -5;
        validationRet = testTopologyUpdateRecord.validateAndUpdate(30015);
        assert.strictEqual(validationRet.isValid, false);
        assert.strictEqual(
          validationRet.failureReason,
          IgnoreTopologyEnum.IgnoreTopology_InvalidTopology,
        );
        // > 65535
        testTopologyUpdateRecord.port = 100000;
        validationRet = testTopologyUpdateRecord.validateAndUpdate(30015);
        assert.strictEqual(validationRet.isValid, false);
        assert.strictEqual(
          validationRet.failureReason,
          IgnoreTopologyEnum.IgnoreTopology_InvalidTopology,
        );
      });

      it("should update invalid port if host provide new parsed host and port", () => {
        let testTopologyUpdateRecord = createDummyTopologyUpdateRecord();
        testTopologyUpdateRecord.host = "myhostname:30015";
        testTopologyUpdateRecord.port = -5;
        let validationRet = testTopologyUpdateRecord.validateAndUpdate(30015);
        assert.strictEqual(validationRet.isValid, true);
        assert.strictEqual(
          validationRet.failureReason,
          IgnoreTopologyEnum.IgnoreTopology_NotIgnoring,
        );
        assert.strictEqual(testTopologyUpdateRecord.host, "myhostname");
        assert.strictEqual(testTopologyUpdateRecord.port, 30015);
      });

      it("should update valid port if host provide new parsed host and port", () => {
        let testTopologyUpdateRecord = createDummyTopologyUpdateRecord();
        testTopologyUpdateRecord.host = "myhostname:30015";
        testTopologyUpdateRecord.port = 40015;
        let validationRet = testTopologyUpdateRecord.validateAndUpdate(30015);
        assert.strictEqual(validationRet.isValid, true);
        assert.strictEqual(
          validationRet.failureReason,
          IgnoreTopologyEnum.IgnoreTopology_NotIgnoring,
        );
        assert.strictEqual(testTopologyUpdateRecord.host, "myhostname");
        assert.strictEqual(testTopologyUpdateRecord.port, 30015);
      });

      it("should mark record invalid if port forwarding detected", () => {
        let testTopologyUpdateRecord = createDummyTopologyUpdateRecord();
        testTopologyUpdateRecord.host = "myhostname";
        testTopologyUpdateRecord.port = 35015;
        testTopologyUpdateRecord.isOwn = true;
        let validationRet = testTopologyUpdateRecord.validateAndUpdate(30015);
        assert.strictEqual(validationRet.isValid, false);
        assert.strictEqual(
          validationRet.failureReason,
          IgnoreTopologyEnum.IgnoreTopology_PortForwarding,
        );
      });
    });
  });
});
