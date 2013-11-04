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
var common = require('./common');
var FunctionCode = common.FunctionCode;

module.exports = Result;

function Result(connection, options) {
  options = util.extend({
    autoFetch: true
  }, options);
  this._connection = connection;
  this._autoFetch = options.autoFetch;
  this._resultSetMetadata = undefined;
  this._parameterMetadata = undefined;
}

Result.prototype.setResultSetMetadata = function setResultSetMetadata(metadata) {
  this._resultSetMetadata = metadata;
};

Result.prototype.setParameterMetadata = function setParameterMetadata(metadata) {
  this._parameterMetadata = metadata;
};

Result.prototype.handle = function handle(err, reply, cb) {

  if (err) {
    return cb(err);
  }

  var args = [null];
  var resultSets = reply.resultSets || [];
  var outputParameters = {};

  // handle missing resultSet metadata 
  if (this._resultSetMetadata && resultSets.length) {
    if (!resultSets[0].metadata) {
      resultSets[0].metadata = this._resultSetMetadata;
    }
  }
  // output parameter
  if (this._parameterMetadata && util.isObject(reply.outputParameters)) {
    outputParameters = getOutputParameters(this._parameterMetadata,
      reply.outputParameters.buffer);
  }

  function onresults(err, results) {
    if (err) {
      return cb(err);
    }
    Array.prototype.push.apply(args, results);
    cb.apply(null, args);
  }

  switch (reply.functionCode) {
  case FunctionCode.SELECT:
  case FunctionCode.SELECT_FOR_UPDATE:
    this.createResultSets(resultSets, onresults);
    return;
  case FunctionCode.INSERT:
  case FunctionCode.UPDATE:
  case FunctionCode.DELETE:
    cb(null, reply.rowsAffected);
    return;
  case FunctionCode.DDL:
    cb(null);
    return;
  case FunctionCode.DB_PROCEDURE_CALL:
  case FunctionCode.DB_PROCEDURE_CALL_WITH_RESULT:
    args.push(outputParameters);
    this.createResultSets(resultSets, onresults);
    return;
  default:
    err = new Error('Invalid or unsupported FunctionCode');
    cb(err);
    return;
  }
};

Result.prototype.createResultSets = function createResultSets(resultSets, cb) {
  if (!resultSets.length) {
    return cb(null, []);
  }

  var resultSetObjects = [];
  for (var i = 0; i < resultSets.length; i++) {
    resultSetObjects.push(new ResultSet(this._connection, resultSets[i]));
  }
  if (!this._autoFetch) {
    return cb(null, resultSetObjects);
  }
  fetchAll(resultSetObjects, cb);
};

function getOutputParameters(metadata, buffer) {
  var parser = new Parser(metadata, {
    nameProperty: 'name',
  });
  return parser.parseParameters(buffer);
}

function fetchAll(resultSets, cb) {
  var results = [];

  function done(err) {
    resultSets.filter(function isOpen(rs) {
      return !rs.closed;
    }).forEach(function close(rs) {
      rs.close(function onclose(err) {
        console.log('close', err)
      });
    });
    if (err) {
      return cb(err);
    }
    cb(null, results);
  }

  function next(i) {
    if (i === resultSets.length) {
      return done(null);
    }
    resultSets[i].fetch(function onfetch(err, rows) {
      if (err) {
        return done(err);
      }
      results.push(rows);
      process.nextTick(next.bind(null, i + 1));
    });
  }
  next(0);
}