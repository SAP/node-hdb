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

var pooledHandler = pool.pooled(function (client, req, res, cb) {
  if (req.url === '/') {
    var sql = 'select schema_name, table_name from tables' +
      ' where is_user_defined_type = \'FALSE\'' +
      ' order by schema_name, table_name';
    client.exec(sql, renderIndex);
  } else {
    createRequestParams(req);
    console.log(req.params.sql);
    client.execute(req.params.sql, streamResult);
  }

  function renderIndex(err, rows) {
    if (err) {
      return cb(err);
    }
    var html = renderHtml(rows);
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Length': Buffer.byteLength(html)
    });
    res.end(html);
    cb();
  }

  function done(err) {
    if (err) {
      res.destroy(err);
    }
    cb();
  }

  function streamResult(err, rs) {
    if (err) {
      return cb(err);
    }
    res.writeHead(200, getResponseHeaders(req.params));
    rs.setFetchSize(2048)
      .createArrayStream()
      .once('error', done)
      .pipe(createStringifier())
      .pipe(res)
      .on('finish', done);
  }
});

http.createServer(function (req, res) {
  if (req.url === '/favicon.ico') {
    return error(res, new Error('Not found'), 404);
  }
  pooledHandler(req, res, function (err) {
    if (err) {
      return error(res, err);
    }
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

function error(res, err, statusCode) {
  var json = JSON.stringify(err);
  res.writeHead(statusCode || 400, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json)
  });
  res.end(json);
}

function createRequestParams(req) {
  var reqUrl = url.parse(req.url, true);
  var query = reqUrl.query || {};
  var path = reqUrl.pathname.split('/');
  path.shift();
  if (!path[path.length - 1]) {
    path.pop();
  }
  var params = req.params = {};
  params.top = parseInt(query.top, 10) || 10000;
  params.skip = parseInt(query.skip, 10) || 0;
  var segments = path.map(decodeURIComponent);
  params.tablename = segments.join('.');
  var tablename = '"' + segments.shift().replace(/"/g, '""') + '"';
  if (segments.length) {
    tablename += '."' + segments.join('.').replace(/"/g, '""') + '"';
  }
  params.sql = util.format('select * from %s limit %d offset ', tablename,
    params.top, params.skip);
}

function getResponseHeaders(params) {
  var headers = {
    'Content-Type': 'application/json'
  };
  if (params.top > 10000) {
    headers['Content-Disposition'] =
      'attachment; filename=' +
      params.tablename.toLowerCase() + '.json;';
  }
  return headers;
}

function renderHtml(rows) {
  function renderRow(row) {
    var href = '/' + encodeURIComponent(row.SCHEMA_NAME) + '/' +
      encodeURIComponent(row.TABLE_NAME) + '?top=100&skip=0';
    var fragment = '<p><a href="' + href + '" >' + row.TABLE_NAME +
      '</a></p>';
    if (schema !== row.SCHEMA_NAME) {
      schema = row.SCHEMA_NAME;
      return '<h1>' + schema + '</h1>\n' + fragment;
    }
    return fragment;
  }

  var schema = '';
  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<style>',
    'html {font-family: sans-serif; font-size: 12px;}',
    'body {margin: 10px;}',
    'h1   {font-size: 16px;}',
    'p    {margin: 5px 0;}',
    '</style>',
    '</head>',
    '<body>',
    rows.map(renderRow).join('\n'),
    '</body>',
    '</html>'
  ].join('\n');
}