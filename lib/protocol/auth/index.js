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

var SCRAMSHA256 = exports.SCRAMSHA256 = require('./SCRAMSHA256');
var SAML = exports.SAML = require('./SAML');

exports.createAlgorithm = createAlgorithm;
exports.algorithms = {
  SCRAMSHA256: SCRAMSHA256,
  SAML: SAML
};

function createAlgorithm(options) {
  options = options || {};
  var algorithm = null;
  if (options.user && options.password) {
    algorithm = new SCRAMSHA256(options);
  } else if (!options.user && (options.assertion || options.password)) {
    algorithm = new SAML(options);
  }
  return algorithm;
}