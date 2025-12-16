// Copyright 2022 SAP SE.
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

module.exports = JWT;

function JWT(options) {
  this.name = 'JWT';
  this.token = options.token || options.password;
  this.user = undefined;
  this.sessionCookie = undefined;
}

JWT.prototype.initialData = function initialData() {
  return this.token;
};

JWT.prototype.initialize = function initialize(buffer, cb) {
  this.user = buffer.toString('utf8');
  cb();
};

JWT.prototype.finalData = function finalData() {
  return new Buffer(0);
};

JWT.prototype.finalize = function finalize(buffer) {
  this.sessionCookie = buffer;
};
