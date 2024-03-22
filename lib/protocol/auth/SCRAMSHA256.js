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
var SERVER_PROOF_SIZE = 32;
var CLIENT_CHALLENGE_SIZE = 64;

module.exports = SCRAMSHA256;

function createClientChallenge() {
  return crypto.randomBytes(CLIENT_CHALLENGE_SIZE);
}

function SCRAMSHA256(options, usePBKDF2) {
  this.usePBKDF2 = usePBKDF2;
  if (usePBKDF2) {
    this.name = 'SCRAMPBKDF2SHA256';
  } else {
    this.name = 'SCRAMSHA256';
  }
  this.password = options.password;
  if (util.isString(this.password)) {
    this.password = new Buffer(this.password, 'utf8');
  }
  this.clientChallenge = options.clientChallenge || createClientChallenge();
  this.clientProof = undefined;
  this.serverProof = undefined;
}

SCRAMSHA256.prototype.initialData = function initialData() {
  return this.clientChallenge;
};

SCRAMSHA256.prototype.initialize = function initialize(buffer, cb) {
  var self = this;
  var serverChallengeData = Fields.read({
    argumentCount: 1,
    buffer: buffer
  });
  var iterations = 0;
  if (this.usePBKDF2) {
    iterations = serverChallengeData[2].readUInt32BE();
  }
  calculateProofs(
    [serverChallengeData[0]],
    serverChallengeData[1],
    this.clientChallenge,
    this.password,
    iterations,
    this.usePBKDF2,
    function(err, proofs) {
      if (err) {
          cb(err);
          return;
      }
      self.clientProof = proofs["CLIENT_PROOF"];
      if (self.usePBKDF2) self.serverProof = proofs["SERVER_PROOF"];
      cb();
    });
};

SCRAMSHA256.prototype.finalData = function finalData() {
  return this.clientProof;
};

SCRAMSHA256.prototype.finalize = function finalize(buffer) {
  /* jshint unused:false */
  if (!this.usePBKDF2) return;

  var x = Buffer.compare(buffer, this.serverProof);
  if(x != 0) {
      var err = new Error("Server couldn't be authenticated");
      err.code = 'EHDBSERVERAUTH';
      throw err;
  }
};

function calculateProofs(salts, serverKey, clientKey, password, iterations, usePBKDF2, cb) {
  var proofs = {};
  var clientProof = new Buffer(2 + (CLIENT_PROOF_SIZE + 1) * salts.length);
  proofs["CLIENT_PROOF"] = clientProof;
  clientProof.writeUInt16BE(salts.length, 0); // sub-arg count BIG endian
  var cp_offset = 2;
  if (usePBKDF2) {
    var serverProof = new Buffer(2 + (SERVER_PROOF_SIZE + 1) * salts.length);
    proofs["SERVER_PROOF"] = serverProof;
    serverProof.writeUInt16LE(salts.length, 0); // sub-arg count LITTLE endian
    var sp_offset = 2;

    var pbkdf2Count = 0;
    salts.forEach(function(salt) {
      var length = salt.length + serverKey.length + clientKey.length;
      clientProof.writeInt8(CLIENT_PROOF_SIZE, cp_offset);
      cp_offset += 1;
      serverProof.writeInt8(SERVER_PROOF_SIZE, sp_offset);
      sp_offset += 1;
      var tmp_cp_offset = cp_offset;
      cp_offset += CLIENT_PROOF_SIZE;
      var tmp_sp_offset = sp_offset;
      sp_offset += SERVER_PROOF_SIZE;
      crypto.pbkdf2(password,
                    salt,
                    iterations,
                    CLIENT_PROOF_SIZE,
                    'sha256',
                    function(err, salted_pwd) {
        ++pbkdf2Count;
        scramble(salt, serverKey, clientKey, salted_pwd).copy(clientProof, tmp_cp_offset);

        var serverVerifier = hmac(salted_pwd, salt);
        var msg_server = Buffer.concat([clientKey, salt, serverKey], length);
        hmac(serverVerifier, msg_server).copy(serverProof, tmp_sp_offset);
        if (pbkdf2Count == salts.length) { // done
          cb(null, proofs);
        }
      });
    });
  } else {
    salts.forEach(function(salt) {
      clientProof.writeInt8(CLIENT_PROOF_SIZE, cp_offset);
      cp_offset += 1;
      var length = salt.length + serverKey.length + clientKey.length;

      var salted_pwd = hmac(password, salt);
      scramble(salt, serverKey, clientKey, salted_pwd).copy(clientProof, cp_offset);
      cp_offset += CLIENT_PROOF_SIZE;
    });
    cb(null, proofs);
  }
}

function scramble(salt, serverKey, clientKey, salted_pwd) {
  var length = salt.length + serverKey.length + clientKey.length;
  var msg = Buffer.concat([salt, serverKey, clientKey], length);
  var key = sha256(salted_pwd);
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
