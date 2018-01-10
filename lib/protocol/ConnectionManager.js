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
var debug = util.debuglog('hdb_conn');

module.exports = ConnectionManager;

function ConnectionManager(settings) {
  this._settings = settings;
}

ConnectionManager.prototype.updateConnectOptions = function updateConnectOptions(settings) {
  return util.extend(this._settings, settings);
};

ConnectionManager.prototype.openConnection = function openConnection(conn, cb) {
  var s = this._settings;
  var dbHosts = (Array.isArray(s.hosts) && s.hosts.slice()) || [{'host': s.host, 'port': s.port}]
  debug('Opening connection. Hosts:', dbHosts);

  var errorStats = [];
  var self = this;

  function _tryConnect() {
    if (dbHosts.length === 0) {
      return cb(couldNotOpenConnectionError(errorStats));
    }
    var settings = util.extend({}, self._settings, dbHosts.shift());
    self._openConnection(conn, settings, function (err) {
      if (err) {
        debug('Connection to %s:%d failed with:', settings.host, settings.port, err.message);
        errorStats.push({ host: settings.host, port: settings.port, err: err });
        _tryConnect();
      } else {
        debug('Successful connection to %s:%d', settings.host, settings.port);
        return cb(null);
      }
    });
  }

  _tryConnect();
};

ConnectionManager.prototype._openConnection = function _openConnection(conn, openOptions, cb) {
  var dbName = openOptions.databaseName;
  if (util.isString(dbName) && dbName.length) {
    this._openConnectionMultiDbCase(conn, openOptions, cb);
  } else {
    conn.open(openOptions, cb);
  }
};

ConnectionManager.prototype._openConnectionMultiDbCase = function _openConnectionMultiDbCase(conn, openOptions, cb) {
  if (!openOptions.port) {
    var instanceNum = extractInstanceNumber(openOptions.instanceNumber);
    if (isNaN(instanceNum)) {
      return cb(new Error('Instance Number is not valid'));
    } else {
      openOptions.port = 30013 + (instanceNum * 100);
    }
  }

  function handleError(err) {
    conn.close();
    cb(err);
  }

  conn.open(openOptions, function (err) {
    if (err) {
      return handleError(err);
    }

    conn.fetchDbConnectInfo({databaseName: openOptions.databaseName}, function (err, info) {
      if (err) {
        return handleError(err);
      }

      if (info.isConnected) {
        cb(null);
      } else {
        conn._closeSilently();
        openOptions.host = info.host;
        openOptions.port = info.port;
        debug('Connecting to tenant-db %s on %s:%d', openOptions.databaseName, openOptions.host, openOptions.port);
        conn.open(openOptions, cb);
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