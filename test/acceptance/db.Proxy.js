// Copyright 2025 SAP AG.
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
"use strict";

const hdb = require("../../");
const async = require("async");
const assert = require("assert");
const { getOptions } = require("../db/index.js");

const TEST_PROXY_NOAUTH = 1080;
const TEST_PROXY_PORT_AUTH = 1081;
const TEST_HTTP_PROXY = 3128;
const TEST_HTTP_PROXY_AUTH = 3129;

const serverConfig = getOptions();
const describeOrSkip = serverConfig.proxyHostname ? describe : describe.skip;
if (describeOrSkip === describe.skip) {
  console.log("Skipping Proxy tests because no proxy hostname configured");
}

describeOrSkip("Proxy", function () {
  function expectSuccess(proxyOpts) {
    return function (done) {
      this.timeout(5000);
      const conn = hdb.createClient();
      async.waterfall(
        [
          function (cb) {
            conn.connect(Object.assign({}, serverConfig, proxyOpts), cb);
          },
          function (cb) {
            conn.exec("SELECT 1 FROM DUMMY", (err, rows) => {
              if (err) return cb(err);
              assert.strictEqual(rows[0]["1"], 1);
              cb();
            });
          },
        ],
        (err) => {
          conn.end();
          done(err);
        }
      );
    };
  }

  function expectFailure(proxyOpts) {
    return function (done) {
      const conn = hdb.createClient();
      conn.connect(
        Object.assign({}, serverConfig, proxyOpts),
        function (err) {
          assert(err, "Expected connection to fail");
          conn.end();
          done();
        }
      );
    };
  }

  describe("SOCKS5 proxy", function () {
    it("connects through SOCKS5 proxy (Domain name, no auth)", expectSuccess({
      proxyHostname: serverConfig.proxyHostname,
      proxyPort: TEST_PROXY_NOAUTH,
    }));

    it("connects through SOCKS5 proxy without specifying port", expectSuccess({
      proxyHostname: serverConfig.proxyHostname,
    }));

    it("connects through SOCKS5 proxy (Domain name, with username/password)", function (done) {
      if (!serverConfig.proxyUserName || !serverConfig.proxyPassword) {
        console.log("Skipping test because proxy username/password not provided");
        this.skip();
      }
      expectSuccess({
        proxyHostname: serverConfig.proxyHostname,
        proxyPort: TEST_PROXY_PORT_AUTH,
        proxyUserName: serverConfig.proxyUserName,
        proxyPassword: serverConfig.proxyPassword,
      }).call(this, done);
    });

    it("fails with invalid proxy credentials", expectFailure({
      proxyHostname: serverConfig.proxyHostname,
      proxyPort: TEST_PROXY_PORT_AUTH,
      proxyUserName: "wrong",
      proxyPassword: "wrong",
    }));

    it("fails with invalid proxy hostname", expectFailure({
      proxyHostname: "invalid.hostname.test",
      proxyPort: TEST_PROXY_NOAUTH,
    }));

    it("fails with invalid proxy port", expectFailure({
      proxyHostname: serverConfig.proxyHostname,
      proxyPort: 9999,
    }));
  });

  describe("HTTP proxy tests", function () {
    before(function () {
      if (serverConfig.port != 443) {
        console.log("Skipping HTTP Proxy tests because server is not a real cloud instance");
        this.skip();
      }
    });

    it("connects through HTTP proxy (Domain name, no auth)", expectSuccess({
      proxyHostname: serverConfig.proxyHostname,
      proxyPort: TEST_HTTP_PROXY,
      proxyHttp: true,
    }));

    it("connects through HTTP proxy (Domain name, with auth)", function (done) {
      if (!serverConfig.proxyUserName || !serverConfig.proxyPassword) {
        console.log("Skipping test because proxy username/password not provided");
        this.skip();
      }
      expectSuccess({
        proxyHostname: serverConfig.proxyHostname,
        proxyPort: TEST_HTTP_PROXY_AUTH,
        proxyHttp: true,
        proxyUserName: serverConfig.proxyUserName,
        proxyPassword: serverConfig.proxyPassword,
      }).call(this, done);
    });

    it("fails with invalid HTTP proxy credentials", expectFailure({
      proxyHostname: "invalid.hostname.test",
      proxyPort: TEST_HTTP_PROXY,
      proxyHttp: true,
      proxyUserName: "wrong.user",
      proxyPassword: "wrong.pass",
    }));

    it("fails with invalid HTTP proxyHostname", expectFailure({
      proxyHostname: "invalid.hostname.test",
      proxyPort: TEST_HTTP_PROXY,
      proxyHttp: true,
    }));
  });
});
