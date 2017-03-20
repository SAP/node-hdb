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

module.exports = ConnectionManagerState;

var ENCRYPTION_OPTIONS = ['pfx', 'key', 'cert', 'ca', 'passphrase', 'rejectUnauthorized', 'secureProtocol', 'checkServerIdentity'];
var CONNECT_OPTIONS = ['user', 'password', 'assertion', 'sessionCookie'];
var MULTIDB_OPTIONS = ['databaseName', 'instanceNumber'];

function ConnectionManagerState(initialOptions) {
  this.initialOptions = initialOptions;

  this.dbHosts = undefined;
  this.options = {
    encryption: undefined,
    connect: undefined,
    multiDb: undefined
  };
}

ConnectionManagerState.prototype.update = function update(newOptions) {
  newOptions = newOptions || {};
  this.dbHosts = this._processHostOptions(newOptions);
  this.options.encryption = this._combineOptions(ENCRYPTION_OPTIONS, newOptions);
  this.options.connect = this._combineOptions(CONNECT_OPTIONS, newOptions);
  this.options.multiDb = this._combineOptions(MULTIDB_OPTIONS, newOptions);
};

ConnectionManagerState.prototype._processHostOptions = function _processHostOptions(newOptions) {
  var initialOptions = this.initialOptions;

  if (Array.isArray(newOptions.hosts)) {
    return newOptions.hosts;
  }

  if (newOptions.host || newOptions.port) {
    return [{ host: newOptions.host || initialOptions.host, port: newOptions.port || initialOptions.port }];
  }

  if (Array.isArray(initialOptions.hosts)) {
    return initialOptions.hosts;
  }

  return [{ host: initialOptions.host, port: initialOptions.port }];
};

ConnectionManagerState.prototype._combineOptions = function _combineOptions(arrNames, newOptions) {
  var initialOptions = this.initialOptions;
  var result = {};

  arrNames.forEach(function addOption(name) {
    if (name in newOptions || name in initialOptions) {
      result[name] = newOptions[name] || initialOptions[name];
    }
  });

  return result;
};