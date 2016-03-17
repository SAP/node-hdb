#!/usr/bin/env node

'use strict';

var util = require('util');
var coveralls = require('coveralls');

if (process.env.TRAVIS_JOB_ID) {
  process.env.TRAVIS = '1';
}
if (process.env.SEND_TO_STDOUT) {
  coveralls.sendToCoveralls = function (obj, cb) {
    console.log(util.inspect(obj, {
      colors: true,
      depth: 8
    }));
    setImmediate(function () {
      cb(null, {
        statusCode: 200
      }, 'OK');
    });
  };
}

var input = '';
process.stdin
  .on('readable', function () {
    var chunk;
    while (null !== (chunk = this.read())) {
      input += chunk;
    }
  })
  .on('end', function () {
    coveralls.handleInput(input, function (err) {
      if (err) {
        throw err;
      }
    });
  })
  .setEncoding('utf8');