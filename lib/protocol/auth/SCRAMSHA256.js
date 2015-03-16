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
var util = require('../../util');
var Fields = require('../data/Fields');

var CLIENT_PROOF_SIZE = 32;
var CLIENT_CHALLENGE_SIZE = 64;

module.exports = SCRAMSHA256;

function createClientChallenge() {
  return crypto.randomBytes(CLIENT_CHALLENGE_SIZE);
}

function SCRAMSHA256(options) {
  this.name = 'SCRAMSHA256';
  this.password = options.password;
  if (util.isString(this.password)) {
    this.password = new Buffer(this.password, 'utf8');
  }
  this.clientChallenge = options.clientChallenge || createClientChallenge();
  this.clientProof = undefined;
}

SCRAMSHA256.prototype.initialData = function initialData() {
  return this.clientChallenge;
};

SCRAMSHA256.prototype.initialize = function initialize(buffer) {
  var serverChallengeData = Fields.read({
    argumentCount: 1,
    buffer: buffer
  });
  this.clientProof = calculateClientProof([serverChallengeData[0]],
    serverChallengeData[1], this.clientChallenge, this.password);
};

SCRAMSHA256.prototype.finalData = function finalData() {
  return this.clientProof;
};

SCRAMSHA256.prototype.finalize = function finalize(buffer) {
  /* jshint unused:false */
};

function calculateClientProof(salts, serverKey, clientKey, password) {
  var buf = new Buffer(2 + (CLIENT_PROOF_SIZE + 1) * salts.length);
  buf[0] = 0x00;
  buf.writeInt8(salts.length, 1);
  var offset = 2;
  salts.forEach(function scrambleSalt(salt) {
    buf.writeInt8(CLIENT_PROOF_SIZE, offset);
    offset += 1;
    scramble(salt, serverKey, clientKey, password).copy(buf, offset);
    offset += CLIENT_PROOF_SIZE;
  });
  return buf;
}

function scramble(salt, serverKey, clientKey, password) {
  var length = salt.length + serverKey.length + clientKey.length;
  var msg = Buffer.concat([salt, serverKey, clientKey], length);
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