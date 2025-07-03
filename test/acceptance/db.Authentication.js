"use strict";

require("should");
const hdb = require("../../index");
const assert = require("assert");
const util = require("util");
const async = require("async");
const db = require("../db")();
const fs = require("fs");
const path = require("path");
const { getOptions } = require("../db/index.js");

// Function to generate a JWT token and certificate:
function createJWTTokenAndCert() {
  const JWTdir = path.join(__dirname, "..", "fixtures", "auth", "JWT");
  const { exec } = require("child_process");
  exec(`openssl genrsa -out "${path.join(JWTdir, "jwt_private.key")}" 2048`, (err) => {
    exec(
      `openssl req -new -x509 -key ${path.join(JWTdir, "jwt_private.key")} -out ${path.join(JWTdir, "jwt_public.crt")} -days 7200 -subj "/C=DE/ST=Berlin/L=Berlin/O=SAP/CN=JWT"`,
      (err) => {
        const privateKey = fs.readFileSync(path.join(JWTdir, "jwt_private.key"), "utf8");
        const TWENTY_YEARS_IN_SECONDS = 20 * 365 * 24 * 60 * 60;
        const payload = {
          user_name: "testuser", // must match identity in HANA
          iss: "http://test.localhost:8080/uaa/oauth/token", // issuer - must match JWT Provider
          exp: Math.floor(Date.now() / 1000) + TWENTY_YEARS_IN_SECONDS,
        };

        const jwt = require("jsonwebtoken");
        fs.writeFileSync(
          path.join(JWTdir, "jwt.token"),
          jwt.sign(payload, privateKey, { algorithm: "RS256" }),
        );
      },
    );
  });
}

//How to Generate SAML assertion and certificate:
//Step 1: cd into test/fixtures/auth/SAML of the node-hdb driver

//Step 2: Create a Root Certificate Authority (CA)
//openssl req -x509 -newkey rsa:4096 -nodes -keyout c1_rootCA.key -out c1_rootCA.crt -days 7300 -sha256 -subj "/C=DE/ST=Germany/L=Walldorf/O=SAP AG/OU=SAP HANA/CN=SAP AG HANA Test Root CA"

//Step 3: Generate a Private Key and Certificate Signing Request (CSR)
//openssl req -newkey rsa:2048 -nodes  -keyout c1a_test.key -out c1a_test.csr -subj "/C=DE/ST=Germany/L=Walldorf/O=SAP AG/OU=SAP HANA/CN=SAP AG HANA SSL-Test-Server"

//Step 4: Sign the CSR with the Root CA
//openssl x509 -req -in c1a_test.csr -CA c1_rootCA.crt -CAkey c1_rootCA.key -CAcreateserial -out c1a_test.crt -days 7300 -sha256

//Step 5: Digitally Sign the Assertion
//xmlsec1 --sign --privkey-pem c1a_test.key,c1a_test.crt assertion.xml > signed_assertion.xml

const options = getOptions()

describe("Authentication Connect Tests", function () {
  before(db.init.bind(db));
  after(db.end.bind(db));
  const adminConn = db.client;

  describe("SAML Connect", function () {
    const SAMLdirname = path.join(__dirname, "..", "fixtures", "auth", "SAML");

    const requiredFiles = ["signed_assertion.xml", "c1a_test.crt"];
    const allExist = requiredFiles.every((filename) =>
      fs.existsSync(path.join(SAMLdirname, filename)),
    );

    if (!allExist) return;

    const SAML_KEY_INFO_CERTIFICATE = fs.readFileSync(
      path.join(SAMLdirname, "c1a_test.crt"),
      "utf8",
    ); //Public certificate so that SAP Hana can verify the assertion
    const SAML_ASSERTION = fs.readFileSync(path.join(SAMLdirname, "signed_assertion.xml"), "utf8");
    const INVALLID_SAML_ASSERTION = SAML_ASSERTION.replace(
      "EXTERNAL_USER_NAME",
      "INVALID_EXTERNAL_USER_NAME",
    ); //to test invalid assertion

    const TEST_SAML_USER = "NodeTestSAMLConnectUser";
    const TEST_SAML_PROVIDER = "NodeTestSAMLConnectProvider"; //identity provider (IdP) name
    const TEST_SAML_TRUST = "NodeTestSAMLConnectTrust";
    const TEST_SAML_CERT = "NodeTestSAMLConnectCert";

    const SAML_PROVIDER_SUBJECT =
      "CN=SAP AG HANA SSL-Test-Server, OU=SAP HANA, O=SAP AG, L=Walldorf, SP=Germany, C=DE";
    const SAML_PROVIDER_ISSUER =
      "CN=SAP AG HANA Test Root CA, OU=SAP HANA, O=SAP AG, L=Walldorf, SP=Germany, C=DE"; //to validate the IdP
    const SAML_PROVIDER_IDENTITY = "EXTERNAL_USER_NAME";

    let sessionCookie;

    before(function (done) {
      this.timeout(5000);
      async.waterfall(
        [
          execIgnoreErr(`DROP USER ${TEST_SAML_USER} CASCADE`, adminConn),
          execIgnoreErr(`DROP SAML PROVIDER ${TEST_SAML_PROVIDER} CASCADE`, adminConn),
          execIgnoreErr(`DROP PSE ${TEST_SAML_TRUST}`, adminConn),
          selectAndDropCertIfExists(TEST_SAML_CERT, adminConn),
          execSQL(
            `CREATE SAML PROVIDER ${TEST_SAML_PROVIDER} WITH SUBJECT '${SAML_PROVIDER_SUBJECT}' ISSUER '${SAML_PROVIDER_ISSUER}'`,
            adminConn,
          ),
          execSQL(
            `CREATE USER ${TEST_SAML_USER} WITH IDENTITY '${SAML_PROVIDER_IDENTITY}' FOR SAML PROVIDER ${TEST_SAML_PROVIDER};`,
            adminConn,
          ),
          execSQL(`CREATE PSE ${TEST_SAML_TRUST}`, adminConn),
          execSQL(
            `CREATE CERTIFICATE FROM '${SAML_KEY_INFO_CERTIFICATE}' COMMENT '${TEST_SAML_CERT}'`,
            adminConn,
          ),
          handleCertificateAndAddToPSE(TEST_SAML_CERT, TEST_SAML_TRUST, adminConn),
          execSQL(`SET PSE ${TEST_SAML_TRUST} PURPOSE SAML`, adminConn),
        ],
        done,
      );
    });

    after(function (done) {
      this.timeout(5000);
      async.waterfall(
        [
          execIgnoreErr(`DROP USER ${TEST_SAML_USER} CASCADE`, adminConn),
          execIgnoreErr(`DROP SAML PROVIDER ${TEST_SAML_PROVIDER} CASCADE`, adminConn),
          execIgnoreErr(`DROP PSE ${TEST_SAML_TRUST}`, adminConn),
          selectAndDropCertIfExists(TEST_SAML_CERT, adminConn),
        ],
        done,
      );
    });

    it("should connect using SAML authentication", function (done) {
      const authConn = hdb.createClient();
      async.waterfall(
        [
          connectWithOptions(
            { host: options.host, port: options.port, user: "", assertion: SAML_ASSERTION },
            authConn,
          ),
          checkCurrentUser(TEST_SAML_USER, authConn),
          function (cb) {
            sessionCookie = authConn.get("sessionCookie"); // Save it for next test
            return cb();
          },
          disconnectConn(authConn),
        ],
        done,
      );
    });

    it("should reconnect with session cookie", function (done) {
      const authConn = hdb.createClient();
      async.waterfall(
        [
          connectWithOptions(
            {
              host: options.host,
              port: options.port,
              user: TEST_SAML_USER,
              sessionCookie: sessionCookie,
            },
            authConn,
          ),
          checkCurrentUser(TEST_SAML_USER, authConn),
          disconnectConn(authConn),
        ],
        done,
      );
    });

    it("invalid assertion should result in error", function (done) {
      const errData = {
        errPrefix:
          "authentication failed: Detailed info for this error can be found with correlation ID",
      };
      testConnectError(
        { host: options.host, port: options.port, user: "", assertion: INVALLID_SAML_ASSERTION },
        errData,
        done,
      );
    });
  });

  describe("JWT Connect", function () {
    const JWTdirname = path.join(__dirname, "..", "fixtures", "auth", "JWT");

    const requiredFiles = ["jwt_public.crt", "jwt.token"];
    const allExist = requiredFiles.every((filename) =>
      fs.existsSync(path.join(JWTdirname, filename)),
    );

    if (!allExist) return;

    const JWT_TOKEN = fs.readFileSync(path.join(JWTdirname, "jwt.token"), "utf8");
    const JWT_PUBLIC_CERTIFICATE = fs.readFileSync(path.join(JWTdirname, "jwt_public.crt"), "utf8");

    const TEST_JWT_TRUST = "NodeTestJwtPse";
    const TEST_JWT_USER = "NodeTestJwtUser";
    const TEST_JWT_PROVIDER = "NodeTestJwtProvider";

    const JWT_PROVIDER_IDENTITY = "testuser";
    const JWT_PROVIDER_ISSUER = "http://test.localhost:8080/uaa/oauth/token";

    let sessionCookie;

    before(function (done) {
      this.timeout(5000);
      async.waterfall(
        [
          execIgnoreErr(`DROP USER ${TEST_JWT_USER} CASCADE`, adminConn),
          execIgnoreErr(`DROP JWT PROVIDER ${TEST_JWT_PROVIDER} CASCADE`, adminConn),
          execIgnoreErr(`DROP PSE ${TEST_JWT_TRUST}`, adminConn),
          selectAndDropCertIfExists(TEST_JWT_USER, adminConn),
          execSQL(
            `CREATE JWT PROVIDER ${TEST_JWT_PROVIDER} WITH ISSUER  '${JWT_PROVIDER_ISSUER}' CLAIM 'user_name' AS EXTERNAL IDENTITY`,
            adminConn,
          ),
          execSQL(
            `CREATE USER ${TEST_JWT_USER} WITH IDENTITY '${JWT_PROVIDER_IDENTITY}' FOR JWT PROVIDER ${TEST_JWT_PROVIDER};`,
            adminConn,
          ),
          execSQL(`CREATE PSE ${TEST_JWT_TRUST}`, adminConn),
          execSQL(
            `CREATE CERTIFICATE FROM '${JWT_PUBLIC_CERTIFICATE}' COMMENT '${TEST_JWT_USER}'`,
            adminConn,
          ),
          handleCertificateAndAddToPSE(TEST_JWT_USER, TEST_JWT_TRUST, adminConn),
          execSQL(`SET PSE ${TEST_JWT_TRUST} PURPOSE JWT`, adminConn),
        ],
        done,
      );
    });

    after(function (done) {
      this.timeout(5000);
      async.waterfall(
        [
          execIgnoreErr(`DROP USER ${TEST_JWT_USER} CASCADE`, adminConn),
          execIgnoreErr(`DROP JWT PROVIDER ${TEST_JWT_PROVIDER} CASCADE`, adminConn),
          execIgnoreErr(`DROP PSE ${TEST_JWT_TRUST}`, adminConn),
          selectAndDropCertIfExists(TEST_JWT_USER, adminConn),
        ],
        done,
      );
    });

    it("should connect using JWT authentication", function (done) {
      const authConn = hdb.createClient();
      async.waterfall(
        [
          connectWithOptions(
            { host: options.host, port: options.port, user: "", token: JWT_TOKEN },
            authConn,
          ),
          checkCurrentUser(TEST_JWT_USER, authConn),
          function (cb) {
            sessionCookie = authConn.get("sessionCookie");
            return cb();
          },
          disconnectConn(authConn),
        ],
        done,
      );
    });

    it("should reconnect with session cookie", function (done) {
      const authConn = hdb.createClient();
      async.waterfall(
        [
          connectWithOptions(
            {
              host: options.host,
              port: options.port,
              user: TEST_JWT_USER,
              sessionCookie: sessionCookie,
            },
            authConn,
          ),
          checkCurrentUser(TEST_JWT_USER, authConn),
          disconnectConn(authConn),
        ],
        done,
      );
    });

    it("invalid token should result in error", function (done) {
      const errData = {
        errPrefix:
          "authentication failed: Detailed info for this error can be found with correlation ID",
      };
      testConnectError(
        { host: options.host, port: options.port, user: "", token: JWT_TOKEN + "x" },
        errData,
        done,
      );
    });
  });

  function connectWithOptions(options, conn) {
    return function (cb) {
      conn.connect(options, (err) => {
        if (err) return cb(err);
        return cb();
      });
    };
  }

  function disconnectConn(conn) {
    return function (cb) {
      function done(err) {
        conn.end();
        setTimeout(cb.bind(null, err), 1);
      }
      conn.disconnect(done);
    };
  }

  function testConnectError(options, errorData, done) {
    const authConn = hdb.createClient();
    authConn.connect(options, function (err) {
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

  function execIgnoreErr(sql, conn) {
    return function (cb) {
      conn.exec(sql, () => {
        return cb();
      });
    };
  }

  function execSQL(sql, conn) {
    return function (cb) {
      conn.exec(util.format(sql), (err) => {
        if (err) {
          console.error("Error", err);
          return cb(err);
        }
        return cb();
      });
    };
  }

  function selectAndDropCertIfExists(certComment, conn) {
    return function (cb) {
      const sql = `SELECT CERTIFICATE_ID FROM SYS.CERTIFICATES WHERE COMMENT='${certComment}'`;
      conn.exec(sql, (err, rows) => {
        if (err || rows.length === 0) return cb();
        const certId = rows[0].CERTIFICATE_ID;
        const dropSql = `DROP CERTIFICATE ${certId}`;
        conn.exec(dropSql, () => {
          return cb();
        });
      });
    };
  }

  function handleCertificateAndAddToPSE(certName, pseName, conn) {
    return function (cb) {
      conn.exec(
        `SELECT CERTIFICATE_ID FROM SYS.CERTIFICATES WHERE COMMENT='${certName}'`,
        (err, rows) => {
          if (err) return cb(err);
          if (rows.length > 0) {
            conn.exec(`ALTER PSE ${pseName} ADD CERTIFICATE ${rows[0].CERTIFICATE_ID}`, (err) => {
              if (err) return cb(err);
              return cb();
            });
          } else {
            return cb();
          }
        },
      );
    };
  }

  function checkCurrentUser(username, conn) {
    return function (cb) {
      conn.exec("SELECT CURRENT_USER FROM DUMMY", (err, rows) => {
        if (err) return cb(err);
        try {
          assert.strictEqual(
            rows[0].CURRENT_USER.toLowerCase(),
            username.toLowerCase(),
            "Check username: CURRENT_USER does not match expected username",
          );
          return cb();
        } catch (checkErr) {
          return cb(checkErr);
        }
      });
    };
  }
});