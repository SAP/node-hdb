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
/* jshint undef:false, expr:true */

var async = require('async');
var db = require('../db')();
var RemoteDB = require('../db/RemoteDB');
var path = require('path');
var fs = require('fs');

var describeRemoteDB = db instanceof RemoteDB ? describe : describe.skip;

// Commands to generate the test certificates
//   Root CA
//     openssl genrsa -out c1_rootCA.key 4096
//     openssl req -x509 -new -nodes -key c1_rootCA.key -sha256 -days 7300 -out c1_rootCA.crt -subj "/CN=HANA X509 Tests Company One RootCA"
//   Intermediate CA
//     openssl genrsa -out c1a_inter.key 2048
//     openssl req -new -key c1a_inter.key -out c1a_inter.csr -subj "/C=DE/ST=BW/L=Walldorf/O=Company One/CN=Section Alpha"
//     openssl x509 -req -extfile ca.ext -in c1a_inter.csr -CA c1_rootCA.crt -CAkey c1_rootCA.key -CAcreateserial -sha256 -days 7300 -out c1a_inter.crt
//   Test client key
//     openssl genrsa -aes256 -passout pass:secret -out c1a_test_encrypted.key 2048
//     openssl rsa -passin pass:secret -in c1a_test_encrypted.key -out c1a_test.key
//   Test client
//     openssl req -new -key c1a_test_encrypted.key -passin pass:secret -out c1a_test.csr -subj "/C=DE/ST=BW/L=Walldorf/O=Company One/OU=Section Alpha/CN=Test"
//     openssl x509 -req -in c1a_test.csr -CA c1a_inter.crt -CAkey c1a_inter.key -CAcreateserial -sha256 -days 7300 -out c1a_test.crt
//   Expired test client
//     openssl x509 -req -in c1a_test.csr -CA c1a_inter.crt -CAkey c1a_inter.key -CAcreateserial -sha256 -days 1 -out c1a_test_expired.crt
// Contents of the config file 'ca.ext'
// [ default ]
// basicConstraints = critical,CA:true
// keyUsage         = critical,keyCertSign

var dirname = path.join(__dirname, '..', 'fixtures', 'auth', 'x509');
const TEST_CA_CRT = fs.readFileSync(path.join(dirname, 'c1_rootCA.crt'), 'utf8');
const TEST_CLIENT_KEY = fs.readFileSync(path.join(dirname, 'c1a_test.key'), 'utf8');
const TEST_CLIENT_CRT = fs.readFileSync(path.join(dirname, 'c1a_test.crt'), 'utf8');
const TEST_INTER_CRT = fs.readFileSync(path.join(dirname, 'c1a_inter.crt'), 'utf8');
const TEST_CLIENT_PEM = TEST_CLIENT_KEY + TEST_CLIENT_CRT + TEST_INTER_CRT + TEST_CA_CRT;

const TEST_ENCRYPTED_CLIENT_KEY = fs.readFileSync(path.join(dirname, 'c1a_test_encrypted.key'), 'utf8');
const TEST_ENCRYPTED_CLIENT_PEM = TEST_ENCRYPTED_CLIENT_KEY + TEST_CLIENT_CRT + TEST_INTER_CRT + TEST_CA_CRT;

const TEST_X509CERT = 'TEST_X509CERT'; // Root certificate name
const TEST_X509USER = 'TEST_X509USER';
const TEST_X509TRUST = 'TEST_X509TRUST';
// X509 provider names
const TEST_X509NORULE = 'TEST_X509NORULE';
const TEST_X509WITHRULE = 'TEST_X509WITHRULE';

describe('db', function () {
  before(db.init.bind(db));
  after(db.end.bind(db));
  var client = db.client;

  // Common setup to initialize the root CA as a trusted CA in the db
  function setUpX509Root(done) {
    dropX509Root(function () {
      client.exec("CREATE CERTIFICATE " + TEST_X509CERT + " FROM '" + TEST_CA_CRT + "'", function (err) {
        if (err) done(err);
        client.exec("CREATE PSE " + TEST_X509TRUST, function (err) {
          if (err) done(err);
          client.exec("ALTER PSE " + TEST_X509TRUST + " ADD CERTIFICATE " + TEST_X509CERT, done);
        });
      });
    });
  }

  function dropX509Root(done) {
    client.exec('DROP PSE ' + TEST_X509TRUST, function (err) {
      client.exec('DROP CERTIFICATE ' + TEST_X509CERT, function (err) {
        done();
      });
    });
  }

  // Setup X509 authentication for a user with specific SQL statements
  function setUpX509User(x509ProviderSQL, setPSESQL, userSQL) {
    return function (done) {
      // Setting up the user involves several SQL statements being executed
      // so we increase the timeout for the setup
      this.timeout(5000);
      function createX509Provider(cb) {
        if (x509ProviderSQL) {
          client.exec(x509ProviderSQL, cb);
        } else {
          cb();
        }
      }
      function setPSE(cb) {
        client.exec(setPSESQL, cb);
      }
      function createUser(cb) {
        client.exec(userSQL, cb);
      }
  
      async.waterfall([dropX509Users, createX509Provider, setPSE, createUser], done);
    }
  }

  // Removes setup for all tests
  function dropX509Users(done) {
    // Dropping all of the users and providers involves executing 4 SQL statements
    // currently which can take longer, so we increase the timeout
    if (this && this.timeout) {
      // Only change the timeout when run from the after hook, not the setup
      this.timeout(3000);
    }
    function dropUser(username) {
      return function(cb) {
        client.exec('DROP USER ' + username + ' CASCADE', function (err) {
          // ignore err
          cb();
        });
      }
    }

    function dropX509Provider(provider) {
      return function(cb) {
        client.exec('DROP X509 PROVIDER ' + provider + ' CASCADE', function (err) {
          // ignore err
          cb();
        });
      }
    }

    async.waterfall([dropUser('test'), dropUser(TEST_X509USER), dropX509Provider(TEST_X509WITHRULE),
      dropX509Provider(TEST_X509NORULE)], done);
  }

  // Helper function to set user and password options as undefined to remove them
  // when the settings are extended in the db module
  function removePasswordAuth(options) {
    options['user'] = undefined;
    options['password'] = undefined;
  }

  // Tests if valid connect options will authenticate and give the expected user
  function testConnectValidUser(options, expectedUser, done) {
    removePasswordAuth(options);
    var authDB = require('../db')(options);
    authDB.init(function (err) {
      if (err) done(err);
      var authClient = authDB.client;
      authClient.exec('SELECT CURRENT_USER FROM SYS.DUMMY', function (err, rows) {
        if (err) done(err);
        rows.should.have.length(1);
        rows[0]['CURRENT_USER'].should.equal(expectedUser);
        authDB.end(done);
      });
    });
  }

  // Abstraction over the valid user connect function to validate with a common user
  function testConnectValid(options, done) {
    testConnectValidUser(options, TEST_X509USER, done);
  }

  // Tests if invalid connect options create an error
  function testConnectError(options, errorData, done) {
    removePasswordAuth(options);
    var authDB = require('../db')(options);
    authDB.init(function (err) {
      err.should.be.instanceof(Error);
      if (errorData.errMessage) {
        err.message.should.equal(errorData.errMessage);
      }
      if (errorData.errPrefix) {
        err.message.should.startWith(errorData.errPrefix);
      }
      done();
    });
  }

  describeRemoteDB('X.509 authentication', function () {
    before(setUpX509Root);
    after(dropX509Root);

    describeRemoteDB('X509 provider with no rule', function () {
      var x509ProviderSQL = "CREATE X509 PROVIDER " + TEST_X509NORULE + " WITH ISSUER " +
        "'CN=Section Alpha, O=Company One, L=Walldorf, SP=BW, C=DE'";
      var setPSESQL = "SET PSE " + TEST_X509TRUST + " PURPOSE X509 FOR PROVIDER " + TEST_X509NORULE;
      var userSQL = "CREATE USER " + TEST_X509USER + " WITH IDENTITY " +
        "'CN=Test, OU=Section Alpha, O=Company One, L=Walldorf, SP=BW, C=DE' " +
        "FOR X509 PROVIDER " + TEST_X509NORULE;
      before(setUpX509User(x509ProviderSQL, setPSESQL, userSQL));
      after(dropX509Users);

      it('should authenticate with PEM string', function (done) {
        testConnectValid({authenticationX509: TEST_CLIENT_PEM}, done);
      });

      it('should authenticate with a file name', function (done) {
        testConnectValid({authenticationX509: path.join(dirname, 'test_x509_user.pem')}, done)
      });

      it('should authenticate with encrypted private key in PEM string', function (done) {
        var connectOptions = {
          authenticationX509: TEST_ENCRYPTED_CLIENT_PEM,
          authenticationX509Password: 'secret'
        };
        testConnectValid(connectOptions, done);
      });

      it('should raise an error when certificate chain is incomplete', function (done) {
        var INCOMPLETE_PEM = TEST_CLIENT_KEY + TEST_CLIENT_CRT;
        var errData = {
          errPrefix: "authentication failed: Detailed info for this error can be found with correlation ID"
        };
        testConnectError({authenticationX509: INCOMPLETE_PEM}, errData, done);
      });
    });

    describeRemoteDB('X509 provider with rule', function () {
      var x509ProviderSQL = "CREATE X509 PROVIDER " + TEST_X509WITHRULE + " WITH ISSUER " +
        "'CN=Section Alpha, O=Company One, L=Walldorf, SP=BW, C=DE' " +
        " MATCHING RULES 'CN=*, OU=Section Alpha, O=Company One, L=Walldorf, SP=BW, C=DE';";
      var setPSESQL = "SET PSE " + TEST_X509TRUST + " PURPOSE X509 FOR PROVIDER " + TEST_X509WITHRULE;
      // Username in HANA must be the same as the text in "CN=" attribute of certificate subject
      var userSQL = "CREATE USER test WITH IDENTITY ANY FOR X509 PROVIDER " + TEST_X509WITHRULE;
      before(setUpX509User(x509ProviderSQL, setPSESQL, userSQL));
      after(dropX509Users);

      it('should authenticate with PEM string', function (done) {
        testConnectValidUser({authenticationX509: TEST_CLIENT_PEM}, 'TEST', done);
      });

      it('should authenticate with a file name', function (done) {
        testConnectValidUser({authenticationX509: path.join(dirname, 'test_x509_user.pem')}, 'TEST', done);
      });
    });

    describeRemoteDB('no X509 provider', function () {
      var setPSESQL = "SET PSE " + TEST_X509TRUST + " PURPOSE X509";
      var userSQL = "CREATE USER " + TEST_X509USER + " WITH IDENTITY " +
        "'CN=Test, OU=Section Alpha, O=Company One, L=Walldorf, SP=BW, C=DE' " +
        "ISSUER 'CN=Section Alpha, O=Company One, L=Walldorf, SP=BW, C=DE' " +
        "FOR X509";
      before(setUpX509User(undefined, setPSESQL, userSQL));
      after(dropX509Users);

      it('should authenticate with PEM string', function (done) {
        testConnectValid({authenticationX509: TEST_CLIENT_PEM}, done);
      });

      it('should authenticate with a file name', function (done) {
        testConnectValid({authenticationX509: path.join(dirname, 'test_x509_user.pem')}, done);
      });
    });
  });
});
