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

var SCRAMSHA256 = require('./SCRAMSHA256');
var SAML = require('./SAML');
var SessionCookie = require('./SessionCookie');

module.exports = Manager;

function Manager(options) {
  options = options || {};
  this.user = options.user || '';
  this._authMethod = undefined;
  this._authMethods = [];
  if (options.assertion || (!options.user && options.password)) {
    this._authMethods.push(new SAML(options));
  }
  if (options.sessionCookie) {
    this._authMethods.push(new SessionCookie(options));
  }
  if (options.user && options.password) {
    this._authMethods.push(new SCRAMSHA256(options));
  }
  if (!this._authMethods.length) {
    throw noAuthMethodFound();
  }
}

Object.defineProperties(Manager.prototype, {
  userFromServer: {
    get: function getUserFromServer() {
      if (this._authMethod && this._authMethod.user) {
        return this._authMethod.user;
      }
      return this.user;
    }
  },
  sessionCookie: {
    get: function getSessionCookie() {
      if (this._authMethod && this._authMethod.sessionCookie) {
        return this._authMethod.sessionCookie;
      }
    }
  }
});

Manager.prototype.initialData = function initialData() {
  var fields = [this.user];
  this._authMethods.forEach(function initialDataOfMethod(method) {
    fields.push(method.name, method.initialData());
  });
  return fields;
};

Manager.prototype.initialize = function initialize(fields) {
  var initializedMethods = [];
  var name, method, buffer;
  while (fields.length) {
    name = fields.shift().toString('ascii');
    method = this.getMethod(name);
    buffer = fields.shift();
    if (method && buffer) {
      method.initialize(buffer);
      initializedMethods.push(method);
    }
  }
  if (!initializedMethods.length) {
    throw noAuthMethodFound();
  }
  this._authMethod = initializedMethods.shift();
  this._authMethods = undefined;
};

Manager.prototype.finalData = function finalData() {
  var fields = [this.userFromServer];
  if (this._authMethod) {
    fields.push(this._authMethod.name, this._authMethod.finalData());
  }
  return fields;
};

Manager.prototype.finalize = function finalize(fields) {
  var name, buffer;
  while (fields.length) {
    name = fields.shift().toString('ascii');
    buffer = fields.shift();
    if (this._authMethod.name === name) {
      this._authMethod.finalize(buffer);
      break;
    }
  }
};

Manager.prototype.getMethod = function getMethod(name) {
  var method;
  for (var i = 0; i < this._authMethods.length; i++) {
    method = this._authMethods[i];
    if (method.name === name) {
      return method;
    }
  }
};

function noAuthMethodFound() {
  var error = new Error('No authentication method found');
  error.code = 'EHDBNOAUTHMETH';
  return error;
}