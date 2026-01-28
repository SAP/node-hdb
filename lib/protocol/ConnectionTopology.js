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
} = require("./common/TopologyInformation");
const NetworkUtil = require("../util/Network");

// Constants/Enums
const INVALID_VOLUME_ID = 0x000fffff;
const IgnoreTopologyEnum = Object.freeze({
  IgnoreTopology_NotIgnoring: "NOT IGNORING",
  IgnoreTopology_Requested: "REQUESTED",
  IgnoreTopology_InvalidTopology: "INVALID TOPOLOGY",
  IgnoreTopology_PortForwarding: "PORT FORWARDING",
});

class Location {
  /**
   * @constructs Location based on TopologyUpdateRecord.
   * Note topologyUpdateRecord should have been validated by caller.
   */
  constructor(topologyUpdateRecord) {
    this._host =
      topologyUpdateRecord.host === null || topologyUpdateRecord.host === undefined
        ? undefined
        : topologyUpdateRecord.host.toLowerCase();
    this._port = topologyUpdateRecord.port;
    this._preferredHost = undefined;
    this._volumeId =
      topologyUpdateRecord.volumeId === null || topologyUpdateRecord.volumeId === undefined
        ? INVALID_VOLUME_ID
        : topologyUpdateRecord.volumeId;
    this._serviceType = topologyUpdateRecord.serviceType;
    this._isCoordinator = topologyUpdateRecord.isCoordinator;
  }

  /**
   * Update stored topology information.
   * @param {TopologyUpdateRecord} topologyUpdateRecord The topology update record, MUST have the same
   * volumeId as this location.
   **/
  update(topologyUpdateRecord) {
    let updated = false;
    if (this._host !== topologyUpdateRecord.host.toLowerCase() ||
        this._port !== topologyUpdateRecord.port) {
      this._host = topologyUpdateRecord.host.toLowerCase();
      this._port = topologyUpdateRecord.port;
      this._preferredHost = undefined;
      updated = true;
    }
    if (this._serviceType !== topologyUpdateRecord.serviceType) {
      this._serviceType = topologyUpdateRecord.serviceType;
      updated = true;
    }
    if (this._isCoordinator !== topologyUpdateRecord.isCoordinator) {
      this._isCoordinator = topologyUpdateRecord.isCoordinator;
      updated = true;
    }
    return updated;
  }
}

class TopologyUpdateRecord {
  /**
   * @constructs TopologyUpdateRecord
   * @param {Array} updatedTopology An array of topology information objects, each element is
   * an object with {name: <topology_info_name>, type: <value_type>, value: <value>}
   */
  constructor(updatedTopology) {
    updatedTopology.forEach(updatedTopologyOption => {
      switch (updatedTopologyOption.name) {
        case HOST_NAME:
          this.host = updatedTopologyOption.value;
          break;
        case HOST_PORT_NUMBER:
          this.port = updatedTopologyOption.value;
          break;
        case TENANT_NAME:
          this.tenant = updatedTopologyOption.value;
          break;
        case LOAD_FACTOR:
          this.loadFactor = updatedTopologyOption.value;
          break;
        case VOLUME_ID:
          this.volumeId = updatedTopologyOption.value & INVALID_VOLUME_ID;
          break;
        case SITE_TYPE:
          this.siteType = updatedTopologyOption.value;
          break;
        case SMVR_ROLE:
          this.smvrRole = updatedTopologyOption.value;
          break;
        case IS_COORDINATOR:
          this.isCoordinator = updatedTopologyOption.value;
          break;
        case IS_CURRENT_SESSION:
          this.isOwn = updatedTopologyOption.value;
          break;
        case SERVICE_TYPE:
          this.serviceType = updatedTopologyOption.value;
          break;
        case IS_STANDBY:
          this.isStandby = updatedTopologyOption.value;
          break;
        default: // Unknown/deprecated topology option
          break;
      }
    });
  }

  /**
   * @constructs TopologyUpdateRecord
   */
  static create(updatedTopology) {
    if (updatedTopology && Array.isArray(updatedTopology) && updatedTopology.length > 0) {
      return new TopologyUpdateRecord(updatedTopology);
    }
    return null;
  }

  /**
   * @summary Check if host and port are valid or if port forwarding is detected or not.
   * And update port information when host contains valid port information.
   * @param connectPort port number used to make the connection
   * @returns {Object} {isValid: boolean, failureReason: IgnoreTopologyEnum}:
   *  - isValid: set to true if both host and port are valid and no port forwarding detected
   *  - failureReason: set to IgnoreTopologyEnum reason if isValid is false; otherwise, not ignoring
   */
  validateAndUpdate(connectPort) {
    let isValid = true;
    let failureReason = IgnoreTopologyEnum.IgnoreTopology_NotIgnoring;
    if (!this.host || this.host.length === 0) {
      isValid = false;
    } else {
      const {valid: isAddressValid, parsedHost, parsedPort} = NetworkUtil.splitAddressStr(this.host);
      isValid = isAddressValid;
      if (isValid) {
        this.host = parsedHost;
        this.port = parsedPort === 0 ? this.port : parsedPort;
      }
      if (this.port <= 0 || this.port > 65535) {
        isValid = false;
      }
    }
    if (isValid) {
      if (this.isOwn && connectPort !== this.port) {
        isValid = false;
        failureReason = IgnoreTopologyEnum.IgnoreTopology_PortForwarding;
      }
    } else {
      failureReason = IgnoreTopologyEnum.IgnoreTopology_InvalidTopology;
    }
    return {isValid, failureReason};
  }
}
module.exports = {
  INVALID_VOLUME_ID,
  IgnoreTopologyEnum,
  Location,
  TopologyUpdateRecord,
};
