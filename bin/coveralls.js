#!/usr/bin/env node

var util = require('util');
var coveralls = require('coveralls');

(function monkeyPatch(request) {
  if (process.env.HTTPS_PROXY) {
    var post = request.post;
    request.post = function (options, cb) {
      if (typeof options === 'object') {
        if (options.url === 'https://coveralls.io/api/v1/jobs') {
          options.proxy = process.env.HTTPS_PROXY;
        }
      }
      post(options, cb);
    };
  }
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
})(require('coveralls/node_modules/request'));

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