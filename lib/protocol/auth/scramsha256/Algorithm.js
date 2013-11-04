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

var crypto = require('crypto');

exports = module.exports = Algorithm;

var CLIENT_PROOF_SIZE = 32;

function Algorithm(clientChallenge) {
  this.clientChallenge = clientChallenge || crypto.randomBytes(64);
  this.serverChallenge = undefined;
  this.salts = undefined;
}

Algorithm.prototype.update = function update(args) {
  this.salts = args;
  this.serverChallenge = this.salts.pop();
};

Algorithm.prototype.getClientProof = function getClientProof(password) {
  if (typeof password === 'string') {
    password = new Buffer(password, 'utf-8');
  }
  var buf = new Buffer(2 + (CLIENT_PROOF_SIZE + 1) * this.salts.length);
  buf[0] = 0x00;
  buf.writeInt8(this.salts.length, 1);
  var offset = 2;
  this.salts.forEach(function scrambleSalt(salt) {
    buf.writeInt8(CLIENT_PROOF_SIZE, offset);
    offset += 1;
    scramble(password, salt, this.clientChallenge, this.serverChallenge)
      .copy(buf, offset);
    offset += CLIENT_PROOF_SIZE;
  }, this);
  return buf;
};

function scramble(password, salt, clientkey, serverkey) {
  var length = salt.length + serverkey.length + clientkey.length;
  var msg = Buffer.concat([salt, serverkey, clientkey], length);
  var key = sha256(hmac(password, salt));
  var sig = hmac(sha256(key), msg);
  return xor(sig, key);
}

function xor(a, b) {
  /* jshint bitwise:false */
  var result = new Buffer(a.length);
  for (var i = 0; i < a.length; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
}

function hmac(key, msg) {
  var hash = crypto.createHmac('sha256', key);
  hash.update(msg);
  return new Buffer(hash.digest(), 'binary');
}

function sha256(msg) {
  var hash = crypto.createHash('sha256');
  hash.update(msg);
  return new Buffer(hash.digest(), 'binary');
}