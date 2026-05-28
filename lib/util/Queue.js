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

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var MessageType = require('../protocol/common/MessageType');

module.exports = Queue;

util.inherits(Queue, EventEmitter);

function Queue(immediate) {
  EventEmitter.call(this);

  this.queue = [];
  this.busy = false;
  this.running = !!immediate;
  // Records read lob tasks which can be called out of position when
  // the queue is blocked. If other tasks need to be called out of position
  // this can be changed to a Map with the message type as keys.
  this.readLobQueue = [];
  this.blocked = false;
  this.blockingTask = undefined;
}

Object.defineProperty(Queue.prototype, 'empty', {
  get: function isEmpty() {
    return this.queue.length === 0;
  }
});

Queue.prototype.unshift = function unshift(task) {
  this.queue.unshift(task);
  if (task.msgType === MessageType.READ_LOB) {
    this.readLobQueue.unshift(task);
  }
  if (this.blocked && this._isBlockingTask(task)) {
    this.emit('unblock', task);
  } else if (this.running) {
    this.dequeue();
  }
  return this;
};

Queue.prototype.push = function push(task) {
  if (this.blocked && this._isBlockingTask(task)) {
    return this.unshift(task);
  }
  this.queue.push(task);
  if (task.msgType === MessageType.READ_LOB) {
    this.readLobQueue.push(task);
  }
  if (this.running) {
    this.dequeue();
  }
  return this;
};

Queue.prototype.resume = function resume() {
  this.running = true;
  if (this.queue.length) {
    this.dequeue();
  }
  return this;
};

Queue.prototype.pause = function pause() {
  this.running = false;
  return this;
};

Queue.prototype.abort = function abort(err) {
  this.queue.forEach(t => t.receive(err))
  this.queue = [];
  this.busy = false;
  this.running = false;
  this.removeAllListeners();
  return this;
};

Queue.prototype.createTask = function createTask(send, receive, name, msgType) {
  return new Task(send, receive, name, msgType);
};

Queue.prototype.block = function block(blockingTask) {
  this.blocked = true;
  this.blockingTask = blockingTask;
}

Queue.prototype.unblock = function unblock() {
  this.blocked = false;
  this.blockingTask = undefined;
}

Queue.prototype._isBlockingTask = function _isBlockingTask(task) {
  return task === this.blockingTask || task.msgType === MessageType.READ_LOB;
}

Queue.prototype.dequeue = function dequeue() {
  var self = this;

  function runNext() {
    /* jshint unused:false */
    self.busy = false;
    if (self.queue.length) {
      run();
    } else {
      self.emit('drain');
    }
  }

  function runReadLob() {
    if (self.readLobQueue.length) {
      self.busy = false;
      if (self.running && !self.busy) {
        self.busy = true;
        var task = self.readLobQueue.shift();
        // Mark the task as ran so it will be skipped in the queue
        task.ran = true;
        // Optimization: When blocked, often read lobs are the most recently 
        // added at the beginning or end of the queue so they can be removed from there
        // Note that the queue is not empty since it always has at least as many elements 
        // as the readLobQueue
        if (self.queue[0] === task) {
          self.queue.shift();
        } else if (self.queue[self.queue.length - 1] === task) {
          self.queue.pop();
        }
        task.run(next);
      }
    } else {
      runNext();
    }
  }

  function next(err, name) {
    if (self.blocked) {
      // Check if there exists a task that can be run
      if (self.queue.length && self.blockingTask === self.queue[0]) {
        self.unblock();
        runNext();
      } else if (self.readLobQueue.length) {
        runReadLob();
      } else {
        self.once('unblock', function runTask (task) {
          if (task === self.blockingTask) {
            self.unblock();
            runNext();
          } else {
            runReadLob();
          }
        });
      }
    } else {
      runNext();
    }
  }

  function run() {
    if (self.running && !self.busy) {
      // Queue is running and not busy
      self.busy = true;
      var task = self.queue.shift();
      if (task.ran) {
        next(null, task.name);
      } else {
        if (task.msgType === MessageType.READ_LOB) {
          self.readLobQueue.shift();
        }
        task.run(next);
      }
    }
  }
  run();
};

function Task(send, receive, name, msgType) {
  this.send = send;
  this.receive = receive;
  this.name = name;
  this.msgType = msgType;
  this.ran = false;
}

Task.prototype.run = function run(next) {
  var self = this;

  function receive() {
    /* jshint validthis:true */
    self.receive.apply(null, arguments);
    next(null, self.name);
  }
  try {
    this.send(receive);
  } catch (err) {
    process.nextTick(function () {
      receive(err);
    });
  }
};
