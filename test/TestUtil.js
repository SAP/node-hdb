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
const lib = require('../lib');
const PartKind = lib.common.PartKind;
const Part = lib.reply.Part;
const data = require("../lib/protocol/data");

// -----------------------------------------------------------------------------
// Connection Topology Information Test Utils
// -----------------------------------------------------------------------------
const {TopologyUpdateRecord} = require("../lib/protocol/ConnectionTopology");
const {
  HOST_NAME,
  HOST_PORT_NUMBER,
  TENANT_NAME,
  LOAD_FACTOR,
  VOLUME_ID,
  IS_COORDINATOR,
  IS_CURRENT_SESSION,
  SERVICE_TYPE,
  IS_STANDBY,
  SITE_TYPE,
  SMVR_ROLE,
} = require("../lib/protocol/common/TopologyInformation");

const UNKNOWN_TOPOLOGY_INFO_NAME = 15;
const _ALLOWED_TOPOLOGY_RECORD_KEYS = [
  "host",
  "port",
  "tenant",
  "loadFactor",
  "volumeId",
  "siteType",
  "smvrRole",
  "isCoordinator",
  "isOwn",
  "serviceType",
  "isStandby",
];

/** @summary check whether TopologyUpdateRecord object matches expected values
 *  @param {TopologyUpdateRecord} topologyUpdateRecord The TopologyUpdateRecord object to check
 *  @param {Object} expectedValues An object containing expected values for the topology information
 *  e.g. {
 *        [HOST_NAME]: "myHostname",
 *        [HOST_PORT_NUMBER]: 35615,
 *        [TENANT_NAME]: "",
 *        [LOAD_FACTOR]: 1,
 *        [VOLUME_ID]: 2,
 *        [SITE_TYPE]: undefined,
 *        [SMVR_ROLE]: undefined,
 *        [IS_COORDINATOR]: true,
 *        [IS_CURRENT_SESSION]: true,
 *        [SERVICE_TYPE]: 3,
 *        [IS_STANDBY]: undefined,
 *       };
 */
function checkTopologyUpdateRecord(topologyUpdateRecord, expectedValues) {
  assert.strictEqual(topologyUpdateRecord instanceof TopologyUpdateRecord, true);

  Object.keys(topologyUpdateRecord).forEach(key => {
    assert.strictEqual(_ALLOWED_TOPOLOGY_RECORD_KEYS.includes(key), true);
  });

  const checks = [
    ["host", HOST_NAME],
    ["port", HOST_PORT_NUMBER],
    ["tenant", TENANT_NAME],
    ["loadFactor", LOAD_FACTOR],
    ["volumeId", VOLUME_ID],
    ["siteType", SITE_TYPE],
    ["smvrRole", SMVR_ROLE],
    ["isCoordinator", IS_COORDINATOR],
    ["isOwn", IS_CURRENT_SESSION],
    ["serviceType", SERVICE_TYPE],
    ["isStandby", IS_STANDBY],
  ];

  checks.forEach(([propName, expectedKey]) => {
    assert.strictEqual(
      topologyUpdateRecord[propName],
      expectedValues[expectedKey],
      propName + " value does not match",
    );
  });
}

/** @summary Generate a topology information Part for testing
 *  @param {Array} topologyInformationList An array of topology information,
 *  each element is an array of objects with
 *  {name: <topology_info_name>, type: <value_type>, value: <value>}.
 *  I.e.
 *  \[
 *   \[{name: <topology_info_name>, type: <value_type>, value: <value>}, ...\],
 *   \[...\],
 *  \]
  */
function generateTopologyInformationPart(topologyInformationList) {
  let testPart = new Part(PartKind.TOPOLOGY_INFORMATION, 0, 1);
  testPart = data[PartKind.TOPOLOGY_INFORMATION].write(testPart, topologyInformationList);
  return testPart;
}

// -------------------------------------------------------------------------------
// Exports
//  * note: const/function names starting with "_" are not supposed to be exported
// -------------------------------------------------------------------------------
module.exports = {
  TopologyTestUtils: {
    UNKNOWN_TOPOLOGY_INFO_NAME,
    checkTopologyUpdateRecord,
    generateTopologyInformationPart,
  },
};
