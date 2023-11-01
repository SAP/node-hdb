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

module.exports = Queue;

util.inherits(Queue, EventEmitter);

function Queue(immediate) {
  EventEmitter.call(this);

  this.queue = [];
  this.busy = false;
  this.running = !!immediate;
}

Object.defineProperty(Queue.prototype, 'empty', {
  get: function isEmpty() {
    return this.queue.length === 0;
  }
});

Queue.prototype.unshift = function unshift(task) {
  this.queue.unshift(task);
  if (this.running) {
    this.dequeue();
  }
  return this;
};

Queue.prototype.push = function push(task) {
  this.queue.push(task);
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

Queue.prototype.createTask = function createTask(send, receive, name) {
  return new Task(send, receive, name);
};

Queue.prototype.dequeue = function dequeue() {
  var self = this;

  function next(err, name) {
    /* jshint unused:false */
    self.busy = false;
    if (self.queue.length) {
      run();
    } else {
      self.emit('drain');
    }
  }

  function run() {
    if (self.running && !self.busy) {
      // Queue is running and not busy
      self.busy = true;
      var task = self.queue.shift();
      task.run(next);
    }
  }
  run();
};

function Task(send, receive, name) {
  this.send = send;
  this.receive = receive;
  this.name = name;
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
