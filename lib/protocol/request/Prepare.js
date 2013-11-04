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

var Segment = require('./Segment');
var common = require('../common');
var MessageType = common.MessageType;
var PartKind = common.PartKind;
var CommandOption = common.CommandOption;

module.exports = function executeDirect(options) {
  /* jshint bitwise:false */
  var commitImmediateley = true;
  if (typeof options.commitImmediateley === 'boolean') {
    commitImmediateley = options.commitImmediateley;
  }
  var commandOptions = CommandOption.SCROLLABLE_CURSOR_ON | CommandOption.HOLD_CURSORS_OVER_COMMIT;
  if (typeof options.commandOptions === 'number') {
    commandOptions = options.commandOptions;
  }
  var segment = new Segment(MessageType.PREPARE, {
    commitImmediateley: commitImmediateley,
    commandOptions: commandOptions
  });

  // command
  segment.add(PartKind.COMMAND, options.command);
  return segment;
};