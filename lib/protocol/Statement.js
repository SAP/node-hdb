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
var EMPTY_BUFFER = common.EMPTY_BUFFER;
var IoType = common.IoType;
var FunctionCode = common.FunctionCode;

module.exports = Statement;

function Statement(connection, options) {
  // public
  this.id = undefined;
  this.functionCode = FunctionCode.NIL;
  this.parameterMetadata = undefined;
  this.resultSetMetadata = undefined;
  this.droped = false;
  // private
  this._connection = connection;
  // settings
  this._settings = options || {};
}

Statement.create = function createStatement(connection, options) {
  return new Statement(connection, options);
};

Statement.prototype._createResult = Result.create;

Statement.prototype.exec = function exec(values, options, cb) {
  /* jshint unused:false */
  return Statement.prototype._execute.apply(this, normalizeArguments(arguments, {
    autoFetch: true
  }));
};

Statement.prototype.execute = function execute(values, options, cb) {
  /* jshint unused:false */
  return Statement.prototype._execute.apply(this, normalizeArguments(arguments, {
    autoFetch: false
  }));
};

Statement.prototype.drop = function drop(cb) {
  var self = this;
  this._connection.dropStatement({
    statementId: this.id
  }, function (err) {
    self._connection = undefined;
    if (!err) {
      self.droped = true;
    }
    if (util.isFunction(cb)) {
      cb(err);
    }
  });
};

Statement.prototype.getParameterName = function getParameterName(i) {
  if (Array.isArray(this.parameterMetadata) && i < this.parameterMetadata.length) {
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
  if (Array.isArray(reply.resultSets) && reply.resultSets.length) {
    this.resultSetMetadata = reply.resultSets[0].metadata;
  }
  this.parameterMetadata = reply.parameterMetadata;
  cb(null, this);
};

Statement.prototype._normalizeInputParameters = function _normalizeInputParameters(
  values) {

  var inputParameterMetadata = this.parameterMetadata.filter(isInputParameter);
  var inputParameterCount = inputParameterMetadata.length;
  if (!inputParameterCount) {
    return EMPTY_BUFFER;
  }

  function getDataType(metadata) {
    return metadata.dataType;
  }

  function isDefined(metadata) {
    return metadata.name in values;
  }

  function getObjectValue(metadata) {
    return values[metadata.name];
  }

  var parameters = {
    types: inputParameterMetadata.map(getDataType),
    values: undefined
  };

  parameters.values = Array.isArray(values) ? values : inputParameterMetadata.filter(isDefined).map(getObjectValue);
  var vals = parameters.values.length && Array.isArray(parameters.values[0]) ? parameters.values : [parameters.values];
  var unbound = vals.some(function (e) {
    return e.length !== inputParameterCount;
  });
  return unbound ? undefined : parameters;
};

Statement.prototype._execute = function _execute(values, options, cb) {
  var settings = util.filter.call(this._settings, [
    'averageRowLength',
    'fetchSize',
    'readSize',
    'rowsAsArray',
    'nestTables',
    'columnNameProperty'
  ]);
  var inputParams = this._normalizeInputParameters(values);
  if (inputParams === undefined) {
    process.nextTick(function () {
      cb(new Error('Unbound parameters found.'));
    });
    return this;
  }

  var result = this._createResult(this._connection, util.extend(settings, options));
  result.setResultSetMetadata(this.resultSetMetadata);
  result.setParameterMetadata(this.parameterMetadata.filter(isOutputParameter));
  this._connection.execute({
    functionCode: this.functionCode,
    statementId: this.id,
    parameters: inputParams
  }, function handleReply(err, reply) {
    result.handle(err, reply, cb);
  });

  return this;
};

function normalizeArguments(args, defaults) {
  var values = args[0];
  var options = args[1];
  var cb = args[2];
  defaults = defaults || {};
  if (util.isFunction(options)) {
    cb = options;
    if (!Array.isArray(values) && (values.values || values.parameters)) {
      options = util.extend(defaults, values);
      if (options.values) {
        values = options.values;
        options.values = undefined;
      } else {
        values = options.parameters;
        options.parameters = undefined;
      }
    } else {
      options = defaults;
    }
  } else {
    options = util.extend(defaults, options);
  }
  return [values, options, cb];
}

function isInputParameter(metadata) {
  return metadata.ioType === IoType.INPUT || metadata.ioType === IoType.IN_OUT;
}

function isOutputParameter(metadata) {
  return metadata.ioType === IoType.OUTPUT || metadata.ioType === IoType.IN_OUT;
}
