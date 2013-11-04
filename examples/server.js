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
var os = require('os');
var url = require('url');
var http = require('http');
var pool = require('./pool');
var hdb = require('../index');
var hostname = os.hostname().toLowerCase();
var port = process.env.PORT || 1337;

if (!/\.wdf\.sap\.corp$/.test(hostname)) {
  hostname += '.dhcp.wdf.sap.corp';
}

http.createServer(function (req, res) {
  if (req.url === '/favicon.ico') {
    res.writeHead(404);
    res.end();
    return;
  }
  pool.acquire(function (err, client) {
    if (err) {
      return badRequest(res, err);
    }

    var data = parseRequest(req);
    res.writeHead(200, data.headers);

    console.log(data.sql);

    client.exec(data.sql, false, function onexec(err, rs) {
      if (err) {
        return badRequest(res, err);
      }
      var transform = createStringifier();
      rs.createReadStream()
        .once('end', function onend() {
          pool.release(client);
        })
        .once('error', function (err) {
          pool.release(client);
        })
        .pipe(transform)
        .pipe(res);
    });

  });
}).listen(port);
console.log('Server running on at http://%s:%d/', hostname, port);

function createStringifier() {
  return new hdb.Stringifier({
    header: '[',
    footer: ']',
    seperator: ',',
    stringify: JSON.stringify
  });
}

function badRequest(res, err) {
  res.writeHead(400, {
    'Content-Type': 'text/plain'
  });
  res.end(err.message);
}

function escapeQualifiedName(name) {
  return '"' + name.toUpperCase().replace(/"/g, '""').replace(/\./g, '"."') +
    '"';
}

function parseRequest(req) {
  var reqUrl = url.parse(req.url, true);
  var query = reqUrl.query || {};
  var top = parseInt(query.top, 10) || 10000;

  var path = reqUrl.pathname.split('/');
  path.shift();
  if (!path[path.length - 1]) {
    path.pop();
  }

  var tablename = path.map(function normalize(segment) {
    return segment.toLowerCase();
  }).join('.') || 'tables';

  var headers = {
    'Content-Type': 'application/json'
  };
  if (top > 10000) {
    headers['Content-Disposition'] = 'attachment; filename=' + tablename +
      '.json;';
  }
  return {
    sql: util.format('select * from %s limit %d', escapeQualifiedName(tablename),
      top),
    headers: headers
  };
}