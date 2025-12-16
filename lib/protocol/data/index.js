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

var common = require('../common');
var PartKind = common.PartKind;

var Binary = require('./Binary');
var Default = require('./Default');
var Fields = require('./Fields');
var TextList = require('./TextList');

var Int32 = require('./Int32');
var MultilineOptions = require('./MultilineOptions');
var Options = require('./Options');
var ParameterMetadata = require('./ParameterMetadata');
var Parameters = require('./Parameters');
var ReadLobReply = require('./ReadLobReply');
var ReadLobRequest = require('./ReadLobRequest');
var ResultSetMetadata = require('./ResultSetMetadata');
var SqlError = require('./SqlError');
var Text = require('./Text');
var Text20 = require('./Text20');
var TransactionFlags = require('./TransactionFlags');
var WriteLobReply = require('./WriteLobReply');

var rw = module.exports = {};
rw[PartKind.COMMAND] = Text;
rw[PartKind.RESULT_SET] = Default;
rw[PartKind.ERROR] = SqlError;
rw[PartKind.STATEMENT_ID] = Binary;
rw[PartKind.TRANSACTION_ID] = Binary;
rw[PartKind.ROWS_AFFECTED] = Int32;
rw[PartKind.RESULT_SET_ID] = Binary;
rw[PartKind.TOPOLOGY_INFORMATION] = MultilineOptions;
rw[PartKind.READ_LOB_REQUEST] = ReadLobRequest;
rw[PartKind.READ_LOB_REPLY] = ReadLobReply;
rw[PartKind.TABLE_NAME] = Text;
rw[PartKind.WRITE_LOB_REQUEST] = Default;
rw[PartKind.CLIENT_CONTEXT] = Options;
rw[PartKind.WRITE_LOB_REPLY] = WriteLobReply;
rw[PartKind.PARAMETERS] = Parameters;
rw[PartKind.AUTHENTICATION] = Fields;
rw[PartKind.SESSION_CONTEXT] = Options;
rw[PartKind.CLIENT_ID] = Text20;
rw[PartKind.STATEMENT_CONTEXT] = Options;
rw[PartKind.PARTITION_INFORMATION] = Default;
rw[PartKind.OUTPUT_PARAMETERS] = Default;
rw[PartKind.CONNECT_OPTIONS] = Options;
rw[PartKind.COMMIT_OPTIONS] = Options;
rw[PartKind.FETCH_OPTIONS] = Options;
rw[PartKind.FETCH_SIZE] = Int32;
rw[PartKind.PARAMETER_METADATA] = ParameterMetadata;
rw[PartKind.RESULT_SET_METADATA] = ResultSetMetadata;
rw[PartKind.CLIENT_INFO] = TextList;
rw[PartKind.TRANSACTION_FLAGS] = TransactionFlags;
rw[PartKind.DB_CONNECT_INFO] = Options;

for (var name in PartKind) {
  /* jshint forin: false */
  var kind = PartKind[name];
  if (!rw[kind]) {
    rw[kind] = Default;
  }
}
