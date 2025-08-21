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

// Proxy server config
const TEST_PROXY_NOAUTH = 1080;
const TEST_PROXY_PORT_AUTH = 1081;

let serverConfig;
serverConfig = getOptions();
const describeOrSkip = serverConfig.proxyHostname ? describe : describe.skip;
if(describeOrSkip === describe.skip) {
  console.log("Skipping Proxy tests because no proxy hostname configured");
}

describeOrSkip("Proxy", function () {
  describe("SOCKS5 proxy", function () {
    function connectWithOptions(proxyOpts, client) {
      return function (cb) {
        const opts = Object.assign({}, serverConfig, proxyOpts);
        client.connect(opts, cb);
      };
    }

    it("connects through SOCKS5 proxy (Domain name, no auth)", function (done) {
      this.timeout(3000);
      const conn = hdb.createClient();
      const options = {
        proxyHostname: serverConfig.proxyHostname,
        proxyPort: TEST_PROXY_NOAUTH,
      };

      async.waterfall(
        [
          connectWithOptions(options, conn),
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
        },
        done,
      );
    });

    it("connects through SOCKS5 proxy without specifying port", function (done) {
      this.timeout(3000);
      const conn = hdb.createClient();
      const options = {
        proxyHostname: serverConfig.proxyHostname,
      };

      async.waterfall(
        [
          connectWithOptions(options, conn),
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
        },
        done,
      );
    });

    it("connects through SOCKS5 proxy (Domain name, with username/password)", function (done) {
      this.timeout(3000);

      if (!serverConfig.proxyPassword || !serverConfig.proxyUserName) {
        console.log("skipping test because proxy username and password not provided")
        this.skip();
      }

      const conn = hdb.createClient();
      const options = {
        proxyHostname: serverConfig.proxyHostname,
        proxyPort: TEST_PROXY_PORT_AUTH,
        proxyUserName: serverConfig.proxyUserName,
        proxyPassword: serverConfig.proxyPassword,
      };

      async.waterfall(
        [
          connectWithOptions(options, conn),
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
        },
        done,
      );
    });

    it("fails with wrong proxy credentials", function (done) {
      const conn = hdb.createClient();
      const options = {
        proxyHostname: serverConfig.proxyHostname,
        proxyPort: TEST_PROXY_PORT_AUTH,
        proxyUserName: "wrong",
        proxyPassword: "wrong",
      };

      conn.connect(
        Object.assign({}, serverConfig, options),
        function (err) {
          assert(err);
          conn.end();
          done();
        },
        done,
      );
    });

    it("fails with invalid proxy hostname", function (done) {
      const conn = hdb.createClient();
      const options = {
        proxyHostname: "invalid.hostname.test",
        proxyPort: TEST_PROXY_NOAUTH,
      };

      conn.connect(Object.assign({}, serverConfig, options), function (err) {
        assert(err);
        conn.end();
        done();
      });
    });

    it("fails with invalid proxy port", function (done) {
      const conn = hdb.createClient();
      const options = {
        proxyHostname: serverConfig.proxyHostname,
        proxyPort: 9999,
      };

      conn.connect(Object.assign({}, serverConfig, options), function (err) {
        assert(err);
        conn.end();
        done();
      });
    });
  });
});