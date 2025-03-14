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

var {Readable, Transform} = require('stream');
var lib = require('../lib');
var ExecuteTask = lib.ExecuteTask;
var FunctionCode = lib.common.FunctionCode;
var TypeCode = lib.common.TypeCode;
var MessageType = lib.common.MessageType;
var PartKind = lib.common.PartKind;
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
        next();
      }).runTest();
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
        next();
      },
      false);
      task.writer._types = undefined;
      task.runTest();
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
        next();
      }).runTest();
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
        next();
      }).runTest();
    });

    it(
      'should run a batch task with STRING type exceeding remainingSize',
      function (next) {
        createExecuteTask({
          parameters: {
            types: [TypeCode.STRING],
            values: [
              ['consectetuer adipiscing elit'],
              ['Lorem ipsum dolor'],
              ['Aenean commodo'],
              ['elementum velit']
            ]
          },
          replies: [{
            type: MessageType.EXECUTE,
            args: [null, {
              rowsAffected: [1]
            }],
            checkMessage: function(msg) {
              msg.parts.forEach(part => {
                if (part.kind === PartKind.PARAMETERS) {
                  var expected = []
                  expected.push(
                    Buffer.concat([
                      Buffer.from('1d1c', 'hex'),
                      Buffer.from('consectetuer adipiscing elit', 'utf8')
                    ])
                  );
                  part.args.should.eql(expected);
                }
              });
            }
          }, {
            type: MessageType.EXECUTE,
            args: [null, {
              rowsAffected: [1, 1]
            }],
            checkMessage: function(msg) {
              msg.parts.forEach(part => {
                if (part.kind === PartKind.PARAMETERS) {
                  var expected = [];
                  expected.push(
                    Buffer.concat([
                      Buffer.from('1d11', 'hex'),
                      Buffer.from('Lorem ipsum dolor')
                    ])
                  );
                  expected.push(
                    Buffer.concat([
                      Buffer.from('1d0e', 'hex'),
                      Buffer.from('Aenean commodo')
                    ])
                  );
                  part.args.should.eql(expected);
                }
              });
            }
          }, {
            type: MessageType.EXECUTE,
            args: [null, {
              rowsAffected: [1]
            }],
            checkMessage: function(msg) {
              msg.parts.forEach(part => {
                if (part.kind === PartKind.PARAMETERS) {
                  var expected = [];
                  expected.push(
                    Buffer.concat([
                      Buffer.from('1d0f', 'hex'),
                      Buffer.from('elementum velit')
                    ])
                  );
                  part.args.should.eql(expected);
                }
              });
            }
          }, {
            type: MessageType.COMMIT,
            args: [null]
          }]
        }, function done(err, reply) {
          (!err).should.be.ok;
          reply.rowsAffected.should.eql([1, 1, 1, 1]);
          next();
        }).runTest();
      });

    it('should run a single failing task with INT type', function (next) {
      createExecuteTask({
        replies: [{
          type: MessageType.EXECUTE,
          args: [new Error('error')]
        }]
      }, function done(err) {
        err.should.be.an.instanceOf(Error);
        next();
      }).runTest();
    });

    it('should run a single task with BLOB type', function (next) {
      var buffer = new Buffer(128);
      var locatorId = new Buffer([1, 0, 0, 0, 0, 0, 0, 0]);
      createExecuteTask({
        parameters: {
          types: [TypeCode.BLOB],
          values: [buffer]
        },
        replies: [{
          type: MessageType.EXECUTE,
          args: [null, {
            writeLobReply: [locatorId],
            rowsAffected: [-1]
          }]
        }, {
          type: MessageType.WRITE_LOB,
          args: [null, {}]
        }, {
          type: MessageType.WRITE_LOB,
          args: [null, {}]
        }, {
          type: MessageType.WRITE_LOB,
          args: [null, {
            rowsAffected: [1]
          }]
        }, {
          type: MessageType.COMMIT,
          args: [null, {}]
        }]
      }, function done(err, reply) {
        (!err).should.be.ok;
        reply.rowsAffected.should.eql([1]);
        reply.writeLobReply[0].should.eql(locatorId);
        next();
      }).runTest();
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
        next();
      }).runTest();
    });

    it('should fail to bind parameters if insufficient space left in packet', function(next) {
      var statement_id_part_length = 24;
      function failToBind(cb) {
        createExecuteTask({
          parameters: {
            types: [TypeCode.NVARCHAR],
            values: ["abcd".repeat(100)]
          },
          availableSize: 403 + statement_id_part_length,
          replies: []
        }, function done(err) {
          err.should.be.an.instanceOf(Error);
          err.message.should.equal('Failed to set parameters, maximum packet size exceeded.');
          cb();
        }).runTest();
      }

      function succeedWithBinding(cb) {
        createExecuteTask({
          parameters: {
            types: [TypeCode.NVARCHAR],
            values: ["abcd".repeat(100)]
          },
          availableSize: 404 + statement_id_part_length,
          replies: [{
            type: MessageType.EXECUTE,
            args: [null],
          }]
        }, function done(err) {
          (!err).should.be.ok;
          cb();
        }).runTest();
      }

      failToBind(() => {
        succeedWithBinding(next);
      });
    });

    it('should limit the size of writeLOB chunks', function (next) {
      var buffer = new Buffer(500);
      // write 'abcd' repeating to entire buffer
      for (var i = 0; i < buffer.length; i++) {
        buffer[i] = 97 + (i % 4);
      }
      var locatorId = new Buffer([1, 0, 0, 0, 0, 0, 0, 0]);
      var lobBytesSent = 0;
      createExecuteTask({
        parameters: {
          types: [TypeCode.NVARCHAR, TypeCode.BLOB],
          values: ["abcd".repeat(100), buffer]
        },
        availableSize : 100000,
        availableSizeForLobs : 200,
        replies: [{
          type: MessageType.EXECUTE,
          args: [null, {
            writeLobReply: [locatorId]
          }],
          checkMessage: function(msg) {
            var parameterDataLen = msg.parts[1].args[0].length;
            parameterDataLen.should.equal(4 + 400 + 10); // string prefix + entire string + lob descriptor (no lob data)
          }
        }, {
          type: MessageType.WRITE_LOB,
          args: [null, {}],
          checkMessage: function(msg) {
            var parameterDataLen = msg.parts[0].args.buffer.length;
            lobBytesSent += parameterDataLen - 21; // subtract 21 bytes for non-data fields
            parameterDataLen.should.equal(200);
          }
        }, {
          type: MessageType.WRITE_LOB,
          args: [null, {}],
          checkMessage: function(msg) {
            var parameterDataLen = msg.parts[0].args.buffer.length;
            lobBytesSent += parameterDataLen - 21; // subtract 21 bytes for non-data fields
            parameterDataLen.should.equal(200);
          }
        }, {
          type: MessageType.WRITE_LOB,
          args: [null, {}],
          checkMessage: function(msg) {
            var parameterDataLen = msg.parts[0].args.buffer.length;
            lobBytesSent += parameterDataLen - 21; // subtract 21 bytes for non-data fields
            lobBytesSent.should.equal(500); // entire lob now sent
          }
        }, {
          type: MessageType.COMMIT,
          args: [null, {}],
        }]
      }, function done(err) {
        (!err).should.be.ok;
        next();
      }).runTest();
    });

    it('should run a task with one stream parameter with read stream error between writeLOB chunks', function (next) {
      var content = new Content(200000);
      var transform = new TransformWithError(150000, false);
      transform.on('error', () => {
        content.unpipe();
        content.destroy();
      });
      content.pipe(transform);
      var locatorId = new Buffer([1, 0, 0, 0, 0, 0, 0, 0]);
      createExecuteTask({
        parameters: {
          types: [TypeCode.BLOB],
          values: [transform]
        },
        availableSize : 50000,
        replies: [{
          type: MessageType.EXECUTE,
          args: [null, {
            writeLobReply: [locatorId]
          }]
        }, {
          type: MessageType.WRITE_LOB,
          args: [null, {}]
        }, {
          type: MessageType.ROLLBACK,
          args: [null, {}]
        }]
      }, function done(err) {
        err.should.be.an.instanceOf(Error);
        next();
      }).runTest();
    });

    it('should run a task with multiple stream parameters with read stream error between writeLOB chunks', function (next) {
      var content1 = new Content(200000);
      var transform1 = new TransformWithError(300000, false);
      transform1.on('error', () => {
        content1.unpipe();
        content1.destroy();
      });
      content1.pipe(transform1); // no read stream error since limit > content size
      var content2 = new Content(200000);
      var transform2 = new TransformWithError(150000, false);
      transform2.on('error', () => {
        content2.unpipe();
        content2.destroy();
      });
      content2.pipe(transform2); // will cause read stream error since limit < content size
      var locatorId = new Buffer([1, 0, 0, 0, 0, 0, 0, 0]);
      createExecuteTask({
        parameters: {
          types: [TypeCode.BLOB, TypeCode.BLOB],
          values: [transform1, transform2],
        },
        availableSize : 50000,
        replies: [{
          type: MessageType.EXECUTE,
          args: [null, {
            writeLobReply: [locatorId, locatorId],
          }]
        }, {
          type: MessageType.WRITE_LOB,
          args: [null, {}]
        }, {
          type: MessageType.WRITE_LOB,
          args: [null, {}]
        }, {
          type: MessageType.WRITE_LOB,
          args: [null, {}]
        }, {
          type: MessageType.WRITE_LOB,
          args: [null, {}]
        }, {
          type: MessageType.WRITE_LOB,
          args: [null, {}]
        }, {
          type: MessageType.ROLLBACK,
          args: [null, {}]
        }]
      }, function done(err) {
        err.should.be.an.instanceOf(Error);
        next();
      }).runTest();
    });

    it('should run a task with read stream error before parameters bound', function (next) {
      var content = new Content(100);
      var transform = new TransformWithError(150000, true);
      transform.on('error', () => {
        content.unpipe();
        content.destroy();
      });
      content.pipe(transform);
      createExecuteTask({
        parameters: {
          types: [TypeCode.BLOB],
          values: [transform]
        },
        availableSize : 50000,
        replies: []
      }, function done(err) {
        err.should.be.an.instanceOf(Error);
        next();
      }).runTest();
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
      task.getParameters(64, 64, function (err) {
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
      task.getParameters(64, 64, function (err) {
        err.should.equal(streamError);
        done();
      });
    });

    it('should run getExecuteRequest with error', function (next) {
      var error = new Error('error');
      var task = createExecuteTask({
        parameters: {
          types: [TypeCode.INT],
          values: [1]
        },
        replies: []
      }, function done(err) {
        err.should.equal(error);
        next();
      });
      task.getParameters = function (availableSize, availableSizeForLOBs, cb) {
        availableSize.should.equal(40);
        availableSizeForLOBs.should.equal(40);
        cb(error);
      };
      task.runTest();
    });

    it('should run getWriteLobRequest with error', function (next) {
      var buffer = Buffer.alloc(64);
      var locatorId = Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]);
      var error = new Error('error');
      var task = createExecuteTask({
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
          type: MessageType.ROLLBACK,
          args: [null, {}]
        }]
      }, function done(err) {
        err.should.equal(error);
        next();
      });
      task.writer.getWriteLobRequest = function (availableSize, cb) {
        availableSize.should.equal(64);
        cb(error);
      };
      task.runTest();
    });

    it('should sendExecute with error', function (done) {
      var task = createExecuteTask();
      var error = new Error('error');
      task.connection.send = function (msg, cb) {
        cb(error);
      };
      task.sendExecute(
        Buffer.alloc(0),
        function (err) { // finalize
          err.should.equal(error);
          done();
        },
        function () {
          done(new Error("Should call finalize immediately, not callback"));
        });
    });

    it('should sendWriteLobRequest with error', function (done) {
      var task = createExecuteTask();
      var error = new Error('error');
      task.connection.send = function (msg, cb) {
        cb(error);
      };
      task.sendWriteLobRequest(
        Buffer.alloc(0),
        function (err) { // finalize
          err.should.equal(error);
          done();
        },
        function () {
          done(new Error("Should call finalize immediately, not callback"));
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
    availableSize: 64,
  }, options);
  if(options.availableSizeForLobs === undefined) {
    options.availableSizeForLobs = options.availableSize;
  }
  var connection = new Connection(options.availableSize, options.availableSizeForLobs, options.replies);
  options.availableSize = undefined;
  options.availableSizeForLobs = undefined;
  options.replies = undefined;
  if (checkReplies === undefined) checkReplies = true;
  var task = ExecuteTask.create(connection, options, function () {
    if (checkReplies) {
      connection.replies.should.have.length(0);
    }
    cb.apply(null, arguments);
  });
  task.runTest = function () {
    this.connection.enqueue(this);
  }
  return task;
}

function Connection(size, sizeForLobs, replies) {
  this.size = size;
  this.sizeForLobs = sizeForLobs;
  this.replies = replies || [];
  this.useCesu8 = true;
  this.queue = new util.Queue(true);
}

Connection.prototype.send = function (msg, cb) {
  var reply = this.replies.shift();
  msg.type.should.equal(reply.type);
  if (typeof reply.checkMessage === 'function') {
      reply.checkMessage(msg);
  }
  setImmediate(function () {
    cb.apply(null, reply.args);
  });
};

Connection.prototype.enqueue = function enqueue(task, cb) {
  // The task will always be the same ExecuteTask enqueuing itself
  this.queue.push(task);
};

Connection.prototype.blockQueue = function blockQueue(blockingTask) {
  this.queue.block(blockingTask);
}

Connection.prototype.getAvailableSize = function (forLobs = false) {
  if(forLobs) {
      return this.sizeForLobs;
  }
  return this.size;
};

class Content extends Readable {
    constructor(size) {
        super();
        this.bytesRead = 0;
        this.testChunk = '';
        for(let i = 0; i < (size / 8); ++i) {
            this.testChunk += '12345678';
        }
    }

    _read(size) {
        let toRead = size;
        if(toRead > 0 && this.bytesRead < this.testChunk.length) {
            let chunk = this.testChunk.slice(this.bytesRead, this.bytesRead + toRead);
            this.push(chunk);
            this.bytesRead += chunk.length;
        }
        if(this.bytesRead == this.testChunk.length) {
            this.push(null);
        }
    }
}

class TransformWithError extends Transform {
    constructor(limit, errorOnFinal) {
        super();
        this.limit = limit;
        this.errorOnFinal = Boolean(errorOnFinal);
    }

    _transform(chunk, encoding, callback) {
        this.limit -= chunk.length;
        if (this.limit > 0) {
            callback(null, chunk);
        } else {
            callback(new Error('Error in transform'));
        }
    }

    _final(callback) {
        callback(this.errorOnFinal ? new Error('Error in final') : null);
    }
}

