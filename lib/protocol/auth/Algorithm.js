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

module.exports = Algorithm;

function Algorithm(name, user) {
  this.name = name;
  this.user = user || '';
}

Algorithm.prototype.getInitialFields = function getInitialFields() {
  return [this.user, this.name, this.getInitialData()];
};

Algorithm.prototype.getInitialData = function getInitialData() {
  return new Buffer(0);
};

Algorithm.prototype.getFinalFields = function getFinalFields(fields) {
  return [this.user, this.name, this.getFinalData(fields)];
};

Algorithm.prototype.getFinalData = function getFinalData(fields) {
  /* jshint unused:false */
  return new Buffer(0);
};