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
/* jshint expr: true */

var lib = require('../lib');
var Queue = lib.util.Queue;

function createTask(reply, cb) {
  function send(cb) {
    setTimeout(function () {
      cb(null, reply);
    }, 1);
  }
  return Queue.prototype.createTask(send, cb, 'standard');
}

function createErrorTask(message, cb) {
  function send(cb) {
    setTimeout(function () {
      cb(new Error(message));
    }, 1);
  }
  return Queue.prototype.createTask(send, cb, 'error');
}

function createThrowTask(message, cb) {
  function send() {
    throw new Error(message);
  }
  return Queue.prototype.createTask(send, cb, 'throw');
}

describe('Util', function () {

  describe('#Queue', function () {

    it('should create a standard queue', function (done) {
      var replies = [];
      var q = new Queue();
      q.empty.should.be.true;
      q.busy.should.be.false;
      q.running.should.be.false;
      q.push(createTask('foo', function (err, reply) {
        replies.push(reply);
      }));
      q.push(createErrorTask('abc', function (err) {
        replies.push(err.message);
      }));
      q.unshift(createThrowTask('def', function (err) {
        replies.push(err.message);
      }));
      q.push(createTask('bar', function (err, reply) {
        replies.push(reply);
      }));
      q.on('drain', function () {
        replies.should.eql(['def', 'foo', 'abc', 'bar']);
        done();
      });
      q.resume();
    });

    it('should create a running queue', function (done) {
      var replies = [];
      var q = new Queue(true);
      q.empty.should.be.true;
      q.busy.should.be.false;
      q.running.should.be.true;
      q.push(createTask('foo', function (err, reply) {
        replies.push(reply);
      }));
      q.unshift(createTask('bar', function (err, reply) {
        replies.push(reply);
      }));
      q.on('drain', function () {
        replies.should.eql(['foo', 'bar']);
        done();
      });
    });

  });

});