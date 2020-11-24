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
/* jshint expr:true */

var lib = require('../lib');
var ExecuteTask = lib.ExecuteTask;
var FunctionCode = lib.common.FunctionCode;
var TypeCode = lib.common.TypeCode;
var MessageType = lib.common.MessageType;
var util = lib.util;
var setImmediate = util.setImmediate;
var STATEMENT_ID = new Buffer([1, 0, 0, 0, 0, 0, 0, 0]);

describe('Lib', function () {

  describe('#ExecuteTask', function () {

    it('should create a single task', function () {
      var values = [
        [1]
      ];
      var task = createExecuteTask({
        parameters: {
          types: [TypeCode.INT],
          values: values[0]
        },
        replies: {}
      });
      task.parameterValues.should.eql(values);
    });

    it('should create batch task', function () {
      var values = [
        [1],
        [2]
      ];
      var task = createExecuteTask({
        parameters: {
          types: [TypeCode.INT],
          values: values
        },
        replies: []
      });
      task.parameterValues.should.not.equal(values);
      task.parameterValues.should.eql(values);
    });

    it('should create task having Writer configured with useCesu8', function () {
      var task = createExecuteTask({ parameters: { types: [], values: [] } });
      task.writer._useCesu8.should.be.true;
    });

    it('should run a task with invalid functionCode', function (next) {
      createExecuteTask({
        functionCode: FunctionCode.NIL,
        parameters: {
          types: [TypeCode.INT],
          values: [
            [1],
            [2]
          ]
        }
      }, function done(err) {
        err.should.be.an.instanceOf(Error);
      }).run(next);
    });

    it('should raise an error correctly', function (next) {
      var task = createExecuteTask({
        parameters: {
          types: [TypeCode.INT],
          values: [
            [1],
            [2],
            [3]
          ]
        },
        replies: [{
          type: MessageType.EXECUTE,
          args: [null, {
            rowsAffected: [1, 1, 1]
          }]
        }]
      }, function done(err) {
        err.should.be.an.instanceOf(Error);
      },
      false);
      task.writer._types = undefined;
      task.run(next);
    });

    it('should run a batch task with INT type', function (next) {
      createExecuteTask({
        parameters: {
          types: [TypeCode.INT],
          values: [
            [1],
            [2],
            [3]
          ]
        },
        replies: [{
          type: MessageType.EXECUTE,
          args: [null, {
            rowsAffected: [1, 1, 1]
          }]
        }]
      }, function done(err, reply) {
        (!err).should.be.ok;
        reply.rowsAffected.should.eql([1, 1, 1]);
      }).run(next);
    });

    it('should run a large batch task', function (next) {
      var values = [];
      var rowsAffected = [];
      for (var i = 1; i <= 10000; i++) {
        values.push([i]);
        rowsAffected.push(1);
      }
      createExecuteTask({
        parameters: {
          types: [TypeCode.INT],
          values: values
        },
        availableSize: Math.pow(2, 16),
        replies: [{
          type: MessageType.EXECUTE,
          args: [null, {
            rowsAffected: rowsAffected
          }]
        }]
      }, function done(err, reply) {
        (!err).should.be.ok;
        reply.rowsAffected.should.eql(rowsAffected);
      }).run(next);
    });

    it(
      'should run a batch task with STRING type exceeding remainingSize',
      function (next) {
        createExecuteTask({
          parameters: {
            types: [TypeCode.STRING],
            values: [
              ['Lorem ipsum dolor'],
              ['consectetuer adipiscing elit'],
              ['Aenean commodo ligula']
            ]
          },
          replies: [{
            type: MessageType.EXECUTE,
            args: [null, {
              rowsAffected: [1, 1]
            }]
          }, {
            type: MessageType.EXECUTE,
            args: [null, {
              rowsAffected: [1]
            }]
          }, {
            type: MessageType.COMMIT,
            args: [null]
          }]
        }, function done(err, reply) {
          (!err).should.be.ok;
          reply.rowsAffected.should.eql([1, 1, 1]);
        }).run(next);
      });

    it('should run a single failing task with INT type', function (next) {
      createExecuteTask({
        replies: [{
          type: MessageType.EXECUTE,
          args: [new Error('error')]
        }]
      }, function done(err) {
        err.should.be.an.instanceOf(Error);
      }).run(next);
    });

    it('should run a single task with BLOB type', function (next) {
      var buffer = new Buffer(64);
      var locatorId = new Buffer([1, 0, 0, 0, 0, 0, 0, 0]);
      createExecuteTask({
        parameters: {
          types: [TypeCode.BLOB],
          values: [buffer]
        },
        replies: [{
          type: MessageType.EXECUTE,
          args: [null, {
            writeLobReply: [locatorId]
          }]
        }, {
          type: MessageType.WRITE_LOB,
          args: [null, {}]
        }, {
          type: MessageType.COMMIT,
          args: [null, {}]
        }]
      }, function done(err, reply) {
        (!err).should.be.ok;
        reply.writeLobReply[0].should.eql(locatorId);
      }).run(next);
    });

    it('should run a single failing task with BLOB type ', function (next) {
      var buffer = new Buffer(64);
      var locatorId = new Buffer([1, 0, 0, 0, 0, 0, 0, 0]);
      createExecuteTask({
        parameters: {
          types: [TypeCode.BLOB],
          values: [buffer]
        },
        replies: [{
          type: MessageType.EXECUTE,
          args: [null, {
            writeLobReply: [locatorId]
          }]
        }, {
          type: MessageType.WRITE_LOB,
          args: [new Error('error')]
        }, {
          type: MessageType.ROLLBACK,
          args: [null]
        }]
      }, function done(err) {
        err.should.be.an.instanceOf(Error);
      }).run(next);
    });

    it('should accumulate rows affected', function () {
      var task = createExecuteTask();
      task.pushReply({});
      task.pushReply({
        rowsAffected: [1]
      });
      task.reply.rowsAffected.should.eql([1]);
      task.pushReply({
        rowsAffected: [1, 1]
      });
      task.reply.rowsAffected.should.eql([1, 1, 1]);
    });

    it('should accumulate result sets', function () {
      var task = createExecuteTask();
      task.pushReply({});
      task.pushReply({
        resultSets: [{}]
      });
      task.reply.resultSets.should.have.length(1);
      task.pushReply({
        resultSets: [{}, {}]
      });
      task.reply.resultSets.should.have.length(3);
    });

    it('should be able to handle outputParameters from subsequent replies', function () {
      var task = createExecuteTask();
      task.pushReply({});
      task.pushReply({
        outputParameters: 5
      });
      task.reply.outputParameters.should.eql(5);
    });

    it('should getParameters with invalid values error', function (done) {
      var task = createExecuteTask();
      var invalidValuesError = new Error('invalid values error');
      task.writer.setValues = function () {
        throw invalidValuesError;
      };
      task.getParameters(64, function (err) {
        err.message.should.equal('Cannot set parameter at row: 1. ' + invalidValuesError.message);
        done();
      });
    });

    it('should getParameters with read stream error', function (done) {
      var buffer = new Buffer(64);
      var task = createExecuteTask({
        parameters: {
          types: [TypeCode.BLOB],
          values: [buffer]
        }
      });
      var streamError = new Error('read stream error');
      task.writer.getParameters = function (remainingSize, cb) {
        cb(streamError);
      };
      task.getParameters(64, function (err) {
        err.should.equal(streamError);
        done();
      });
    });

    it('should sendExecute with error', function (done) {
      var task = createExecuteTask();
      var error = new Error('error');
      task.getParameters = function (availableSize, cb) {
        availableSize.should.equal(40);
        cb(error);
      };
      task.sendExecute(function (err) {
        err.should.equal(error);
        done();
      });
    });

    it('should sendWriteLobRequest with error', function (done) {
      var task = createExecuteTask();
      var error = new Error('error');
      task.writer.getWriteLobRequest = function (availableSize, cb) {
        availableSize.should.equal(64);
        cb(error);
      };
      task.sendWriteLobRequest(function (err) {
        err.should.equal(error);
        done();
      });
    });

    it('should provide cesu-8 configuration in execute', function(done) {
      var task = createExecuteTask();
      task.connection.send = function (statement) {
        statement.useCesu8.should.eql(true);
        done();
      };
      task.sendExecute(function(err) {
        if (err) { throw err; }
      });
    });

  });
});

function createExecuteTask(options, cb, checkReplies) {
  options = util.extend({
    parameters: {
      types: [TypeCode.INT],
      values: [1]
    },
    autoCommit: true,
    holdCursorsOverCommit: true,
    scrollableCursor: true,
    statementId: STATEMENT_ID,
    functionCode: FunctionCode.INSERT,
    availableSize: 64
  }, options);
  var connection = new Connection(options.availableSize, options.replies);
  options.availableSize = undefined;
  options.replies = undefined;
  if (checkReplies === undefined) checkReplies = true;
  return ExecuteTask.create(connection, options, function () {
    if (checkReplies) {
      connection.replies.should.have.length(0);
    }
    cb.apply(null, arguments);
  });
}

function Connection(size, replies) {
  this.size = size;
  this.replies = replies || [];
  this.useCesu8 = true;
}

Connection.prototype.send = function (msg, cb) {
  var reply = this.replies.shift();
  msg.type.should.equal(reply.type);
  setImmediate(function () {
    cb.apply(null, reply.args);
  });
};

Connection.prototype.getAvailableSize = function () {
  return this.size;
};