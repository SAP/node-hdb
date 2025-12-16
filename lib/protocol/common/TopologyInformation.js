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

module.exports = {
  HOST_NAME: 1,
  HOST_PORT_NUMBER: 2,
  TENAT_NAME: 3,
  LOAD_FACTOR: 4,
  VOLUME_ID: 5,
  IS_MASTER: 6,
  IS_CURRENT_SESSION: 7,
  SERVICE_TYPE: 8,
  NETWORK_DOMAIN: 9,
  IS_STANDBY: 10,
  ALL_IP_ADDRESSES: 11,
  ALL_HOST_NAMES: 12
};

Object.defineProperty(module.exports, 'ALL_IP_ADRESSES', {
  get: function () {
    return this.ALL_IP_ADDRESSES;
  }
});