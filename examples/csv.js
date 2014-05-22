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

var fs = require('fs');
var os = require('os');
var util = require('util');
var path = require('path');
var url = require('url');
var async = require('async');
var hdb = require('../index');

var defaults = getDefaultParams();
var params;
if (process.argv.length < 3) {
  params = defaults;
} else {
  params = url.parse(process.argv[2], true, true);
}
var hostname = params.hostname || defaults.hostname;
var port = params.port || defaults.port;
var auth = (params.auth || defaults.auth).split(':');
var user = auth[0];
var password = auth[1];
var query = util._extend({
  top: Math.pow(10, 6)
}, params.query);
var segments = params.pathname.match(/^\/?(?:([^.]+)\.)?(.*)/).slice(1);
var schema = segments[0].toUpperCase();
var tablename = segments[1].toUpperCase();
var filename = tablename.replace(/^\/[^\/]+\//, '').toLowerCase() + '.csv';
filename = path.join(os.tmpdir(), filename);

var client = hdb.createClient({
  host: hostname,
  port: port,
  user: user,
  password: password
});

function onerror(err) {
  console.log('Network error', err);
}
client.on('error', onerror);

async.waterfall([connect, execute, pipeRows], done);

function connect(cb) {
  client.connect(cb);
}

function execute(cb) {
  console.time('time');
  var sql = util.format('select top %d * from "%s"."%s"',
    query.top, schema, tablename);
  client.execute(sql, cb);
}

function pipeRows(rs, cb) {
  rs.setFetchSize(2048);
  var readStream = rs.createArrayStream();
  var writeStream = fs.createWriteStream(filename);

  function finish(err) {
    readStream.removeListener('error', finish);
    writeStream.removeListener('finish', finish);
    cb(err);
  }
  readStream.on('error', finish);
  writeStream.on('finish', finish);

  readStream.pipe(createCsvStringifier(rs.metadata)).pipe(writeStream);
}

function done(err) {
  console.timeEnd('time');
  client.end();
  if (err) {
    return console.error(err);
  }
  console.log('table %s.%s downloaded to file %s',
    schema, tablename, path.resolve(filename));
}

function createCsvStringifier(metadata) {
  /* jshint evil:true */
  var header = metadata.map(function getName(column) {
    return column.columnDisplayName;
  }).join(';') + '\n';
  var functionBody = metadata.reduce(function addLine(body, column) {
    body += 'line += row.' + column.columnDisplayName;
    if (column.dataType === 13) {
      body += '.toString(\'hex\')';
    }
    body += ';\nline += \';\'\n';
    return body;
  }, 'var line = \'\';\n') + 'return line;';
  return new hdb.Stringifier({
    header: header,
    footer: '',
    seperator: '\n',
    stringify: new Function('row', functionBody)
  });
}

function getDefaultParams() {
  var filename = path.join(__dirname, '..', 'test', 'db', 'config.json');
  var config = JSON.parse(fs.readFileSync(filename));
  return {
    hostname: config.host,
    port: config.port,
    auth: [config.user, config.password].join(':'),
    pathname: 'SYS.TABLES',
    query: {
      top: 1000
    }
  };
}