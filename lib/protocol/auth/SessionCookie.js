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

module.exports = SessionCookie;

function SessionCookie(options) {
  this.name = 'SessionCookie';
  var termId = new Buffer(util.cid, 'utf8');
  var rawSessionCookie = options.sessionCookie;
  var length = rawSessionCookie.length + termId.length;
  this.sessionCookie = new Buffer.concat([rawSessionCookie, termId], length);
}

SessionCookie.prototype.initialData = function initialData() {
  return this.sessionCookie;
};

SessionCookie.prototype.initialize = function initialize(buffer, cb) {
  /* jshint unused:false */
  cb();
};

SessionCookie.prototype.finalData = function finalData() {
  return new Buffer(0);
};

SessionCookie.prototype.finalize = function finalize(buffer) {
  /* jshint unused:false */
};
