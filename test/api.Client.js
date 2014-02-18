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
/*jshint expr:true*/

var should = require('should');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var lib = require('./lib');

util.inherits(TestClient, lib.Client);

function TestClient(options) {
  lib.Client.call(this, options);
}

TestClient.prototype._createConnection = function _createConnection(options) {
  this._connection = new TestConnection(this._settings);
};
var CONNECT_OPTIONS = {};
var CLIENT_ID = 'nodejs@localhost';

function TestConnection(settings) {
  EventEmitter.call(this);
  this._settings = settings;
  this.connectOptions = CONNECT_OPTIONS;
  this.clientId = CLIENT_ID;
  this.readyState = 'new';
}

describe('Api', function () {

  describe('#Client', function () {

    it('should create a Client', function () {
      var client = new TestClient({
        host: 'localhost',
        port: 30015,
        user: 'TEST_USER',
        password: 'secret'
      });
      client._connection.should.be.instanceof(TestConnection);
      client.connectOptions.should.equal(CONNECT_OPTIONS);
      client.clientId.should.equal(CLIENT_ID);
      client.readyState.should.equal('new');
    });

  });

});