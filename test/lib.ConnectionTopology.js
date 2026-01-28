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
const {
  TopologyUpdateRecord,
  IgnoreTopologyEnum,
  Location,
  INVALID_VOLUME_ID,
  SystemInfo,
} = require("../lib/protocol/ConnectionTopology");
const {TopologyTestUtils} = require("./TestUtil");

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
        let testTopologyUpdateRecord = TopologyTestUtils.createDummyTopologyUpdateRecord();
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
        let testTopologyUpdateRecord = TopologyTestUtils.createDummyTopologyUpdateRecord();
        testTopologyUpdateRecord.host = "";
        let validationRet = testTopologyUpdateRecord.validateAndUpdate(30015);
        assert.strictEqual(validationRet.isValid, false);
        assert.strictEqual(
          validationRet.failureReason,
          IgnoreTopologyEnum.IgnoreTopology_InvalidTopology,
        );
      });

      it("should mark record invalid if host is an invalid address", () => {
        let testTopologyUpdateRecord = TopologyTestUtils.createDummyTopologyUpdateRecord();
        testTopologyUpdateRecord.host = "host[]name";
        let validationRet = testTopologyUpdateRecord.validateAndUpdate(30015);
        assert.strictEqual(validationRet.isValid, false);
        assert.strictEqual(
          validationRet.failureReason,
          IgnoreTopologyEnum.IgnoreTopology_InvalidTopology,
        );
      });

      it("should mark record invalid if original port is invalid", () => {
        let testTopologyUpdateRecord = TopologyTestUtils.createDummyTopologyUpdateRecord();
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
        let testTopologyUpdateRecord = TopologyTestUtils.createDummyTopologyUpdateRecord();
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
        let testTopologyUpdateRecord = TopologyTestUtils.createDummyTopologyUpdateRecord();
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
        let testTopologyUpdateRecord = TopologyTestUtils.createDummyTopologyUpdateRecord();
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

    // TODO: Replace magic numbers for `_serviceType` in the following tests by serviceType enum
    // once serviceType enum is defined in a common place.
    describe("Location", function () {
      it("should create a Location object if record provides nothing useful", () => {
        // Note: this case should not happen in real as records should be validated first
        const record = TopologyTestUtils.createDummyTopologyUpdateRecord();
        const testLocation = new Location(record);

        assert.strictEqual(testLocation._host, undefined);
        assert.strictEqual(testLocation._port, undefined);
        assert.strictEqual(testLocation._volumeId, INVALID_VOLUME_ID);
        assert.strictEqual(testLocation._preferredHost, undefined);
        assert.strictEqual(testLocation._serviceType, undefined);
        assert.strictEqual(testLocation._isCoordinator, undefined);
      });

      it("should create a Location object with proper field values based on record", () => {
        const record = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record.host = "myhostname";
        record.port = 30015;
        record.volumeId = 2;
        record.serviceType = 3;
        record.isCoordinator = true;

        const testLocation = new Location(record);
        assert.strictEqual(testLocation._host, "myhostname");
        assert.strictEqual(testLocation._port, 30015);
        assert.strictEqual(testLocation._volumeId, 2);
        assert.strictEqual(testLocation._preferredHost, undefined);
        assert.strictEqual(testLocation._serviceType, 3);
        assert.strictEqual(testLocation._isCoordinator, true);
      });

      it("should ignore extra information provided by the record", () => {
        const record = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record.host = "myHoStnAmE";
        record.port = 30015;
        record.volumeId = 2;
        record.serviceType = 3;
        record.isCoordinator = true;
        record.isStandby = false;
        record.isOwn = true;
        record.loadFactor = 1;

        const testLocation = new Location(record);
        assert.strictEqual(testLocation._host, "myhostname");
        assert.strictEqual(testLocation._port, 30015);
        assert.strictEqual(testLocation._volumeId, 2);
        assert.strictEqual(testLocation._preferredHost, undefined);
        assert.strictEqual(testLocation._serviceType, 3);
        assert.strictEqual(testLocation._isCoordinator, true);
        assert.strictEqual(Object.keys(testLocation).includes("_loadFactor"), false);
      });

      it("should return false when update has no changes", () => {
        const record = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record.host = "myhostname";
        record.port = 30015;
        record.volumeId = 2;
        record.serviceType = 3;
        record.isCoordinator = true;
        const testLocation = new Location(record);

        const updated = testLocation.update(record);
        assert.strictEqual(updated, false);
        assert.strictEqual(testLocation._host, "myhostname");
        assert.strictEqual(testLocation._port, 30015);
        assert.strictEqual(testLocation._volumeId, 2);
        assert.strictEqual(testLocation._serviceType, 3);
        assert.strictEqual(testLocation._isCoordinator, true);
      });

      it("should update nothing when only character cases in host are different", () => {
        let record = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record.host = "myhostname";
        record.port = 30015;
        record.volumeId = 2;
        record.serviceType = 3;
        record.isCoordinator = true;
        const testLocation = new Location(record);

        record.host = "MyHostName";
        const updated = testLocation.update(record);
        assert.strictEqual(updated, false);
        assert.strictEqual(testLocation._host, "myhostname");
        assert.strictEqual(testLocation._port, 30015);
        assert.strictEqual(testLocation._volumeId, 2);
        assert.strictEqual(testLocation._serviceType, 3);
        assert.strictEqual(testLocation._isCoordinator, true);
      });

      it("should update host and port when they change and reset preferredHost", () => {
        let record = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record.host = "myhostname";
        record.port = 30615;
        record.volumeId = 2;
        record.serviceType = 3;
        record.isCoordinator = true;
        const testLocation = new Location(record);

        // set preferredHost manually to test reset
        testLocation._preferredHost = "preferredHost";
        assert.strictEqual(testLocation._preferredHost, "preferredHost");

        record.host = "newMyHostname";
        const updated = testLocation.update(record);

        assert.strictEqual(updated, true);
        assert.strictEqual(testLocation._host, "newmyhostname");
        assert.strictEqual(testLocation._port, 30615);
        assert.strictEqual(testLocation._volumeId, 2);
        assert.strictEqual(testLocation._serviceType, 3);
        assert.strictEqual(testLocation._isCoordinator, true);
        assert.strictEqual(testLocation._preferredHost, undefined);
      });

      it("should update serviceType and isCoordinator independently", () => {
        let record = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record.host = "myhostname";
        record.port = 30615;
        record.volumeId = 2;
        record.serviceType = 3;
        record.isCoordinator = true;
        const testLocation = new Location(record);

        // serviceType
        record.serviceType = 0;
        assert.strictEqual(testLocation.update(record), true);
        assert.strictEqual(testLocation._serviceType, 0);

        // isCoordinator
        record.isCoordinator = false;
        assert.strictEqual(testLocation.update(record), true);
        assert.strictEqual(testLocation._isCoordinator, false);
      });
    });

    // TODO: Replace magic numbers for `_serviceType` in the following tests by serviceType enum
    // once serviceType enum is defined in a common place.
    describe("SystemInfo", function () {
      it("should initialize with empty locations and volumeId set", () => {
        const testSysInfo = new SystemInfo();

        assert.deepStrictEqual(testSysInfo._locations, []);
        assert.strictEqual(testSysInfo._volumeIdSet instanceof Set, true);
        assert.strictEqual(testSysInfo._volumeIdSet.size, 0);
      });

      it("updateTopology should do nothing if record is not provided", () => {
        // This should not happen in real as record is checked in its caller
        const testSysInfo = new SystemInfo();
        // null
        assert.strictEqual(testSysInfo._updateTopology(null), false);
        assert.strictEqual(testSysInfo._locations.length, 0);
        // undefined
        assert.strictEqual(testSysInfo._updateTopology(undefined), false);
        assert.strictEqual(testSysInfo._locations.length, 0);
      });

      it("updateTopology should insert when no existing location matches volumeId", () => {
        const testSysInfo = new SystemInfo();
        const record = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record.host = "myhostname";
        record.port = 30015;
        record.volumeId = 9;

        const updated = testSysInfo._updateTopology(record);
        assert.strictEqual(updated, true);
        assert.strictEqual(testSysInfo._locations.length, 1);
        assert.strictEqual(testSysInfo._locations[0]._volumeId, 9);
        assert.strictEqual(testSysInfo._locations[0]._host, "myhostname");
        assert.strictEqual(testSysInfo._locations[0]._port, 30015);
      });

      it("updateTopology should update existing location when volumeId matches", () => {
        const record1 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record1.host = "host1";
        record1.port = 30015;
        record1.volumeId = 2;
        const initialLocation = new Location(record1);

        const testSysInfo = new SystemInfo();
        testSysInfo._locations.push(initialLocation);
        assert.strictEqual(testSysInfo._locations.length, 1);
        assert.strictEqual(testSysInfo._locations[0]._host, "host1");
        assert.strictEqual(testSysInfo._locations[0]._port, 30015);

        const record2 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record2.host = "host2";
        record2.port = 30115;
        record2.volumeId = 2; // same volumeId

        const updated = testSysInfo._updateTopology(record2);
        assert.strictEqual(updated, true);
        assert.strictEqual(testSysInfo._locations.length, 1);
        assert.strictEqual(testSysInfo._locations[0]._host, "host2");
        assert.strictEqual(testSysInfo._locations[0]._port, 30115);
      });

      it("updateTopology should return false when no update needed", () => {
        const record1 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record1.host = "host1";
        record1.port = 30015;
        record1.volumeId = 2;
        const initialLocation = new Location(record1);

        const testSysInfo = new SystemInfo();
        testSysInfo._locations.push(initialLocation);
        assert.strictEqual(testSysInfo._locations.length, 1);
        assert.strictEqual(testSysInfo._locations[0]._host, "host1");
        assert.strictEqual(testSysInfo._locations[0]._port, 30015);

        // update with a exactly same record
        let updated = testSysInfo._updateTopology(record1);
        assert.strictEqual(updated, false);
        assert.strictEqual(testSysInfo._locations.length, 1);
        assert.strictEqual(testSysInfo._locations[0]._volumeId, 2);
        assert.strictEqual(testSysInfo._locations[0]._host, "host1");
        assert.strictEqual(testSysInfo._locations[0]._port, 30015);

        // Then update with another new record with different volumeId
        const record2 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record2.host = "host2";
        record2.port = 30115;
        record2.volumeId = 3; // different volumeId

        updated = testSysInfo._updateTopology(record2);
        assert.strictEqual(updated, true);
        assert.strictEqual(testSysInfo._locations.length, 2);
        assert.strictEqual(testSysInfo._locations[0]._volumeId, 2);
        assert.strictEqual(testSysInfo._locations[0]._host, "host1");
        assert.strictEqual(testSysInfo._locations[0]._port, 30015);
        assert.strictEqual(testSysInfo._locations[1]._volumeId, 3);
        assert.strictEqual(testSysInfo._locations[1]._host, "host2");
        assert.strictEqual(testSysInfo._locations[1]._port, 30115);
      });

      it("should return no update when input records are invalid types", () => {
        const testSysInfo = new SystemInfo();

        // null
        let ret = testSysInfo.addOrUpdateTopology(null);
        assert.strictEqual(ret.topologyUpdated, false);
        assert.strictEqual(ret.detectedBadTopology, false);
        assert.strictEqual(testSysInfo._locations.length, 0);

        // undefined
        ret = testSysInfo.addOrUpdateTopology(undefined);
        assert.strictEqual(ret.topologyUpdated, false);
        assert.strictEqual(ret.detectedBadTopology, false);
        assert.strictEqual(testSysInfo._locations.length, 0);

        // non-array
        ret = testSysInfo.addOrUpdateTopology({});
        assert.strictEqual(ret.topologyUpdated, false);
        assert.strictEqual(ret.detectedBadTopology, false);
        assert.strictEqual(testSysInfo._locations.length, 0);
      });

      it("should not add or update and error detected due to missing own record if no record is provided", () => {
        const testSysInfo = new SystemInfo();
        const ret = testSysInfo.addOrUpdateTopology([]);
        assert.strictEqual(ret.topologyUpdated, false);
        assert.strictEqual(ret.detectedBadTopology, true);
        assert.strictEqual(testSysInfo._locations.length, 0);
      });

      it("should mark bad topology when no own records exists", () => {
        const testSysInfo = new SystemInfo();
        const record1 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record1.host = "hostA";
        record1.port = 30015;
        record1.volumeId = 1;
        record1.isOwn = false;

        const record2 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record2.host = "hostB";
        record2.port = 30115;
        record2.volumeId = 2;
        record2.isOwn = false;

        const ret = testSysInfo.addOrUpdateTopology([record1, record2]);
        assert.strictEqual(ret.topologyUpdated, false);
        assert.strictEqual(ret.detectedBadTopology, true);
        assert.strictEqual(testSysInfo._locations.length, 0);
      });

      it("should mark bad topology when multiple own records exist", () => {
        const testSysInfo = new SystemInfo();
        const record1 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record1.host = "hostA";
        record1.port = 30015;
        record1.volumeId = 1;
        record1.isOwn = true;

        const record2 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record2.host = "hostB";
        record2.port = 30115;
        record2.volumeId = 2;
        record2.isOwn = true;

        const ret = testSysInfo.addOrUpdateTopology([record1, record2]);
        assert.strictEqual(ret.topologyUpdated, false);
        assert.strictEqual(ret.detectedBadTopology, true);
        assert.strictEqual(testSysInfo._locations.length, 0);
      });

      it("should mark bad topology when a record has INVALID_VOLUME_ID", () => {
        const testSysInfo = new SystemInfo();
        const record = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record.host = "hostA";
        record.port = 30015;
        record.volumeId = INVALID_VOLUME_ID;

        const ret = testSysInfo.addOrUpdateTopology([record]);
        assert.strictEqual(ret.topologyUpdated, false);
        assert.strictEqual(ret.detectedBadTopology, true);
        assert.strictEqual(testSysInfo._locations.length, 0);
      });

      it("should mark bad topology when duplicate volumeIds detected in input", () => {
        const testSysInfo = new SystemInfo();
        const record1 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record1.host = "hostA";
        record1.port = 30015;
        record1.volumeId = 7;
        record1.isOwn = true; // own record exists

        const record2 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record2.host = "hostB";
        record2.port = 30016;
        record2.volumeId = 7; // duplicate volumeId

        const ret = testSysInfo.addOrUpdateTopology([record1, record2]);
        assert.strictEqual(ret.topologyUpdated, false);
        assert.strictEqual(ret.detectedBadTopology, true);
        assert.strictEqual(testSysInfo._locations.length, 0);
      });

      it("should add new Location for valid records", () => {
        const testSysInfo = new SystemInfo();
        const record1 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record1.host = "myhostname";
        record1.port = 30015;
        record1.volumeId = 2;
        record1.serviceType = 3;
        record1.isCoordinator = true;
        record1.isOwn = true; // own record exists
        const record2 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record2.host = "myhostname2";
        record2.port = 30115;
        record2.volumeId = 1;
        record2.serviceType = 3;
        record2.isCoordinator = false;

        const ret = testSysInfo.addOrUpdateTopology([record1, record2]);
        assert.strictEqual(ret.topologyUpdated, true);
        assert.strictEqual(ret.detectedBadTopology, false);
        assert.strictEqual(testSysInfo._locations.length, 2);

        const location1 = testSysInfo._locations[0];
        assert.strictEqual(location1._host, "myhostname");
        assert.strictEqual(location1._port, 30015);
        assert.strictEqual(location1._volumeId, 2);
        assert.strictEqual(location1._serviceType, 3);
        assert.strictEqual(location1._isCoordinator, true);
        const location2 = testSysInfo._locations[1];
        assert.strictEqual(location2._host, "myhostname2");
        assert.strictEqual(location2._port, 30115);
        assert.strictEqual(location2._volumeId, 1);
        assert.strictEqual(location2._serviceType, 3);
        assert.strictEqual(location2._isCoordinator, false);
      });

      it("should update existing Location when same volumeId appears", () => {
        const testSysInfo = new SystemInfo();
        const record1 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record1.host = "hostA";
        record1.port = 30015;
        record1.volumeId = 2;
        record1.serviceType = 3;
        record1.isCoordinator = true;
        record1.isOwn = true;

        let ret = testSysInfo.addOrUpdateTopology([record1]);
        assert.strictEqual(ret.topologyUpdated, true);
        assert.strictEqual(ret.detectedBadTopology, false);
        assert.strictEqual(testSysInfo._locations.length, 1);
        assert.strictEqual(testSysInfo._locations[0]._volumeId, 2);
        assert.strictEqual(testSysInfo._locations[0]._host, "hosta");
        assert.strictEqual(testSysInfo._locations[0]._port, 30015);
        assert.strictEqual(testSysInfo._locations[0]._serviceType, 3);
        assert.strictEqual(testSysInfo._locations[0]._isCoordinator, true);

        const record2 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record2.host = "HostB"; // case-insensitive will be normalized to lowercase in Location
        record2.port = 31015;
        record2.volumeId = 2;
        record2.serviceType = 4;
        record2.isCoordinator = false;
        record2.isOwn = true;

        ret = testSysInfo.addOrUpdateTopology([record2]);
        assert.strictEqual(ret.topologyUpdated, true);
        assert.strictEqual(ret.detectedBadTopology, false);
        assert.strictEqual(testSysInfo._locations.length, 1);
        const location = testSysInfo._locations[0];
        assert.strictEqual(location._volumeId, 2);
        assert.strictEqual(location._host, "hostb");
        assert.strictEqual(location._port, 31015);
        assert.strictEqual(location._serviceType, 4);
        assert.strictEqual(location._isCoordinator, false);
      });

      it("should remove locations not present in the updated topology set", () => {
        const testSysInfo = new SystemInfo();
        const record1 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record1.host = "hostA";
        record1.port = 30015;
        record1.volumeId = 2;
        record1.serviceType = 3;
        record1.isCoordinator = true;
        record1.isOwn = true; // own record exists
        const record2 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record2.host = "HostB";
        record2.port = 31015;
        record2.volumeId = 3;
        record2.serviceType = 4;
        record2.isCoordinator = false;

        let ret = testSysInfo.addOrUpdateTopology([record1, record2]);
        assert.strictEqual(ret.topologyUpdated, true);
        assert.strictEqual(ret.detectedBadTopology, false);
        assert.strictEqual(testSysInfo._locations.length, 2);
        assert.strictEqual(testSysInfo._locations[0]._volumeId, 2);
        assert.strictEqual(testSysInfo._locations[0]._host, "hosta");
        assert.strictEqual(testSysInfo._locations[0]._port, 30015);
        assert.strictEqual(testSysInfo._locations[0]._serviceType, 3);
        assert.strictEqual(testSysInfo._locations[0]._isCoordinator, true);
        assert.strictEqual(testSysInfo._locations[1]._volumeId, 3);
        assert.strictEqual(testSysInfo._locations[1]._host, "hostb");
        assert.strictEqual(testSysInfo._locations[1]._port, 31015);
        assert.strictEqual(testSysInfo._locations[1]._serviceType, 4);
        assert.strictEqual(testSysInfo._locations[1]._isCoordinator, false);

        const record3 = TopologyTestUtils.createDummyTopologyUpdateRecord();
        record3.host = "HostD";
        record3.port = 32015;
        record3.volumeId = 4;
        record3.serviceType = 5;
        record3.isCoordinator = false;

        ret = testSysInfo.addOrUpdateTopology([record1, record3]);
        assert.strictEqual(ret.topologyUpdated, true);
        assert.strictEqual(ret.detectedBadTopology, false);
        assert.strictEqual(testSysInfo._locations.length, 2);
        assert.strictEqual(testSysInfo._locations[0]._volumeId, 2);
        assert.strictEqual(testSysInfo._locations[0]._host, "hosta");
        assert.strictEqual(testSysInfo._locations[0]._port, 30015);
        assert.strictEqual(testSysInfo._locations[0]._serviceType, 3);
        assert.strictEqual(testSysInfo._locations[0]._isCoordinator, true);
        assert.strictEqual(testSysInfo._locations[1]._volumeId, 4);
        assert.strictEqual(testSysInfo._locations[1]._host, "hostd");
        assert.strictEqual(testSysInfo._locations[1]._port, 32015);
        assert.strictEqual(testSysInfo._locations[1]._serviceType, 5);
        assert.strictEqual(testSysInfo._locations[1]._isCoordinator, false);
      });
    });
  });
});
