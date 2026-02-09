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
var X509Certificate = crypto.X509Certificate;
var fs = require('fs');
var Fields = require('../data/Fields');

const SERVER_NONCE_LENGTH = 64;
// PEM certificate headers in OpenSSL
const CERTIFICATE_HEADERS = ['CERTIFICATE', 'TRUSTED CERTIFICATE', 'X509 CERTIFICATE'];
// The crypto library is strict in enforcing the number of dashs, no spaces around
// BEGIN / END, and line breaks, but we allow more in the regex, so that crypto will
// raise an error for patterns that look like certificates.
const CERTIFICATE_REGEX = new RegExp(
  "-----\\s*BEGIN (" + CERTIFICATE_HEADERS.join('|') + ")\\s*-----" +
  "(.*?)" +
  "-----\\s*END \\1\\s*-----",
'gs');

module.exports = X509;

function X509(options) {
  this.name = 'X509';
  this.authenticationX509 = options.authenticationX509 || options.password;
  if (Buffer.isBuffer(this.authenticationX509)) {
    this.authenticationX509 = this.authenticationX509.toString('utf8');
  }
  this.authenticationX509Password = options.authenticationX509Password;
  this.clientProof = null;

  // Check if input is a PEM certificate or file name
  var isPem = this.authenticationX509.startsWith('-----BEGIN ');
  if (!isPem) {
    try {
      // PEM files should only have ascii
      this.authenticationX509 = fs.readFileSync(this.authenticationX509, 'utf8');
    } catch (err) {
      throw new Error('Invalid value for connect property authenticationX509: ' +
        'Please ensure you have supplied a valid X.509 certificate or file name');
    }
  }

  // Load first certificate
  try {
    this.ownCert = new X509Certificate(this.authenticationX509);
  } catch (err) {
    var opensslErrorText = err.message;
    err.message = 'No X.509 certificate found';
    err.opensslErrorText = opensslErrorText;
    throw err;
  }
  // Verify valid from / to
  var curDate = new Date();
  if (new Date(this.ownCert.validFrom) > curDate) {
    throw new Error('X.509 certificate is not yet valid');
  }
  if (new Date(this.ownCert.validTo) < curDate) {
    throw new Error('X.509 certificate has expired');
  }

  // Load first private key
  try {
    this.privateKey = crypto.createPrivateKey({
      key: this.authenticationX509,
      passphrase: this.authenticationX509Password
    });
  } catch (err) {
    var opensslErrorText = err.message;
    err.message = "Could not load private key";
    if (err.code === 'ERR_OSSL_BAD_DECRYPT') {
      err.message += " (likely wrong password to decrypt private key)"
    }
    err.opensslErrorText = opensslErrorText;
    throw err;
  }
}

/**
 * Return the initial data to send to HANA client
 * (Method name is only sent and empty parameter)
 */
X509.prototype.initialData = function () {
  return Buffer.alloc(0);
}

/**
 * Gets the first response from the server and calculates the data for the
 * final authentication request
 * @param {Buffer} serverNonce - Encodes server nonce (method name is shifted out)
 * @param {function(Error?)} cb
 */
X509.prototype.initialize = function(serverNonce, cb) {
  // Check length of server nonce
  if (serverNonce.length < SERVER_NONCE_LENGTH) {
    let error = new Error('Server nonce length ' + serverNonce.length + ' is too short (X509 authentication)');
    error.code = 'EHDBSERVERAUTH';
    cb(error);
    return;
  }

  var self = this;
  // 1st subparameter: own certificate
  // 2nd subparameter: certificate chain
  var certificateChain;
  try {
    certificateChain = getCertificateChain(this.authenticationX509, self.ownCert);
  } catch (err) {
    return cb(err);
  }
  
  var certChainDERs = certificateChain.map(function (x509) {
    return x509.raw;
  });
  var certChainParameters;
  if (certChainDERs.length === 0) {
    certChainParameters = Buffer.alloc(0);
  } else {
    certChainParameters = Fields.write(null, certChainDERs).buffer;
  }

  // 3rd subparameter: signature of own certificate, chain, and server nonce
  var chainToSign = Buffer.concat(certChainDERs);
  // crypto module will pick the algorithm based on the private key type
  crypto.sign(null, Buffer.concat([self.ownCert.raw, chainToSign, serverNonce]), this.privateKey,
    function (err, signature) {
      if (err) {
        var opensslErrorText = err.message;
        err.message = 'Signing with the own certificate failed';
        err.opensslErrorText = opensslErrorText;
        return cb(err);
      }

      self.clientProof = Fields.write(null, [self.ownCert.raw, certChainParameters, signature]).buffer;

      // done
      cb();
    });
}

X509.prototype.finalData = function finalData() {
  return this.clientProof;
};

X509.prototype.finalize = function finalize(buffer) {
  this.sessionCookie = buffer;
};

// Replicate functionality of OpenSSL's PEM_X509_INFO_read_bio, but
// only need certificates to get certificate chain
function parsePEM(pemBundle) {
  var result = [];
  var pemCerts = pemBundle.match(CERTIFICATE_REGEX);
  for (var i = 0; i < pemCerts.length; i++) {
    var cert;
    try {
      cert = new crypto.X509Certificate(pemCerts[i]);
    } catch (err) {
      var opensslErrorText = err.message;
      err.message = 'Invalid X.509 certificate in certificate chain';
      err.opensslErrorText = opensslErrorText;
      throw err;
    }
    result.push(cert);
  }
  return result;
}

function getIssuerCertificate(curCert, certList) {
  for (var i = 0; i < certList.length; i++) {
    if (curCert.checkIssued(certList[i])) {
      return certList[i];
    }
  }
  return undefined;
}

function getCertificateChain(pemBundle, ownCert) {
  if (ownCert.checkIssued(ownCert)) {
    // Self signed, don't need to search the chain
    return [];
  }
  
  var certList = parsePEM(pemBundle);

  var certChain = [];
  // Add own cert as first in chain
  certChain.push(ownCert);
  
  var curCert = ownCert;
  var issuerCert = getIssuerCertificate(curCert, certList);
  while (issuerCert && curCert != issuerCert) {
    certChain.push(issuerCert);
    curCert = issuerCert;
    issuerCert = getIssuerCertificate(curCert, certList);
  }

  return certChain;
}
