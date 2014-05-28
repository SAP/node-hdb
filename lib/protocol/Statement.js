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
var Result = require('./Result');
var common = require('./common');
var IoType = common.IoType;
var FunctionCode = common.FunctionCode;

module.exports = Statement;

function Statement(connection) {
  // public
  this.id = undefined;
  this.functionCode = FunctionCode.NIL;
  this.parameterMetadata = undefined;
  this.resultSetMetadata = undefined;
  this.droped = false;
  // private
  this._connection = connection;
}

Statement.prototype.exec = function exec(values, options, cb) {
  var defaults = {
    autoFetch: true
  };
  executeStatement.call(this, defaults, values, options, cb);
  return this;
};

Statement.prototype.execute = function execute(values, options, cb) {
  var defaults = {
    autoFetch: false
  };
  executeStatement.call(this, defaults, values, options, cb);
  return this;
};

Statement.prototype.drop = function drop(cb) {

  function done(err) {
    /* jshint validthis:true */
    this._connection = undefined;
    if (!err) {
      this.droped = true;
    }
    if (util.isFunction(cb)) {
      cb(err);
    }
  }
  this._connection.dropStatement({
    statementId: this.id
  }, done.bind(this));
};

Statement.prototype.getParameterName = function getParameterName(i) {
  if (util.isArray(this.parameterMetadata) && i < this.parameterMetadata.length) {
    return this.parameterMetadata[i].name;
  }
};

Statement.prototype.handle = function handle(err, reply, cb) {
  if (err) {
    this._connection = undefined;
    return cb(err);
  }

  this.id = reply.statementId;
  this.functionCode = reply.functionCode;
  if (util.isArray(reply.resultSets) && reply.resultSets.length) {
    this.resultSetMetadata = reply.resultSets[0].metadata;
  }
  this.parameterMetadata = reply.parameterMetadata;
  cb(null, this);
};

function normalizeParameters(values) {
  /* jshint validthis:true */
  var inputParameterMetadata = this.parameterMetadata.filter(isInputParameter);
  var length = inputParameterMetadata.length;
  if (!length) {
    return null;
  }
  if (!values.length) {
    throw new Error('Invalid input parameter values');
  }

  function getDataType(metadata) {
    return metadata.dataType;
  }

  function getObjectValue(metadata) {
    if (!util.isUndefined(values[metadata.name])) {
      return values[metadata.name];
    }
    return null;
  }

  var parameters = {
    types: inputParameterMetadata.map(getDataType),
    values: undefined
  };
  if (util.isArray(values)) {
    parameters.values = values;
    return parameters;
  }
  parameters.values = inputParameterMetadata.map(getObjectValue);
  return parameters;
}

function executeStatement(defaults, values, options, cb) {
  /* jshint validthis:true */
  if (util.isFunction(options)) {
    cb = options;
    options = defaults;
  } else if (util.isObject(options)) {
    options = util.extend(defaults, options);
  } else {
    var autoFetch = !!options;
    options = defaults;
    options.autoFetch = autoFetch;
  }

  var result = new Result(this._connection, options);
  result.setResultSetMetadata(this.resultSetMetadata);
  result.setParameterMetadata(this.parameterMetadata.filter(isOutputParameter));
  this._connection.execute({
    functionCode: this.functionCode,
    statementId: this.id,
    parameters: normalizeParameters.call(this, values)
  }, function onreply(err, reply) {
    result.handle(err, reply, cb);
  });
}

function isInputParameter(metadata) {
  return metadata.ioType === IoType.INPUT || metadata.ioType === IoType.IN_OUT;
}

function isOutputParameter(metadata) {
  return metadata.ioType === IoType.OUTPUT || metadata.ioType === IoType.IN_OUT;
}