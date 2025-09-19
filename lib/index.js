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

exports.util = require('./util');
exports.util.extend(exports, require('./protocol'));
exports.Client = require('./Client');

exports.createClient = function createClient(options) {
  return new exports.Client(options);
};

exports.connect = function connect(options, cb) {
  var client = exports.createClient(options);
  client.connect(cb);
  return client;
};

exports.createJSONStringifier = function createJSONStringifier() {
  return new exports.Stringifier({
    header: '[',
    footer: ']',
    seperator: ',',
    stringify: JSON.stringify
  });
};

// External trace support should not change unless there are source code modifications
exports.isDynatraceSupported = true;
exports.isOpenTelemetrySupported = true;
