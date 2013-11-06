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
var os = require('os');
var path = require('path');
var client = require('./client');
var Lob = require('../lib/protocol/Lob');

var sql = 'select cdata, bdata from _SYS_REPO.ACTIVE_OBJECT ' +
  'where PACKAGE_ID = ? and OBJECT_NAME = ? and OBJECT_SUFFIX = ?';

var files = [
  ['sap.ui5.1.resources', 'sap-ui-core-dbg', 'js'],
  ['sap.ui5.1.test-resources.sap.ui.core.samples.components', 'SAPLogo', 'png']
];

client.prepare(sql, function onprepare(err, statement) {
  if (err) {
    return console.error('Prepare error:', err);
  }

  var remaining = files.length;

  function done(err, filename) {
    remaining -= 1;
    if (remaining === 0) {
      client.end();
    }
    if (err) {
      return console.error('Read lob error:', filename, err);
    }
  }

  files.forEach(function copyFile(values) {
    var dirname = path.join(os.tmpdir(), values[0]);
    var filename = path.join(dirname, values.slice(1).join('.'));
    statement.exec(values, function onexec(err, rows) {
      if (err) {
        return done(err, filename);
      }

      fs.mkdir(dirname, function ondir(err) {
        if (err && err.code !== 'EEXIST') {
          done(err);
        }
        var data = rows[0].BDATA || rows[0].CDATA;
        if (data) {
          fs.writeFile(filename, data, function onwrite(err) {
            done(err, filename);
          });
        }
      });

    });
  });

});