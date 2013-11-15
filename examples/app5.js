#!/usr/bin/env node

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

var util = require('util');
var fs = require('fs');
var os = require('os');
var path = require('path');
var client = require('./client');
var FileWriter = require('./FileWriter');

var fields = [
  'OBJECT_NAME || \'.\' || OBJECT_SUFFIX as FILENAME',
  'CDATA',
  'BDATA'
];
var tpl = 'select %s from _SYS_REPO.ACTIVE_OBJECT where PACKAGE_ID = ?';
var sql = util.format(tpl, fields.join(','));
var packageId = process.argv[2] || 'sap.hana.xs.ui.images';
var dirname = path.join(os.tmpdir(), packageId);

fs.mkdir(dirname, function onmkdir(err) {
  if (err && err.code !== 'EEXIST') {
    return console.error('Make directory error:', err);
  }
  client.prepare(sql, function onprepare(err, statement) {
    if (err) {
      return console.error('Prepare error:', err);
    }
    console.time('time');
    statement.exec([packageId], false, function onexec(err, rs) {
      if (err) {
        return console.error('Execute error:', err);
      }
      rs.createObjectStream()
        .pipe(new FileWriter(rs, dirname))
        .on('finish', function onfinish() {
          console.timeEnd('time');
          console.log('Downloaded %d files to %s',
            this.files.length, dirname);
          client.end();
        });
    });
  });
});