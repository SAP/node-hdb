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
var Segment = require('./Segment');
var Part = require('./Part');
var common = require('../common');
var MessageType = common.MessageType;
var PartKind = common.PartKind;
var TypeCode = common.TypeCode;
var CommandOption = common.CommandOption;
var CommitOption = common.CommitOption;
var DbConnectInfoOption = common.DbConnectInfoOption;

exports.Segment = Segment;
exports.Part = Part;
exports.authenticate = authenticate;
exports.connect = connect;
exports.disconnect = disconnect;
exports.executeDirect = executeDirect;
exports.prepare = prepare;
exports.execute = execute;
exports.fetchNext = fetchNext;
exports.closeResultSet = closeResultSet;
exports.dropStatementId = dropStatementId;
exports.readLob = readLob;
exports.writeLob = writeLob;
exports.commit = commit;
exports.rollback = rollback;
exports.dbConnectInfo = dbConnectInfo;

function createSegment(type, options) {
  options = options || {};
  var commitImmediateley = 0;
  var commandOptions = 0;
  switch (type) {
    case MessageType.EXECUTE:
    case MessageType.EXECUTE_DIRECT:
      commitImmediateley = getCommitImmediateley(options, 1);
      commandOptions = getCommandOptions(options);
      break;
    case MessageType.FETCH_NEXT:
    case MessageType.READ_LOB:
      commitImmediateley = getCommitImmediateley(options, 1);
      break;
    case MessageType.PREPARE:
      commandOptions = getCommandOptions(options);
      break;
    default:
    // do nothing
  }
  var segment = new Segment(type, commitImmediateley, commandOptions, options.useCesu8);
  return segment;
}

function getCommitImmediateley(options, defaultValue) {
  /* jshint bitwise:false */
  var commitImmediateley = defaultValue;
  if (!util.isUndefined(options.autoCommit)) {
    commitImmediateley = ~~options.autoCommit;
  } else if (!util.isUndefined(options.commitImmediateley)) {
    commitImmediateley = ~~options.commitImmediateley;
  }
  return commitImmediateley;
}

function getCommandOptions(options) {
  /* jshint bitwise:false */
  var commandOptions = 0;
  if (options.scrollableCursor) {
    commandOptions |= CommandOption.SCROLLABLE_CURSOR_ON;
  }
  if (options.holdCursorsOverCommit) {
    commandOptions |= CommandOption.HOLD_CURSORS_OVER_COMMIT;
  }
  return commandOptions;
}

function authenticate(options) {
  var segment = createSegment(MessageType.AUTHENTICATE, options);
  // authentication
  segment.add(PartKind.CLIENT_CONTEXT, options.clientContext);
  segment.add(PartKind.AUTHENTICATION, options.authentication);
  if (options.dbConnectInfo) {
    segment.add(PartKind.DB_CONNECT_INFO, []);
  }
  return segment;
}

function connect(options) {
  var segment = createSegment(MessageType.CONNECT, options);
  // authentication
  segment.add(PartKind.AUTHENTICATION, options.authentication);
  // clientId
  segment.add(PartKind.CLIENT_ID, options.clientId);
  // connectOptions
  segment.add(PartKind.CONNECT_OPTIONS, options.connectOptions);
  return segment;
}

function disconnect(options) {
  var segment = createSegment(MessageType.DISCONNECT, options);
  return segment;
}

function closeResultSet(options) {
  var segment = createSegment(MessageType.CLOSE_RESULT_SET, options);
  // resultSetId
  segment.add(PartKind.RESULT_SET_ID, options.resultSetId);
  return segment;
}

function dropStatementId(options) {
  var segment = createSegment(MessageType.DROP_STATEMENT_ID, options);
  // statementId
  segment.add(PartKind.STATEMENT_ID, options.statementId);
  return segment;
}

function commit(options) {
  var segment = createSegment(MessageType.COMMIT, options);
  // commitOptions
  addCommitOptions(segment, options);
  return segment;
}

function rollback(options) {
  var segment = createSegment(MessageType.ROLLBACK, options);
  // commitOptions
  addCommitOptions(segment, options);
  return segment;
}

function fetchNext(options) {
  var segment = createSegment(MessageType.FETCH_NEXT, options);
  // resultSetId
  segment.add(PartKind.RESULT_SET_ID, options.resultSetId);
  // fetchSize
  segment.add(PartKind.FETCH_SIZE, options.fetchSize);
  return segment;
}

function readLob(options) {
  var segment = createSegment(MessageType.READ_LOB, options);
  // readLobRequest
  segment.add(PartKind.READ_LOB_REQUEST, options.readLobRequest);
  return segment;
}

function writeLob(options) {
  var segment = createSegment(MessageType.WRITE_LOB);
  // writeLobRequest
  segment.add(PartKind.WRITE_LOB_REQUEST, options.writeLobRequest);
  return segment;
}

function execute(options) {
  var segment = createSegment(MessageType.EXECUTE, options);
  // statementId
  segment.add(PartKind.STATEMENT_ID, options.statementId);
  // parameters
  segment.add(PartKind.PARAMETERS, options.parameters);
  return segment;
}

function executeDirect(options) {
  var segment = createSegment(MessageType.EXECUTE_DIRECT, options);
  // command
  segment.add(PartKind.COMMAND, options.command);
  return segment;
}

function prepare(options) {
  var segment = createSegment(MessageType.PREPARE, options);
  // command
  segment.add(PartKind.COMMAND, options.command);
  return segment;
}

function dbConnectInfo(options) {
  var segment = createSegment(MessageType.DB_CONNECT_INFO);
  segment.add(PartKind.DB_CONNECT_INFO, [{
    name: DbConnectInfoOption.DATABASE_NAME,
    type: TypeCode.STRING,
    value: options.databaseName
  }]);
  return segment;
}

function addCommitOptions(segment, options) {
  if (options.holdCursorsOverCommit) {
    var commitOptions = [{
      name: CommitOption.HOLD_CURSORS_OVER_COMMIT,
      type: TypeCode.BOOLEAN,
      value: 1
    }];
    segment.add(PartKind.COMMIT_OPTIONS, commitOptions);
  }
  return segment;
}
