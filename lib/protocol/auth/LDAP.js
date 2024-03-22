// Copyright 2022 SAP SE.
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

var CLIENT_NONCE_SIZE = 64;
var CAPABILITIES_SIZE = 8;
var DEFAULT_CAPABILITIES = 1;
var SESSION_KEY_SIZE = 32; // AES256 key size

module.exports = LDAP;

/**
 * Handle LDAP authentication
 *
 * @param {object} options
 * @param {string|Buffer} options.password The LDAP password of the user
 * @param {Buffer} [options.clientChallenge] (for test only) the client nonce (64 bytes) to use
 * @param {Buffer} [options.sessionKey] (for test only) the AES256 key (32 bytes) for the encryption of the password
 */
function LDAP(options) {
  this.name = 'LDAP';
  this.password = options.password;
  if (util.isString(this.password)) {
    this.password = new Buffer(this.password, 'utf8');
  }
  this.clientNonce = options.clientChallenge || crypto.randomBytes(CLIENT_NONCE_SIZE);
  this.clientProof = null;
  this.sessionKey = options.sessionKey;
}

/**
 * Return the initial data to send to HANA (client none + capabilities)
 * @return {Buffer}
 */
LDAP.prototype.initialData = function() {
  // prepare capabilities
  var capabilities = Buffer.allocUnsafe ? Buffer.allocUnsafe(CAPABILITIES_SIZE) : new Buffer(CAPABILITIES_SIZE);
  capabilities.writeInt8(DEFAULT_CAPABILITIES, 0);
  capabilities.fill(0, 1); // fill the remaining 7 bytes with 0

  // write fields
  var data = Fields.write(null, [this.clientNonce, capabilities]).buffer;
  return data;
};

/**
 * Gets the first response from the server and calculates the data for the next request
 * @param {Buffer} buffer
 * @param {function(Error?)} cb
 */
LDAP.prototype.initialize = function(buffer, cb) {
  // read server challenge
  var serverChallengeData = Fields.read({
    buffer: buffer
  });

  // check number of fields
  if (serverChallengeData.length < 4) {
    let error = new Error('Unexpected number of fields [' + serverChallengeData.length + '] in server challenge (LDAP authentication)');
    error.code = 'EHDBAUTHPROTOCOL';
    cb(error);
    return;
  }

  // check client nonce
  var clientNonceProof = serverChallengeData[0];
  if (!clientNonceProof.equals(this.clientNonce)) {
    let error = new Error('Client nonce does not match (LDAP authentication)');
    error.code = 'EHDBAUTHCLIENTNONCE';
    cb(error);
    return;
  }

  // check capabilities
  var serverCapabilities = serverChallengeData[3];
  if (serverCapabilities.readInt8() != DEFAULT_CAPABILITIES) {
    let error = new Error('Unsupported capabilities (LDAP authentication)');
    error.code = 'EHDBAUTHCAPABILITIES';
    cb(error);
    return;
  }

  // generate session key (for AES256 encryption of the password)
  if (!this.sessionKey) {
    this.sessionKey = crypto.randomBytes(SESSION_KEY_SIZE);
  }

  // generate the encrypted session key
  var serverNonce = serverChallengeData[1];
  var serverPublicKey = serverChallengeData[2].toString('ascii'); // RSA public key (PKCS8 PEM)
  var sessionKeyContent = Buffer.concat([this.sessionKey, serverNonce]);
  var encryptedSessionKey = crypto.publicEncrypt({
      key: serverPublicKey,
      format: 'pem',
      type: 'spki'
    }, sessionKeyContent);

  // encrypt the password
  var iv = serverNonce.slice(0, 16);
  var cipher = crypto.createCipheriv("aes-256-cbc", this.sessionKey, iv);
  var passwordContent = Buffer.concat([this.password, new Buffer(1), serverNonce]);
  var encryptedPassword = cipher.update(passwordContent);
  encryptedPassword = Buffer.concat([encryptedPassword, cipher.final()]);

  // generate client proof
  this.clientProof = Fields.write(null, [encryptedSessionKey, encryptedPassword]).buffer;

  // done
  cb();
};

LDAP.prototype.finalData = function finalData() {
  return this.clientProof;
};

LDAP.prototype.finalize = function finalize(buffer) {
  /* jshint unused:false */
};
