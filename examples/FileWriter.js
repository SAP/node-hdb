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
var path = require('path');
var Writable = require('stream').Writable;

module.exports = FileWriter;

util.inherits(FileWriter, Writable);

function FileWriter(rs, dirname) {
  Writable.call(this, {
    objectMode: true,
    highWaterMark: 16
  });
  this.rs = rs;
  this.dirname = dirname;
  this.files = [];
}

FileWriter.prototype._write = function _write(row, encoding, done) {
  var file = {
    name: path.join(this.dirname, row.FILENAME),
    error: undefined,
    finished: false
  };
  this.files.push(file);
  this.rs.createLobStream(row.BDATA || row.CDATA)
    .on('error', function onloberror(err) {
      file.error = err;
      done(err);
    })
    .pipe(fs.createWriteStream(file.name))
    .on('finish', function onfinish() {
      file.finished = true;
      done(null);
    });
};