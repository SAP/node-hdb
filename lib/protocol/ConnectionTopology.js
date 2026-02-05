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
    if (Array.isArray(updatedTopology) && updatedTopology.length > 0) {
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

/**
 * System information (Topology related information for a single logical connection)
 */
class SystemInfo {
  constructor() {
    this._locations = [];
    this._volumeIdSet = new Set();
  }

  /**
   * Update (add/modify/remove) the topology stored in the location list.
   * @param {Array.<TopologyUpdateRecord>} topologyUpdateRecords updated topology received from
   * server which is an array of TopologyUpdateRecord objects
   * @returns {{topologyUpdated: boolean, detectedBadTopology: boolean}}
   * {topologyUpdated, detectedBadTopology}:
   *    topologyUpdated - set to true if topology is updated;
   *    detectedBadTopology - set to true if detected bad topology
   **/
  addOrUpdateTopology(topologyUpdateRecords) {
    let topologyUpdated = false;
    let detectedBadTopology = false;
    let ownRecordIdx = 0;
    let foundOwnRecord = false;

    if (!Array.isArray(topologyUpdateRecords)) {
      // No topology update records
      // Note this should not happen as passed in topologyUpdateRecords should have been validated
      return {topologyUpdated, detectedBadTopology};
    }

    // Check whether bad topology exists
    this._volumeIdSet.clear();
    for (let idx = 0; idx < topologyUpdateRecords.length; idx++) {
      const topologyUpdateRecord = topologyUpdateRecords[idx];
      if (topologyUpdateRecord.isOwn) {
        if (foundOwnRecord) {
          detectedBadTopology = true;
          // TRACE TODO: trace the reason that bad topology was detected
          break;
        }
        foundOwnRecord = true;
        ownRecordIdx = idx;
      }
      if (topologyUpdateRecord.volumeId === INVALID_VOLUME_ID) {
        // TRACE TODO: trace the reason that bad topology was detected
        detectedBadTopology = true;
        break;
      }
      if (this._volumeIdSet.has(topologyUpdateRecord.volumeId)) {
        // TRACE TODO: trace the reason that bad topology was detected
        detectedBadTopology = true;
        break;
      }
      this._volumeIdSet.add(topologyUpdateRecord.volumeId);
    };

    // Missing own topology record is considered as bad topology
    if (!detectedBadTopology && !foundOwnRecord) {
      // TRACE TODO: trace the reason that bad topology was detected
      detectedBadTopology = true;
    }

    // Bad topology detected, do not update
    if (detectedBadTopology) {
      topologyUpdated = false;
      this._volumeIdSet.clear();
      this._locations = [];
      return {topologyUpdated, detectedBadTopology};
    }

    // Update topology based on records
    topologyUpdateRecords.forEach((topologyUpdateRecord) => {
      const updated = this._updateTopology(topologyUpdateRecord);
      topologyUpdated = topologyUpdated || updated;
    });

    // If the pconnLocation is invalid, then the pconnLocation (the address used to make this connection)
    // contains the preferred host address (because the address didn't come from topology).
    // TODO: set pconnLocation's host as ownLocation's preferred host

    // Remove existing locations in the topology which are not present in the updated topology
    // provided by the server.
    for (let i = this._locations.length - 1; i >= 0; i--) {
      if (!this._volumeIdSet.has(this._locations[i]._volumeId)) {
        this._locations.splice(i, 1);
        topologyUpdated = true;
      }
    }

    return {topologyUpdated, detectedBadTopology};
  }

  /**
   * Update location information according to topologyUpdateRecord with same volumeId
   * @param {TopologyUpdateRecord} topologyUpdateRecord The topology update record used to update
   * the topology
   * @returns {boolean} true if topology is updated; false otherwise
   */
  _updateTopology(topologyUpdateRecord) {
    if (!(topologyUpdateRecord instanceof TopologyUpdateRecord)) {
      // Note this should not happen as passed in topologyUpdateRecords should have been
      // checked by SystemInfo::addOrUpdateTopology
      return false;
    }
    for (let i = 0; i < this._locations.length; i++) {
      if (!this._locations[i]) {
        continue;
      }
      if (this._locations[i]._volumeId === topologyUpdateRecord.volumeId) {
        return this._locations[i].update(topologyUpdateRecord);
      }
    }
    const locationToInsert = new Location(topologyUpdateRecord);
    this._locations.push(locationToInsert);
    return true;
  }
}

module.exports = {
  INVALID_VOLUME_ID,
  IgnoreTopologyEnum,
  Location,
  TopologyUpdateRecord,
  SystemInfo,
};
