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

var fs = require('fs');
var path = require('path');
var client = require('./client');
var Lob = require('../lib/protocol/Lob');

var sql = 'select cdata, bdata from _SYS_REPO.ACTIVE_OBJECT ' +
  'where PACKAGE_ID = ? and OBJECT_NAME = ? and OBJECT_SUFFIX = ?';
var values1 = [
  'sap.ui5.1.resources',
  'sap-ui-core-dbg', 'js'
];
var values2 = [
  'sap.ui5.1.test-resources.sap.ui.core.samples.components',
  'SAPLogo', 'png'
];
var values = values1;
var filename = path.join(__dirname, values.slice(1).join('.'));
client.prepare(sql, function onprepare(err, statement) {
  if (err) {
    return console.error('Prepare error:', err);
  }
  statement.exec(values, function onexec(err, rows) {
    if (err) {
      return console.error('Exec error:', err);
    }
    var lobDescriptor = rows[0].BDATA || rows[0].CDATA;
    var lob = new Lob(client._connection, lobDescriptor);
    lob.createReadStream(lobDescriptor)
      .on('error', function onerror(err) {
        console.error('Lob error:', err);
      })
      .on('end', function onend() {
        client.end();
      })
      .pipe(fs.createWriteStream(filename));
  });
});