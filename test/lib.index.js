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
/* jshint expr: true */

var lib = require('../lib');
var Client = lib.Client;

function TestClient() {}
TestClient.prototype.connect = function connect(cb) {
  process.nextTick(cb);
};

describe('Lib', function () {

  describe('#index', function () {
    before(function () {
      lib.Client = TestClient;
    });
    after(function () {
      lib.Client = Client;
    });

    it('should connect', function (done) {
      var client = lib.connect({}, function (err) {
        (!err).should.be.ok;
        done();
      });
      client.should.be.instanceof(TestClient);
    });

  });
});