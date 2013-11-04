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
var EventEmitter = require('events').EventEmitter;
var Readable = require('stream').Readable;
var common = require('./common');
var Parser = require('./Parser');
var Lob = require('./Lob');
var TypeCode = common.TypeCode;

module.exports = ResultSet;

util.inherits(ResultSet, EventEmitter);

ResultSet.MAX_FETCH_SIZE = Math.pow(2, 15) - 1;
ResultSet.DEFAULT_FETCH_SIZE = Math.pow(2, 10);

function ResultSet(connection, resultSet) {
  EventEmitter.call(this);

  this._connection = connection;
  this._running = undefined;
  this._data = resultSet.data;
  this._close = false;
  this._fetchSize = ResultSet.DEFAULT_FETCH_SIZE;
  this.id = resultSet.id;
  this.metadata = resultSet.metadata;
  this.lobs = this.metadata.filter(isLob);
  this.ended = false;
  this.closed = false;
}

Object.defineProperties(ResultSet.prototype, {
  fetchSize: {
    get: function getFetchSize() {
      return this._fetchSize;
    }
  }
});

ResultSet.prototype.setFetchSize = function setFetchSize(fetchSize) {
  if (fetchSize > ResultSet.MAX_FETCH_SIZE) {
    this._fetchSize = ResultSet.MAX_FETCH_SIZE;
  }
  this._fetchSize = fetchSize;
  return this;
};

ResultSet.prototype.readLob = function readLob(lob, cb) {
  new Lob(this._connection, lob).read(cb);
};


ResultSet.prototype.createReadLobStream = function createReadLobStream(lob,
  options, cb) {
  if (util.isFunction(options)) {
    cb = options;
    options = {};
  }
  return new Lob(this._connection, lob).createReadStream(options);
};

ResultSet.prototype.fetch = function fetch(cb) {
  var self = this;

  function done(err, rows) {
    /* jshint validthis:true */

    if (util.isFunction(cb)) {
      cb(err, rows, self.closed);
    }
  }

  if (typeof this._running !== 'undefined') {
    var err = new Error('ResultSet invalid state error');
    return done(err);
  }
  fetchRows(this, done);
  return this;
};

ResultSet.prototype.createReadStream = function createReadStream(options) {
  if (typeof this._running !== 'undefined') {
    return null;
  }
  return createResultSetReadStream(this, options);
};

ResultSet.prototype.stopFetch = function stopFetch() {
  this._running = false;
  return this;
};

ResultSet.prototype.startFetch = function startFetch() {
  if (!this._running && !this.ended) {
    this._running = true;
    if (util.isObject(this._data)) {
      handleData.call(this, this._data);
      this._data = undefined;
    } else {
      sendFetch.call(this);
    }
  }
  return this;
};

ResultSet.prototype.close = function close(cb) {
  if (util.isFunction(cb)) {
    this._close = cb;
  } else {
    this._close = true;
  }
  return this;
};

ResultSet.prototype.createParser = function createParser(treshhold) {
  return new Parser(this.metadata, {
    treshhold: treshhold || 0
  });
};

function createResultSetReadStream(resultSet, options) {

  var parser = resultSet.createParser();

  options = options || {};
  options.objectMode = true;
  var readable = new Readable(options);
  readable._read = function _read() {
    resultSet.startFetch();
  };

  var finished = false;
  var pending = 0;

  function cleanup() {
    if (finished) {
      return;
    }
    finished = true;
    resultSet.removeListener('error', onerror);
    resultSet.removeListener('data', ondata);
    resultSet.removeListener('end', onend);
  }

  function onerror(err) {
    cleanup();
    readable.emit('error', err);
  }
  resultSet.once('error', onerror);

  function ondata(count, chunk) {
    var rows = [];
    pending += 1;
    parser.parse(chunk, rows, function parsed(err) {
      pending -= 1;
      if (err) {
        cleanup();
        readable.emit('error', err);
        return;
      }
      if (!readable.push(rows)) {
        resultSet.stopFetch();
      }
      if (pending === 0 && finished) {
        readable.push(null);
      }
    });
  }
  resultSet.on('data', ondata);

  function onend(closed) {
    cleanup();
    if (!closed && resultSet._close) {
      sendClose.call(resultSet);
    }
    if (pending === 0) {
      readable.push(null);
    }
  }
  resultSet.once('end', onend);

  return readable;
}

function fetchRows(resultSet, cb) {

  var parser = resultSet.createParser();
  var rows = [];
  var finished = false;
  var pending = 0;

  function done(err) {
    if (util.isFunction(cb)) {
      cb(err, rows);
    }
  }

  function cleanup() {
    if (finished) {
      return;
    }
    finished = true;
    resultSet.removeListener('error', onerror);
    resultSet.removeListener('data', ondata);
    resultSet.removeListener('end', onend);
  }

  function onerror(err) {
    cleanup();
    done(err);
  }
  resultSet.on('error', onerror);

  function ondata(count, chunk) {
    pending += 1;
    parser.parse(chunk, rows, function parsed(err) {
      pending -= 1;
      if (err) {
        cleanup();
        done(err);
        return;
      }
      if (pending === 0 && finished) {
        done(null);
      }
    });
  }
  resultSet.on('data', ondata);

  function onend() {
    cleanup();
    if (pending === 0) {
      done(null);
    }
  }
  resultSet.on('end', onend);
  resultSet.startFetch();
}

function sendClose() {
  /* jshint validthis:true */

  function done(err) {
    this._connection = undefined;
    if (!err) {
      this.closed = true;
      this.emit('close');
    }
    if (util.isFunction(this._close)) {
      this._close(err);
    }
  }
  this._connection.closeResultSet({
    resultSetId: this.id
  }, done.bind(this));
}

function sendFetch() {
  /* jshint validthis:true */

  this._connection.fetchNext({
    resultSetId: this.id,
    fetchSize: this.fetchSize
  }, receiveData.bind(this));
}

function receiveData(err, reply) {
  /* jshint validthis:true */

  if (err) {
    this._running = false;
    this.emit('error', err);
    return;
  }

  var data = reply.resultSets[0].data;
  if (this._running) {
    handleData.call(this, data);
  } else {
    this._data = data;
  }
}

function handleData(data) {
  /* jshint validthis:true */

  if (data.argumentCount && Buffer.isBuffer(data.buffer)) {
    this.emit('data', data.argumentCount, data.buffer);
  }

  if (isLast(data)) {
    this.ended = true;
    this._running = false;
    this.closed = isClosed(data);
    this.emit('end', this.closed);
    if (!this.closed && this._close) {
      sendClose.call(this);
    }
    return;
  }

  if (this._running) {
    process.nextTick(sendFetch.bind(this));
  }
}

function isLast(data) {
  /* jshint bitwise:false */
  return !!(data.attributes & common.ResultSetAttributes.LAST);
}

function isClosed(data) {
  /* jshint bitwise:false */
  return !!(data.attributes & common.ResultSetAttributes.CLOSED);
}

function isLob(column) {
  switch (column.dataType) {
  case TypeCode.BLOB:
  case TypeCode.LOCATOR:
  case TypeCode.CLOB:
  case TypeCode.NCLOB:
  case TypeCode.NLOCATOR:
  case TypeCode.TEXT:
    return true;
  default:
    return false;
  }
}