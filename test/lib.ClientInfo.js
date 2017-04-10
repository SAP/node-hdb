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
/* jshint expr:true */

var lib = require('../lib');
var ClientInfo = lib.ClientInfo;
var MessageType = lib.common.MessageType;


describe('Lib', function () {

  describe('#ClientInfo', function () {
    it('should fetch newly modified properties', function() {
      var ci = new ClientInfo();
      ci.setProperty('LOCALE', 'en');

      ci.shouldSend(MessageType.CONNECT).should.eql(false);
      ci.shouldSend(MessageType.EXECUTE_DIRECT).should.eql(true);
      ci.getUpdatedProperties().should.eql(['LOCALE', 'en']);

      ci.setProperty('APPLICATIONUSER', 'hanaUser');
      ci.shouldSend(MessageType.PREPARE).should.eql(true);
      ci.getUpdatedProperties().should.eql(['APPLICATIONUSER', 'hanaUser']);

      ci.shouldSend(MessageType.PREPARE).should.eql(false);
      ci.getUpdatedProperties().should.eql([]);
    });
  });
});




