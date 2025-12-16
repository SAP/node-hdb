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
var DbConnectInfoOption = lib.common.DbConnectInfoOption;

function createDbConnectInfoOptions() {
  return new lib.part.DbConnectInfoOptions();
}

describe('Part', function () {

  describe('#DbConnectInfoOptions', function () {

    it('create a valid DbConnectInfoOptions', function () {
      var dbConnectInfo = createDbConnectInfoOptions();

      var databaseName = 'DB0';
      var host = '127.0.0.1';
      var port = 30041;
      var isConnected = false;

      var options = [
        { name: DbConnectInfoOption.DATABASE_NAME, value: databaseName },
        { name: DbConnectInfoOption.HOST, value: host },
        { name: DbConnectInfoOption.PORT, value: port },
        { name: DbConnectInfoOption.IS_CONNECTED, value: isConnected }
      ];

      dbConnectInfo.setOptions(options);

      dbConnectInfo.databaseName.should.equal(databaseName);
      dbConnectInfo.host.should.equal(host);
      dbConnectInfo.port.should.equal(port);
      dbConnectInfo.isConnected.should.equal(isConnected);
    });

  });

});