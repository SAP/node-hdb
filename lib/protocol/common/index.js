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

exports.ClientDistributionMode = require('./ClientDistributionMode');
exports.CommandOption = require('./CommandOption');
exports.CommitOption = require('./CommitOption');
exports.DbConnectInfoOption = require('./DbConnectInfoOption');
exports.ConnectOption = require('./ConnectOption');
exports.ConnectOptionType = require('./ConnectOptionType');
exports.ClientContextOption = require('./ClientContextOption');
exports.DataFormatVersion = require('./DataFormatVersion');
exports.DistributionProtocolVersion = require('./DistributionProtocolVersion');
exports.ErrorLevel = require('./ErrorLevel');
exports.FunctionCode = require('./FunctionCode');
exports.IoType = require('./IoType');
exports.LobOptions = require('./LobOptions');
exports.LobSourceType = require('./LobSourceType');
exports.MessageType = require('./MessageType');
exports.ParameterMode = require('./ParameterMode');
exports.PartKind = require('./PartKind');
exports.ResultSetAttributes = require('./ResultSetAttributes');
exports.SegmentKind = require('./SegmentKind');
exports.SessionContext = require('./SessionContext');
exports.StatementContext = require('./StatementContext');
exports.StatementContextType = require('./StatementContextType');
exports.TransactionFlag = require('./TransactionFlag');
exports.TopologyInformation = require('./TopologyInformation');
exports.TypeCode = require('./TypeCode');
exports.NormalizedTypeCode = require('./NormalizedTypeCode');
exports.ReadFunction = require('./ReadFunction');
exports.RedirectType = require('./RedirectType');

invert('DbConnectInfoOption');
invert('ConnectOption');
invert('ClientContextOption');
invert('TransactionFlag');
invert('TopologyInformation');
invert('MessageType');
invert('StatementContext');
invert('SessionContext');
invert('TypeCode');
invert('FunctionCode');
invert('PartKind');
invert('SegmentKind');

function invert(name) {
  /* jshint forin: false */
  var source = exports[name];
  var target = {};
  for (var key in source) {
    target[source[key]] = key;
  }
  exports[name + 'Name'] = target;
}

util.extend(exports, require('./Constants'));
