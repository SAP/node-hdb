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

var util = require('../../util');
var AbstractOptions = require('./AbstractOptions');
var common = require('../common');
var ClientContext = require('../common/ClientContextOption');
var TypeCode = require('../common/TypeCode');
var pjson = require('../../../package.json');

module.exports = ClientContextOptions;

util.inherits(ClientContextOptions, AbstractOptions);

function ClientContextOptions() {
  AbstractOptions.call(this);

  this.clientVersion = pjson.version,

  this.clientType = 'node-hdb';

  this.clientApplicationProgram = 'node';
}

ClientContextOptions.prototype.PROPERTY_NAMES = common.ClientContextOptionName;
var types = ClientContextOptions.prototype.TYPES = {};
types[ClientContext.CLIENT_VERSION] = TypeCode.STRING;
types[ClientContext.CLIENT_TYPE] = TypeCode.STRING;
types[ClientContext.CLIENT_APPLICATION_PROGRAM] = TypeCode.STRING;
ClientContextOptions.prototype.KEYS = [
  ClientContext.CLIENT_VERSION,
  ClientContext.CLIENT_TYPE,
  ClientContext.CLIENT_APPLICATION_PROGRAM
];
