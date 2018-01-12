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

var State = require('../lib/protocol/ConnectionManagerState');

describe('Lib', function () {

  describe('#ConnectionManagerState', function () {

    describe('#_processHostOptions', function () {

      it('should return the initial host and port', function () {
        var state = new State({ host: 'localhost', port: 30015 });
        var actual = state._processHostOptions({});

        actual.should.deepEqual([{ host: 'localhost', port: 30015 }]);
      });

      it('should return the new host and port', function () {
        var state = new State({ host: 'localhost', port: 30015 });
        var actual = state._processHostOptions({ host: 'other.host', port: 31115 });

        actual.should.deepEqual([{ host: 'other.host', port: 31115 }]);
      });

      it('should return initial host and new port', function () {
        var state = new State({ host: 'localhost', port: 30015 });
        var actual = state._processHostOptions({ port: 31115 });

        actual.should.deepEqual([{ host: 'localhost', port: 31115 }]);
      });

      it('should return new host and initial port', function () {
        var state = new State({ host: 'localhost', port: 30015 });
        var actual = state._processHostOptions({ host: 'other.host' });

        actual.should.deepEqual([{ host: 'other.host', port: 30015 }]);
      });

      it('should return the initial hosts and ignore the host and port properties', function () {
        var state = new State({ host: 'localhost', port: 30015, hosts: [{ host: 'other.host', port: 31115 }] });
        var actual = state._processHostOptions({});

        actual.should.deepEqual([{ host: 'other.host', port: 31115 }]);
      });

      it('should return the new hosts and ignore the host and port properties', function () {
        var state = new State({ hosts: [{ host: 'localhost', port: 30015 }] });
        var actual = state._processHostOptions({ host: 'other.host', port: 31115, hosts: [{ host: 'other.host.2', port: 32215 }] });

        actual.should.deepEqual([{ host: 'other.host.2', port: 32215 }]);
      });

      it('should return the new host and port and ignore the initial hosts', function () {
        var state = new State({ hosts: [{ host: 'localhost', port: 30015 }] });
        var actual = state._processHostOptions({ host: 'other.host', port: 31115 });

        actual.should.deepEqual([{ host: 'other.host', port: 31115 }]);
      });

      it('should return the new hosts and ignore the initial host and port', function () {
        var state = new State({ host: 'localhost', port: 30015 });
        var actual = state._processHostOptions({ hosts: [{ host: 'other.host', port: 31115 }] });

        actual.should.deepEqual([{ host: 'other.host', port: 31115 }]);
      });

    });

    describe('#_combineOptions', function () {

      it('should return the initial options', function () {
        var initialOptions = { a: 1, b: 2, c: 3 };
        var state = new State(initialOptions);

        var actual = state._combineOptions(['a', 'b', 'c'], {});
        actual.should.deepEqual(initialOptions);
      });

      it('should return the new options', function () {
        var newOptions = { a: 11, b: 22, c: 33 };
        var state = new State({});

        var actual = state._combineOptions(['a', 'b', 'c'], newOptions);
        actual.should.deepEqual(newOptions);
      });

      it('should return a mixture of initial and new options', function () {
        var initialOptions = { a: 1, b: 2 };
        var newOptions = { b: 22, c: 33 };
        var state = new State(initialOptions);

        var expectedOptions = { a: 1, b: 22, c: 33 };
        var actual = state._combineOptions(['a', 'b', 'c'], newOptions);
        actual.should.deepEqual(expectedOptions);
      });

      it('should not take properties from the initial options that are not part of the list', function () {
        var initialOptions = { a: 1, b: 2, c: 3 };
        var state = new State(initialOptions);

        var expectedOptions = { a: 1, b: 2 };
        var actual = state._combineOptions(['a', 'b'], {});
        actual.should.deepEqual(expectedOptions);
      });

      it('should not take properties from the new options that are not present in the list', function () {
        var initialOptions = { a: 1, b: 2 };
        var newOptions = { c: 33, d: 44 };
        var state = new State(initialOptions);

        var expectedOptions = { a: 1, b: 2, c: 33 };
        var actual = state._combineOptions(['a', 'b', 'c'], newOptions);
        actual.should.deepEqual(expectedOptions);
      });

      it('should work properly even if the initial options have been changed in the meantime', function () {
        var initialOptions = { a: 1, b: 2 };
        var newOptions = { d: 44 };
        var state = new State(initialOptions);
        initialOptions.b = 22;
        initialOptions.c = 33;

        var expectedOptions = { a: 1, b: 22, c: 33, d: 44 };
        var actual = state._combineOptions(['a', 'b', 'c', 'd'], newOptions);
        actual.should.deepEqual(expectedOptions);
      });

    });

    describe('#update', function () {

      it('should be ok to be called without options', function () {
        var state = new State({});
        state.update();
      });

      it('should call the _processHostOptions method', function () {
        var returnedValue = [{ host: 'localhost', port: 30015 }];
        var state = new State({});
        state._processHostOptions = function () { return returnedValue; };

        state.update({});
        state.dbHosts.should.deepEqual(returnedValue);
      });

      function checkUpdateOfOptions(correspondingProperty, expectedOptionsList, returnedValue, whichCall) {
        var state = new State({});

        var timesCalled = 0;
        state._combineOptions = function (arrNames) {
          ++timesCalled;
          if (timesCalled === whichCall) {
            arrNames.should.deepEqual(expectedOptionsList);
            return returnedValue;
          }
        };

        state.update({});
        state.options[correspondingProperty].should.deepEqual(returnedValue);
      }

      it('should set the encryption options properly', function () {
        var correspondingProperty = 'encryption';
        var optionsList = ['pfx', 'key', 'cert', 'ca', 'passphrase', 'rejectUnauthorized', 'secureProtocol', 'checkServerIdentity', 'servername'];
        var returnedValue = { ca: 'CA certificate' };
        var whichCall = 1;

        checkUpdateOfOptions(correspondingProperty, optionsList, returnedValue, whichCall);
      });

      it('should set the connect options properly', function () {
        var correspondingProperty = 'connect';
        var optionsList = ['user', 'password', 'assertion', 'sessionCookie'];
        var returnedValue = { user: 'user', password: 'secret' };
        var whichCall = 2;

        checkUpdateOfOptions(correspondingProperty, optionsList, returnedValue, whichCall);
      });

      it('should set the multiDb options properly', function () {
        var correspondingProperty = 'multiDb';
        var optionsList = ['databaseName', 'instanceNumber'];
        var returnedValue = { databaseName: 'DB0' };
        var whichCall = 3;

        checkUpdateOfOptions(correspondingProperty, optionsList, returnedValue, whichCall);
      });

    });

  });

});