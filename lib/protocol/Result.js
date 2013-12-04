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
var ResultSet = require('./ResultSet');
var Parser = require('./Parser');
var Lob = require('./Lob');
var common = require('./common');
var TypeCode = common.TypeCode;

var FunctionCode = common.FunctionCode;

module.exports = Result;

function Result(connection, options) {
  options = options || {};
  this._connection = connection;
  this._resultSetMode = options.resultSetMode || options.autoFetch === false;
  this._readSize = options.readSize || Lob.DEFAULT_READ_SIZE;
  this._resultSetMetadata = undefined;
  this._parameterMetadata = undefined;
}

Result.prototype.setResultSetMetadata = function setResultSetMetadata(
  metadata) {
  this._resultSetMetadata = metadata;
};

Result.prototype.setParameterMetadata = function setParameterMetadata(
  metadata) {
  this._parameterMetadata = metadata;
};

Result.prototype.getLobColumnNames = function getLobColumnNames() {
  if (this._parameterMetadata) {
    return this._parameterMetadata.filter(isLob).map(getColumName);
  }
  return [];
};

Result.prototype.handle = function handle(err, reply, cb) {
  if (err) {
    return cb(err);
  }

  switch (reply.functionCode) {
  case FunctionCode.SELECT:
  case FunctionCode.SELECT_FOR_UPDATE:
    this.handleQuery(cb, this.createResultSets(reply.resultSets));
    return;
  case FunctionCode.INSERT:
  case FunctionCode.UPDATE:
    this.handleModify(cb, reply.rowsAffected, reply.writeLobReply);
    return;
  case FunctionCode.DELETE:
    this.handleDelete(cb, reply.rowsAffected);
    return;
  case FunctionCode.DDL:
    cb(null);
    return;
  case FunctionCode.DB_PROCEDURE_CALL:
  case FunctionCode.DB_PROCEDURE_CALL_WITH_RESULT:
    this.handleDBCall(cb,
      this.createOutputParameters(reply.outputParameters),
      this.createResultSets(reply.resultSets));
    return;
  default:
    err = new Error('Invalid or unsupported FunctionCode');
    cb(err);
  }
};

Result.prototype.handleModify = function handleModify(cb, rowsAffected,
  writeLobReply) {
  cb(null, rowsAffected, writeLobReply);
};

Result.prototype.handleDelete = function handleDelete(cb, rowsAffected) {
  cb(null, rowsAffected);
};

Result.prototype.handleQuery = function handleQuery(cb, resultSets) {
  function done(err, results) {
    if (err) {
      return cb(err);
    }
    var args = [null];
    Array.prototype.push.apply(args, results);
    return cb.apply(null, args);
  }

  if (this._resultSetMode) {
    return done(null, resultSets);
  }
  fetchAll(resultSets, done);
};

Result.prototype.handleDBCall = function handleDBCall(cb, params, resultSets) {
  params = params || {};

  function done(err, results) {
    if (err) {
      return cb(err);
    }
    var args = [null, params];
    Array.prototype.push.apply(args, results);
    return cb.apply(null, args);
  }

  if (this._resultSetMode) {
    return done(null, resultSets);
  }

  function fetchResults(err) {
    if (err) {
      return done(err);
    }
    fetchAll(resultSets, done);
  }

  readLobs(this.getLobColumnNames(), params, fetchResults);
};

Result.prototype.createLob = function createLob(ld, options) {
  options = util.extend({
    readSize: this._readSize
  }, options);
  return new Lob(sendReadLob.bind(this), ld, options);
};

function sendReadLob(req, cb) {
  /* jshint validthis:true */
  this._connection.readLob(req, cb);
}

function createResultSets(resultSets) {
  /* jshint validthis:true */
  resultSets = resultSets || [];
  // handle missing resultSet metadata 
  if (this._resultSetMetadata && resultSets.length) {
    if (!resultSets[0].metadata) {
      resultSets[0].metadata = this._resultSetMetadata;
    }
  }
  return resultSets.map(createResultSet, this._connection);
}
Result.prototype.createResultSets = createResultSets;

function createOutputParameters(outputParameters) {
  /* jshint validthis:true */
  if (this._parameterMetadata && util.isObject(outputParameters)) {
    var parser = Parser.create(this._parameterMetadata, this);
    return parser.parseParams(outputParameters.buffer);
  }
  return null;
}
Result.prototype.createOutputParameters = createOutputParameters;

function createResultSet(rsd) {
  /* jshint validthis:true */
  return new ResultSet(this, rsd);
}

function fetchAll(resultSets, cb) {
  var results = [];

  function isOpen(rs) {
    return !rs.closed;
  }

  function handleClose(err) {
    if (err) {
      // ignore errors
    }
  }

  function close(rs) {
    rs.close(handleClose);
  }

  function done(err) {
    resultSets.filter(isOpen).forEach(close);
    if (err) {
      return cb(err);
    }
    cb(null, results);
  }

  function next(i) {
    if (i === resultSets.length) {
      return done(null);
    }

    function handleFetch(err, rows) {
      if (err) {
        return done(err);
      }
      results.push(rows);
      process.nextTick(next.bind(null, i + 1));
    }
    resultSets[i].fetch(handleFetch);
  }
  next(0);
}

function readLobs(keys, params, cb) {

  function next(i) {
    if (i === keys.length) {
      return cb(null);
    }

    var name = keys[i];

    function handleRead(err, buffer) {
      if (err) {
        return cb(err);
      }
      params[name] = buffer;
      process.nextTick(next.bind(null, i + 1));
    }
    params[name].read(handleRead);
  }
  next(0);
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
  return column.name;
}