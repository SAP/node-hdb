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

module.exports = MockResult;

function MockResult(connection, options) {
  this.connection = connection;
  this.options = options;
}

MockResult.create = function createResult(connection, options) {
  return new MockResult(connection, options);
};

MockResult.prototype.handle = function handle(err, reply, cb) {
  cb(err, reply);
};

MockResult.prototype.setResultSetMetadata = function setResultSetMetadata(metadata) {
  this.resultSetMetadata = metadata;
};
MockResult.prototype.setParameterMetadata = function setParameterMetadata(metadata) {
  this.parameterMetadata = metadata;
};