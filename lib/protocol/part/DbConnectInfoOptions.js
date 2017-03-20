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
var DbConnectInfo = require('../common/DbConnectInfoOption');
var TypeCode = require('../common/TypeCode');

module.exports = DbConnectInfoOptions;

util.inherits(DbConnectInfoOptions, AbstractOptions);

function DbConnectInfoOptions() {
  AbstractOptions.call(this);
}

DbConnectInfoOptions.prototype.PROPERTY_NAMES = common.DbConnectInfoOptionName;
var types = DbConnectInfoOptions.prototype.TYPES = {};
types[DbConnectInfo.DATABASE_NAME] = TypeCode.STRING;
types[DbConnectInfo.HOST] = TypeCode.STRING;
types[DbConnectInfo.PORT] = TypeCode.INT;
types[DbConnectInfo.IS_CONNECTED] = TypeCode.BOOLEAN;
DbConnectInfoOptions.prototype.KEYS = [
  DbConnectInfo.DATABASE_NAME,
  DbConnectInfo.HOST,
  DbConnectInfo.PORT,
  DbConnectInfo.IS_CONNECTED
];