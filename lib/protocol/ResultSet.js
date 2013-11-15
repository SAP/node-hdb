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
var common = require('./common');
var Parser = require('./Parser');
var Lob = require('./Lob');
var LobTransform = require('./LobTransform');
var ResultSetAttributes = common.ResultSetAttributes;
var TypeCode = common.TypeCode;
var debug = util.debuglog('hdb_rs');

module.exports = ResultSet;

util.inherits(ResultSet, EventEmitter);

ResultSet.MAX_FETCH_SIZE = Math.pow(2, 15) - 1;
ResultSet.DEFAULT_FETCH_SIZE = Math.pow(2, 10);
ResultSet.DEFAULT_ROW_LENGTH = Math.pow(2, 6);

function ResultSet(connection, rsd) {
  EventEmitter.call(this);
  // public
  this.descriptor = rsd;
  this.closed = false;
  this.finished = false;
  // private
  this._connection = connection;
  this._running = undefined;
  this._data = rsd.data;
  this._close = false;
  this._fetchSize = ResultSet.DEFAULT_FETCH_SIZE;
  this._rowLength = ResultSet.DEFAULT_ROW_LENGTH;
}

ResultSet.create = function createResultSet(connection, rsd) {
  return new ResultSet(connection, rsd);
};

Object.defineProperties(ResultSet.prototype, {
  id: {
    get: function getId() {
      return this.descriptor.id;
    }
  },
  metadata: {
    get: function getMetadata() {
      return this.descriptor.metadata;
    }
  },
  fetchSize: {
    get: function getFetchSize() {
      return this._fetchSize;
    }
  },
  averageRowLength: {
    get: function getAverageRowLength() {
      return this._rowLength;
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

ResultSet.prototype.setAverageRowLength = function setAverageRowLength(length) {
  this._rowLength = length;
  return this;
};

ResultSet.prototype.pause = function pause() {
  this._running = false;
};

ResultSet.prototype.resume = function resume() {
  if (this._running || this.finished) {
    return;
  }
  this._running = true;
  if (util.isObject(this._data)) {
    handleData.call(this, this._data);
    this._data = undefined;
  } else {
    sendFetch.call(this);
  }
};

ResultSet.prototype.close = function close(cb) {
  if (util.isFunction(cb)) {
    this._close = cb;
  } else {
    this._close = true;
  }
};

ResultSet.prototype.getLobColumnNames = function getLobColumnNames() {
  return this.descriptor.metadata.filter(isLob).map(getColumName);
};

ResultSet.prototype.fetch = function fetch(cb) {

  if (!util.isUndefined(this._running)) {
    var err = new Error('ResultSet invalid state error');
    return done(err);
  }

  function done(err, rows) {
    stream.removeListener('error', onerror);
    stream.removeListener('readable', onreadable);
    stream.removeListener('end', onend);
    if (util.isFunction(cb)) {
      cb(err, rows);
    }
  }

  var lobColumns = this.getLobColumnNames();
  var stream;
  if (lobColumns.length) {
    stream = util.pipe(this.createObjectStream(), this.createLobReader());
  } else {
    stream = this.createArrayStream();
  }

  var rows = [];

  function onerror(err) {
    done(err);
  }

  function onreadable() {
    /* jshint validthis:true */
    var chunk = this.read();
    if (util.isArray(chunk) && chunk.length) {
      rows = rows.concat(chunk);
    } else if (chunk) {
      rows.push(chunk);
    }
  }
  stream.on('readable', onreadable);

  function onend() {
    done(null, rows);
  }
  stream.on('end', onend);
};

ResultSet.prototype.createBinaryStream = function createBinaryStream(options) {
  if (!util.isUndefined(this._running)) {
    return null;
  }

  options = util.extend({
    highWaterMark: Math.floor(1.5 * this._fetchSize * this._rowLength)
  }, options);
  options.objectMode = false;
  return util.createReadStream(this, ['error', 'close'], options);
};

ResultSet.prototype.createParser = function createParser(options) {
  return Parser.create(this.descriptor.metadata).createTransform(options);
};

ResultSet.prototype.createLobReader = function createLobReader(options) {
  return LobTransform.create(this._connection,
    this.getLobColumnNames(), options);
};

ResultSet.prototype.createObjectStream = function createObjectStream(options) {
  options = util.extend({}, options);
  options.arrayMode = false;

  return util.pipe(this.createBinaryStream(), this.createParser(options));
};

ResultSet.prototype.createArrayStream = function createArrayStream(options) {
  if (util.isNumber(options) || options === true) {
    options = {
      arrayMode: options
    };
  } else if (util.isObject(options)) {
    options = util.extend({}, options);
  } else {
    options = {
      arrayMode: 256
    };
  }

  return util.pipe(this.createBinaryStream(), this.createParser(options));
};

ResultSet.prototype.createReadStream = function createReadStream(options) {
  options = options || {};

  if (options.objectMode === false) {
    return this.createBinaryStream(options);
  }
  if (options.arrayMode) {
    return this.createArrayStream(options);
  }
  return this.createObjectStream(options);
};

ResultSet.prototype.readLob = function readLob(ld, cb) {
  Lob.create(this._connection, ld).read(cb);
};

ResultSet.prototype.createLobStream = function createLobStream(ld, options) {
  return Lob.create(this._connection, ld).createReadStream(options);
};

function sendClose() {
  /* jshint validthis:true */
  debug('sendClose');

  function done(err) {
    this._connection = undefined;
    if (err) {
      debug('close failed: %s', err);
    } else {
      this.closed = true;
      emitClose.call(this);
      this.emit('close');
    }
    if (util.isFunction(this._close)) {
      this._close(err);
    }
  }
  this._connection.closeResultSet({
    resultSetId: this.descriptor.id
  }, done.bind(this));
}

function sendFetch() {
  /* jshint validthis:true */
  debug('sendFetch(%d)', this.fetchSize);
  this._connection.fetchNext({
    resultSetId: this.descriptor.id,
    fetchSize: this.fetchSize
  }, receiveData.bind(this));
}

function receiveData(err, reply) {
  /* jshint validthis:true */
  debug('receiveData()');
  if (err) {
    this._running = false;
    debug('emit "error": %s', err);
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
  debug('handleData(%d)', data.argumentCount);
  if (data.argumentCount && Buffer.isBuffer(data.buffer)) {
    debug('emit "data": length=%d', data.buffer.length);
    this.emit('data', data.buffer);
  }

  if (isLast(data)) {
    this.finished = true;
    this._running = false;
    this.closed = isClosed(data);
    process.nextTick(emitEnd.bind(this));
    return;
  }

  if (this._running) {
    process.nextTick(sendFetch.bind(this));
  }
}

function emitEnd() {
  /* jshint validthis:true */
  debug('emit "end"');
  this.emit('end');
  if (this.closed) {
    process.nextTick(emitClose.bind(this));
  } else if (util.isFunction(this._close)) {
    sendClose.call(this);
  }
}

function emitClose() {
  /* jshint validthis:true */
  debug('emit "close"');
  this.emit('close');
}

function isLast(data) {
  /* jshint bitwise:false */
  return !!(data.attributes & ResultSetAttributes.LAST);
}

function isClosed(data) {
  /* jshint bitwise:false */
  return !!(data.attributes & ResultSetAttributes.CLOSED);
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

function getColumName(column) {
  return column.columnDisplayName;
}