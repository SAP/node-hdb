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

var common = require('./common');
var util = require('../util');
var MessageType = common.MessageType;

module.exports = ClientInfo;

function ClientInfo() {
  this._properties = {};
  this._updatedProperties = {};
  // this._user_default and this._application_default are overwritten
  // by the APPLICATIONUSER and APPLICATION properties respectively
  this._user_default = util.os_user;
  this._application_default = "node";
}

ClientInfo.prototype.setProperty = function setProperty(key, value) {
  this._updatedProperties[key] = true;
  this._properties[key] = value;
};

ClientInfo.prototype.getProperty = function getProperty(key) {
  return this._properties[key];
};

ClientInfo.prototype.getUser = function getUser() {
  for(var key in this._properties) {
    if(key === "APPLICATIONUSER") return this._properties[key];
  }
  return this._user_default;
};

ClientInfo.prototype.getApplication = function getApplication() {
  for(var key in this._properties) {
    if(key === "APPLICATION") return this._properties[key];
  }
  return this._application_default;
}

ClientInfo.prototype.shouldSend = function shouldSend(messageType) {
  switch (messageType) {
    case MessageType.EXECUTE:
    case MessageType.EXECUTE_DIRECT:
    case MessageType.PREPARE:
    case MessageType.FETCH_NEXT:
      {
        return Object.keys(this._updatedProperties).length > 0;
      }
    default:
      return false;
  }
};

ClientInfo.prototype.getUpdatedProperties = function getUpdatedProperties() {
  var self = this;
  var res = Object.keys(this._updatedProperties).reduce(function (p, c) {
    p.push(c, self._properties[c]);
    return p;
  }, []);
  this._updatedProperties = {};
  return res;
};

