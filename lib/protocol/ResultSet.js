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
var ResultSetAttributes = common.ResultSetAttributes;
var TypeCode = common.TypeCode;
var debug = util.debuglog('hdb_rs');

module.exports = ResultSet;

util.inherits(ResultSet, EventEmitter);

ResultSet.MAX_FETCH_SIZE = Math.pow(2, 15) - 1;
ResultSet.DEFAULT_FETCH_SIZE = Math.pow(2, 10);
ResultSet.DEFAULT_ROW_LENGTH = Math.pow(2, 6);
ResultSet.DEFAULT_ARRAY_LENGTH = Math.pow(2, 8);

function ResultSet(connection, rsd) {
  EventEmitter.call(this);
  // public
  this.id = rsd.id;
  this.metadata = rsd.metadata;
  this.closed = false;
  this.finished = false;
  // private
  this._connection = connection;
  this._running = undefined;
  this._data = rsd.data;
  this._close = false;
  this._fetchSize = ResultSet.DEFAULT_FETCH_SIZE;
  this._rowLength = ResultSet.DEFAULT_ROW_LENGTH;
  this._readSize = Lob.DEFAULT_READ_SIZE;
}

ResultSet.create = function createResultSet(connection, rsd) {
  return new ResultSet(connection, rsd);
};

Object.defineProperties(ResultSet.prototype, {
  fetchSize: {
    get: function getFetchSize() {
      return this._fetchSize;
    }
  },
  averageRowLength: {
    get: function getAverageRowLength() {
      return this._rowLength;
    }
  },
  readSize: {
    get: function getReadSize() {
      return this._readSize;
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

ResultSet.prototype.setReadSize = function setReadSize(readSize) {
  if (readSize > Lob.MAX_READ_SIZE) {
    this._readSize = Lob.MAX_READ_SIZE;
  }
  this._readSize = readSize;
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
  return this.metadata.filter(isLob).map(getColumName);
};

ResultSet.prototype.fetch = function fetch(cb) {
  var stream = this.createArrayStream();
  var collector = new util.stream.Writable({
    objectMode: true,
    highWaterMark: 16
  });
  collector.rows = [];
  collector.columns = this.getLobColumnNames();
  if (collector.columns.length) {
    collector._write = collectLobRows;
  } else {
    collector._write = collectRows;
  }

  function done(err, rows) {
    stream.removeListener('error', onerror);
    collector.removeListener('finish', onfinish);
    cb(err, rows);
  }

  function onerror(err) {
    done(err);
  }

  function onfinish() {
    /* jshint validthis:true */
    done(null, this.rows);
  }
  stream.on('error', onerror).pipe(collector).on('finish', onfinish);
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
  return Parser.create(this.metadata).createTransform(this, options);
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
      arrayMode: ResultSet.DEFAULT_ARRAY_LENGTH
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

ResultSet.prototype.createLob = function createLob(ld, options) {
  options = util.extend({
    readSize: this._readSize
  }, options);
  return new Lob(sendReadLob.bind(this), ld, options);
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
    resultSetId: this.id
  }, done.bind(this));
}

function sendFetch() {
  /* jshint validthis:true */
  debug('sendFetch(%d)', this.fetchSize);
  this._connection.fetchNext({
    resultSetId: this.id,
    fetchSize: this.fetchSize
  }, receiveData.bind(this));
}

function sendReadLob(req, cb) {
  /* jshint validthis:true */
  this._connection.readLob(req, cb);
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

function collectRows(rows, encoding, done) {
  /* jshint validthis:true */
  for (var i = 0; i < rows.length; i++) {
    this.rows.push(rows[i]);
  }
  done();
}

function collectLobRows(rows, encoding, done) {
  /* jshint validthis:true */
  var self = this;
  var i = 0;

  function handleRow(err) {
    if (err) {
      return done(err);
    }
    // next row
    i += 1;
    next();
  }

  function next() {
    if (i === rows.length) {
      return done(null, rows);
    }
    util.setImmediate(collectLobRow.bind(self, rows[i], handleRow));
  }
  next();
}

function collectLobRow(row, done) {
  /* jshint validthis:true */
  var self = this;
  var i = 0;

  function receiveLob(err, buffer) {
    if (err) {
      return done(err);
    }
    // update lob
    row[self.columns[i]] = buffer;
    // next lob
    i += 1;
    next();
  }

  function next() {
    if (i === self.columns.length) {
      self.rows.push(row);
      return done(null);
    }
    var lob = row[self.columns[i]];
    if (lob === null || Buffer.isBuffer(lob)) {
      return receiveLob(null, lob);
    }
    lob.read(receiveLob);
  }
  next();
}