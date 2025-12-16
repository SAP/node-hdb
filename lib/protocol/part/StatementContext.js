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
var PART_HEADER_LENGTH = common.PART_HEADER_LENGTH;
module.exports = StatementContext;

util.inherits(StatementContext, AbstractOptions);

function StatementContext() {
  AbstractOptions.call(this);

  // Information on the statement sequence within the transaction
  this.statementSequenceInfo = undefined;
  // Time for statement execution on the server in nano seconds
  this.serverExecutionTime = 0;
}

Object.defineProperties(StatementContext.prototype, {
  size: {
    get: function getSize() {
      var statementSequenceInfoLength;
      if (this.statementSequenceInfo) {
        statementSequenceInfoLength = this.statementSequenceInfo.length;
      } else {
        statementSequenceInfoLength = 10;
      }
      return PART_HEADER_LENGTH + util.alignLength(4 +
        statementSequenceInfoLength, 8);
    }
  }
});

StatementContext.prototype.PROPERTY_NAMES = common.StatementContextName;
StatementContext.prototype.TYPES = common.StatementContextType;
StatementContext.prototype.KEYS = [
  common.StatementContext.STATEMENT_SEQUENCE_INFO
];