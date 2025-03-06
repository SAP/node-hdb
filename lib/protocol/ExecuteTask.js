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

var request = require('./request');
var Writer = require('./Writer');
var common = require('./common');
var FunctionCode = common.FunctionCode;

var STATEMENT_ID_PART_LENGTH = 24;

module.exports = ExecuteTask;

function ExecuteTask(connection, options, callback) {
  this.connection = connection;
  this.autoCommit = options.autoCommit;
  this.needFinializeTransaction = false;
  this.holdCursorsOverCommit = options.holdCursorsOverCommit;
  this.scrollableCursor = options.scrollableCursor;
  this.statementId = options.statementId;
  this.functionCode = options.functionCode;
  this.writer = new Writer(options.parameters.types, connection.useCesu8, connection.spatialTypes);
  var values = options.parameters.values;
  if (values.length && Array.isArray(values[0])) {
    this.parameterValues = values.slice();
  } else {
    this.parameterValues = [values];
  }
  this.callback = callback;
  this.reply = undefined;
  this.finishedError = null;
  this.finishedParameters = undefined;
  this.isExecuteParams = true;
}

ExecuteTask.create = function createExecuteTask(connection, options, cb) {
  return new ExecuteTask(connection, options, cb);
};

ExecuteTask.prototype.run = function run(next) {
  var self = this;

  function done(err) {
    self.end(err);
    next();
  }

  function finalize(err) {
    if (!self.needFinializeTransaction) {
      return done(err);
    }
    if (err) {
      return self.sendRollback(function () {
        // ignore rollback error
        done(err);
      });
    }
    self.sendCommit(done);
  }

  function getExecuteRequest() {
    if (!self.parameterValues.length && !self.writer.hasParameters) {
      return finalize();
    }
    self.finishedParameters = undefined;
    var availableSize = self.connection.getAvailableSize(false) - STATEMENT_ID_PART_LENGTH;
    var availableSizeForLOBs = self.connection.getAvailableSize(true) - STATEMENT_ID_PART_LENGTH;
    
    // Block the queue to this task and read lob requests
    self.connection.blockQueue(self);

    self.getParameters(availableSize, availableSizeForLOBs, function send(err, parameters) {
      // Enqueue itself to wait for when the task becomes the one actively running in the queue
      // and the connection is avaliable to send the packet
      self.finishedError = err;
      self.finishedParameters = parameters;
      self.isExecuteParams = true;
      self.connection.enqueue(self);
    });

    // Yield to only read lob tasks in the queue, the callback will enqueue this task 
    // again once the parameters are ready
    next();
  }

  function getWriteLobRequest() {
    if (self.writer.finished || self.writer.hasParameters) {
      return getExecuteRequest();
    }
    self.finishedParameters = undefined;
    var availableSize = self.connection.getAvailableSize(true);
    self.connection.blockQueue(self);
    self.writer.getWriteLobRequest(availableSize, function (err, buffer) {
      self.finishedError = err;
      self.finishedParameters = buffer;
      self.isExecuteParams = false;
      self.connection.enqueue(self);
    });

    next();
  }

  if (this.finishedError) {
    finalize(this.finishedError);
  } else if (this.finishedParameters) {
    if (this.isExecuteParams) {
      self.sendExecute(this.finishedParameters, finalize, getWriteLobRequest);
    } else {
      self.sendWriteLobRequest(this.finishedParameters, finalize, getWriteLobRequest);
    }
  } else { // No stored error or parameters, so get initial execute data
    // validate function code
    if (self.parameterValues.length > 1) {
      switch (self.functionCode) {
        case FunctionCode.DDL:
        case FunctionCode.INSERT:
        case FunctionCode.UPDATE:
        case FunctionCode.DELETE:
          break;
        default:
          return done(createInvalidFunctionCodeError());
      }
    }

    getExecuteRequest();
  }
};

ExecuteTask.prototype.end = function end(err) {
  this.callback(err, this.reply);
};

ExecuteTask.prototype.pushReply = function pushReply(reply) {
  if (!this.reply) {
    this.reply = reply;
    return;
  }

  this.reply.outputParameters = this.reply.outputParameters || reply.outputParameters;
  if (reply.rowsAffected) {
    if (this.reply.rowsAffected) {
      this.reply.rowsAffected = [].concat(
        this.reply.rowsAffected, reply.rowsAffected);
    } else {
      this.reply.rowsAffected = reply.rowsAffected;
    }
  }
  if (reply.resultSets && reply.resultSets.length) {
    // old results sets should not be present as there is no bulk select or procedure execute
    // still we keep them to be safe
    this.reply.resultSets = [].concat(this.reply.resultSets || [], reply.resultSets);
  }
};

ExecuteTask.prototype.getParameters = function getParameters(availableSize, availableSizeForLOBs, cb) {
  var self = this;
  var bytesWritten = 0;
  var row = 0;
  var args = [];

  function handleParameters(err, buffer) {
    if (err) {
      return cb(err);
    }
    bytesWritten += buffer.length;
    args.push(buffer);
    if (!self.writer.finished) {
      if (self.autoCommit) {
        self.needFinializeTransaction = true;
        self.autoCommit = false;
      }
      return cb(null, args);
    }
    next();
  }

  function next() {
    if (!self.writer.hasParameters) {
      if (!self.parameterValues.length) {
        return cb(null, args);
      }
      try {
        ++row;
        self.writer.setValues(self.parameterValues.shift());
      } catch (err) {
        return cb(new Error('Cannot set parameter at row: ' + row + '. ' + err.message));
      }
    }
    var remainingSize = availableSize - bytesWritten;
    var remainingSizeForLOBs = availableSizeForLOBs - bytesWritten;
    if (self.writer.length > remainingSize) {
      if (self.autoCommit) {
        self.needFinializeTransaction = true;
        self.autoCommit = false;
      }
      if(args.length === 0) {
        self.needFinializeTransaction = false;
        return cb(new Error('Failed to set parameters, maximum packet size exceeded.'));
      } else {
        return cb(null, args);
      }
    }
    self.writer.getParameters(remainingSizeForLOBs, handleParameters);
  }

  next();
};

ExecuteTask.prototype.sendExecute = function sendExecute(parameters, finalize, cb) {
  var self = this;
  self.connection.send(request.execute({
    autoCommit: self.autoCommit,
    holdCursorsOverCommit: self.holdCursorsOverCommit,
    scrollableCursor: self.scrollableCursor,
    statementId: self.statementId,
    parameters: parameters,
    useCesu8: self.connection.useCesu8
  }), function (err, reply) {
    if (err) {
      return finalize(err);
    }
    if (!self.writer.finished && reply.rowsAffected == -1) {
        reply.rowsAffected = undefined;
    }
    self.pushReply(reply);
    if (!self.writer.finished && reply.writeLobReply) {
      self.writer.update(reply.writeLobReply);
    }
    cb();
  });
}

ExecuteTask.prototype.sendWriteLobRequest = function sendWriteLobRequest(buffer, finalize, cb) {
  var self = this;
  self.connection.send(request.writeLob({
    writeLobRequest: buffer
  }), function (err, reply) {
    if (err) {
      return finalize(err);
    }
    self.pushReply(reply);
    cb();
  });
};

ExecuteTask.prototype.sendCommit = function sendCommit(cb) {
  var self = this;
  self.connection.send(request.commit({
    holdCursorsOverCommit: self.holdCursorsOverCommit
  }), cb);
};

ExecuteTask.prototype.sendRollback = function sendRollback(cb) {
  var self = this;
  self.connection.send(request.rollback({
    holdCursorsOverCommit: self.holdCursorsOverCommit
  }), cb);
};

function createInvalidFunctionCodeError() {
  return new Error(
    'Invalid functionCode in batch execute. ' +
    'Only DDL or DML statements are supported.'
  );
}
