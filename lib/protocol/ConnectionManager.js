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

var State = require('./ConnectionManagerState');
var util = require('../util');
var debug = util.debuglog('hdb_conn');

module.exports = ConnectionManager;

function ConnectionManager(settings) {
  this.state = new State(settings);
}

ConnectionManager.prototype.updateState = function updateState(newOptions) {
  this.state.update(newOptions);
};

ConnectionManager.prototype.getConnectOptions = function getConnectOptions() {
  return this.state.options.connect;
};

ConnectionManager.prototype.openConnection = function openConnection(conn, cb) {
  var dbHosts = this.state.dbHosts;
  debug('Opening connection. Hosts:', dbHosts);

  this._openConnectionToHost(conn, dbHosts, 0, [], cb);
};

ConnectionManager.prototype._openConnectionToHost = function _openConnectionToHost(conn, dbHosts, whichHost, errorStats, cb) {
  if (whichHost === dbHosts.length) {
    return cb(couldNotOpenConnectionError(errorStats));
  }

  var self = this;
  var currentHostOptions = dbHosts[whichHost];
  var openOptions = util.extend({}, currentHostOptions, this.state.options.encryption);
  this._openConnection(conn, openOptions, function (err) {
    if (!err) {
      debug('Successful connection to %s:%d', openOptions.host, openOptions.port);
      return cb(null);
    }
    debug('Connection to %s:%d failed with:', openOptions.host, openOptions.port, err.message);
    errorStats.push({ host: openOptions.host, port: openOptions.port, err: err });
    self._openConnectionToHost(conn, dbHosts, (whichHost + 1), errorStats, cb);
  });
};

ConnectionManager.prototype._openConnection = function _openConnection(conn, openOptions, cb) {
  var dbName = this.state.options.multiDb.databaseName;
  if (util.isString(dbName) && dbName.length) {
    this._openConnectionMultiDbCase(conn, openOptions, cb);
  } else {
    conn.open(openOptions, cb);
  }
};

ConnectionManager.prototype._openConnectionMultiDbCase = function _openConnectionMultiDbCase(conn, openOptions, cb) {
  var multiDbOptions = this.state.options.multiDb;

  if (!openOptions.port) {
    var instanceNum = extractInstanceNumber(multiDbOptions.instanceNumber);
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

    conn.fetchDbConnectInfo(multiDbOptions, function (err, info) {
      if (err) {
        return handleError(err);
      }

      if (info.isConnected) {
        cb(null);
      } else {
        conn._closeSilently();
        openOptions.host = info.host;
        openOptions.port = info.port;
        debug('Connecting to tenant-db %s on %s:%d', multiDbOptions.databaseName, openOptions.host, openOptions.port);
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