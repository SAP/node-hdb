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

var util = require('../util');
var common = require('./common');
var debug = util.debuglog('hdb_conn');

module.exports = ConnectionManager;

function ConnectionManager(options) {
  this._options = options;
}

ConnectionManager.prototype.openConnection = function openConnection(conn, cb) {
  var opts = this._options;
  var dbHosts = (Array.isArray(opts.hosts) && opts.hosts.slice()) || [{ host: opts.host, port: opts.port }];
  debug('Opening connection. Hosts:', dbHosts);

  var errorStats = [];
  var self = this;

  function tryConnect() {
    if (dbHosts.length === 0) {
      return cb(couldNotOpenConnectionError(errorStats));
    }
    var options = util.extend({}, self._options, dbHosts.shift());
    self._openConnection(conn, options, function (err) {
      if (err) {
        debug('Connection to %s:%d failed with:', options.host, options.port, err.message);
        errorStats.push({ host: options.host, port: options.port, err: err });
        tryConnect();
      } else {
        debug('Successful connection to %s:%d', options.host, options.port);
        return cb(null);
      }
    });
  }

  tryConnect();
};

ConnectionManager.prototype._openConnection = function _openConnection(conn, options, cb) {
  var dbName = options.databaseName;
  if (util.isString(dbName) && dbName.length) {
    this._openConnectionMultiDbCase(conn, options, cb);
  } else {
    conn.open(options, cb);
  }
};

ConnectionManager.prototype._openConnectionMultiDbCase = function _openConnectionMultiDbCase(conn, options, cb) {
  if (!options.port) {
    var instanceNum = extractInstanceNumber(options.instanceNumber);
    if (isNaN(instanceNum)) {
      return cb(new Error('Instance Number is not valid'));
    } else {
      options.port = 30013 + (instanceNum * 100);
    }
  }

  function handleError(err) {
    conn.close();
    cb(err);
  }

  conn.open(options, function (err) {
    if (err) {
      return handleError(err);
    }

    conn.fetchDbConnectInfo({databaseName: options.databaseName}, function (err, info) {
      if (err) {
        return handleError(err);
      }

      if (info.isConnected) {
        cb(null);
      } else {
        var initialHost = conn.host;
        var initialPort = conn.port;
        conn._closeSilently();
        options.host = info.host;
        options.port = info.port;
        conn.setInitialHostAndPort(initialHost, initialPort);
        conn.setRedirectHostAndPort(options.host, options.port);
        conn.setRedirectType(common.RedirectType.REDIRECTION_DBNAMEBASED);
        debug('Connecting to tenant-db %s on %s:%d', options.databaseName, options.host, options.port);
        conn.open(options, cb);
      }
    });
  });
};

function extractInstanceNumber(instanceNumber) {
  if (util.isNumber(instanceNumber)) {
    return instanceNumber;
  }
  if (util.isString(instanceNumber) && instanceNumber.length) {
    return parseInt(instanceNumber, 10);
  }
  return NaN;
}

function couldNotOpenConnectionError(errorStats) {
  var message = 'Could not connect to any host:';
  errorStats.forEach(function (stats) {
    message += util.format(' [ %s:%d - %s ]', stats.host, stats.port, stats.err.message);
  });
  var err = new Error(message);
  err.code = 'EHDBOPENCONN';
  return err;
}
