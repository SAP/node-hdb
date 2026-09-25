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
var should = require('should');
var ClientInfo = lib.ClientInfo;
var MessageType = lib.common.MessageType;
var os = require('os');

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

    it('should omit removed properties from wire payload', function() {
      var ci = new ClientInfo();
      ci.setProperty('MYKEY', 'myvalue');
      ci.getUpdatedProperties(); // flush

      ci.removeProperty('MYKEY');
      (ci.getProperty('MYKEY') === undefined).should.be.true();
      ci.shouldSend(MessageType.EXECUTE_DIRECT).should.eql(true);
      ci.getUpdatedProperties(false).should.eql(['MYKEY', '']);
      ci.shouldSend(MessageType.EXECUTE_DIRECT).should.eql(false);
    });

    it('should send null on wire for removed properties when null value is supported', function() {
      var ci = new ClientInfo();
      ci.setProperty('MYKEY', 'myvalue');
      ci.getUpdatedProperties(); // flush

      ci.removeProperty('MYKEY');
      ci.shouldSend(MessageType.EXECUTE_DIRECT).should.eql(true);
      ci.getUpdatedProperties(true).should.eql(['MYKEY', null]);
      ci.shouldSend(MessageType.EXECUTE_DIRECT).should.eql(false);
    });

    it('should order null values before non-null values on the wire', function() {
      var ci = new ClientInfo();
      ci.setProperty('SETKEY', 'setvalue');
      ci.setProperty('REMOVEKEY', 'removevalue');
      ci.getUpdatedProperties(); // flush
      ci.setProperty('SETKEY', 'setvalue');
      ci.removeProperty('REMOVEKEY');
      ci.getUpdatedProperties(true).should.eql(['REMOVEKEY', null, 'SETKEY', 'setvalue']);
    });

    it('should be a no-op when removing a property that was never set', function() {
      var ci = new ClientInfo();
      ci.removeProperty('NONEXISTENT');
      ci.shouldSend(MessageType.EXECUTE_DIRECT).should.eql(false);
    });

    it('should provide default application and application user values', function() {
      var ci = new ClientInfo();
      ci.getUser().should.eql(os.userInfo().username);
      ci.getApplication().should.eql('node');
    });

    it('should override default application and application user values', function() {
      var ci = new ClientInfo();
      ci.setProperty('APPLICATIONUSER', 'TestUser');
      ci.getUser().should.eql('TestUser');

      ci.setProperty('APPLICATION', 'lib.ClientInfo.js');
      ci.getApplication().should.eql('lib.ClientInfo.js');
    });
  });
});




