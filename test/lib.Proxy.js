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

const assert = require("assert");
const { ProxyClient } = require("../lib/protocol/Proxy");
const ProxyConstants = require("../lib/protocol/common/ProxyConstants");
const mock = require("./mock");
const http = require("http");

function createSocketMock() {
  const socket = mock.createSocket({});
  socket.writes = [];
  socket.write = (buf) => {
    socket.writes.push(buf);
    return true;
  };
  return socket;
}

describe("Lib", function () {
  describe("#ProxyClient", () => {
    describe("_doHandshake()", () => {
      it("should complete handshake with valid method", async () => {
        const client = new ProxyClient({
          proxyHostname: "proxy.local",
          proxyPort: 1080,
        });
        client._socket = createSocketMock();
        client._readBytes = async () => Buffer.from([0x05, 0x00]);
        await client._doHandshake();
        assert.strictEqual(client.authMethod, 0x00);
      });

      it("should fail handshake with invalid SOCKS version", async () => {
        const client = new ProxyClient({});
        client._socket = createSocketMock();
        client._readBytes = async () => Buffer.from([0x04, 0x00]);
        await assert.rejects(() => client._doHandshake());
      });
    });

    describe("_doAuthentication()", () => {
      let client;
      beforeEach(() => {
        client = new ProxyClient({});
      });

      function setupAuthTest(client, authMethod) {
        const called = {
          userpass: false,
          sapcloud: false,
        };
        client.authMethod = authMethod;
        client._doProxyUserPassAuthentication = async () => {
          called.userpass = true;
          return "USERPASS_CALLED";
        };
        client._doProxySAPCloudAuthentication = async () => {
          called.sapcloud = true;
          return "SAPCLOUD_CALLED";
        };
        return called;
      }

      it("should succeed with NOAUTH and not call other methods", async () => {
        const called = setupAuthTest(
          client,
          ProxyConstants.ProxyAuthMethods.PROXYAUTH_NOAUTH,
        );
        await client._doAuthentication();
        assert.strictEqual(called.userpass, false);
        assert.strictEqual(called.sapcloud, false);
      });

      it("should call USERPASS", async () => {
        const called = setupAuthTest(
          client,
          ProxyConstants.ProxyAuthMethods.PROXYAUTH_USERPASS,
        );
        await client._doAuthentication();
        assert.strictEqual(called.userpass, true);
        assert.strictEqual(called.sapcloud, false);
      });

      it("should call SAPCLOUDJWT", async () => {
        const called = setupAuthTest(
          client,
          ProxyConstants.ProxyAuthMethods.PROXYAUTH_SAPCLOUDJWT,
        );
        await client._doAuthentication();
        assert.strictEqual(called.userpass, false);
        assert.strictEqual(called.sapcloud, true);
      });

      it("should throw on USERPASS failure", async () => {
        client.authMethod = ProxyConstants.ProxyAuthMethods.PROXYAUTH_USERPASS;
        client._doProxyUserPassAuthentication = async () => false;
        await assert.rejects(() => client._doAuthentication());
      });

      it("should throw on SAPCLOUDJWT failure", async () => {
        client.authMethod =
          ProxyConstants.ProxyAuthMethods.PROXYAUTH_SAPCLOUDJWT;
        client._doProxySAPCloudAuthentication = async () => false;
        await assert.rejects(() => client._doAuthentication());
      });

      it("should throw on unsupported method", async () => {
        client.authMethod = 0x99;
        await assert.rejects(() => client._doAuthentication());
      });
    });

    describe("_doProxyUserPassAuthentication()", () => {
      let client;
      beforeEach(() => {
        client = new ProxyClient({});
        client._socket = createSocketMock();
        client._checkProxyAuthenticationResult = async () => true;
      });

      it("should succeed with username/password", async () => {
        client._options.proxyUserName = "user";
        client._options.proxyPassword = "pass";
        const result = await client._doProxyUserPassAuthentication();
        assert.strictEqual(result, true);
      });

      it("should use base64 SCP account", async () => {
        client._options.proxyScpAccount = "abc.xyz";
        await client._doProxyUserPassAuthentication();
        const written = client._socket.writes[0];
        const userLen = written[1];
        const actualUser = written.slice(2, 2 + userLen).toString();
        assert.strictEqual(actualUser, "1.YWJj.eHl6"); // Expected encoded SCP account
      });

      it("should throw if username too long", async () => {
        const longUser = "x".repeat(ProxyConstants.PROXY_MAX_USERID_SIZE + 1);
        client._options.proxyUserName = longUser;
        await assert.rejects(
          () => client._doProxyUserPassAuthentication(),
          /USERLONG/,
        );
      });

      it("should throw if password too long", async () => {
        client._options.proxyPassword = "x".repeat(256);
        await assert.rejects(
          () => client._doProxyUserPassAuthentication(),
          /PWDLONG/,
        );
      });
    });

    describe("_doProxySAPCloudAuthentication()", () => {
      let client;

      beforeEach(() => {
        client = new ProxyClient({
          proxyUserName: "user",
          proxyPassword: "pass",
        });
        client._socket = createSocketMock();
        client._checkProxyAuthenticationResult = async () => true;
      });

      it("should throw if username too long", async () => {
        client._options.proxyUserName = "x".repeat(
          ProxyConstants.PROXY_MAX_SAPCLOUDJWT_SIZE + 1,
        );
        await assert.rejects(
          () => client._doProxySAPCloudAuthentication(),
          /USERLONG/,
        );
      });

      it("should throw if password too long", async () => {
        client._options.proxyPassword = "x".repeat(1025);
        await assert.rejects(
          () => client._doProxySAPCloudAuthentication(),
          /PWDLONG/,
        );
      });

      it("should use base64 SCP account as password", async () => {
        client._options.proxyScpAccount = "someaccount";
        await client._doProxySAPCloudAuthentication();
        const buf = client._socket.writes[0];
        const userLen = buf.readUInt32BE(1);
        const passLen = buf[5 + userLen];
        const passBytes = buf.slice(6 + userLen, 6 + userLen + passLen);
        assert.deepStrictEqual(
          passBytes,
          Buffer.from("c29tZWFjY291bnQ=", "utf8"),
        );
      });

      it("should use empty password buffer if none set", async () => {
        client._options.proxyPassword = null;
        client._options.proxyScpAccount = null;
        await client._doProxySAPCloudAuthentication();
        const buf = client._socket.writes[0];
        const userLen = buf.readUInt32BE(1);
        const passLen = buf[5 + userLen];
        assert.strictEqual(passLen, 0);
      });
    });

    describe("_readBytes", () => {
      let client;
      beforeEach(() => {
        client = new ProxyClient({});
        client._socket = createSocketMock();
      });

      it("should resolve with buffer when enough data arrives in one chunk", async () => {
        const expectedLength = 5;
        const promise = client._readBytes(expectedLength);
        client._socket.emit("data", Buffer.from("hello"));
        const result = await promise;
        assert.strictEqual(result.toString(), "hello");
      });

      it("should resolve with buffer when data arrives in multiple chunks", async () => {
        const expectedLength = 5;
        const promise = client._readBytes(expectedLength);
        client._socket.emit("data", Buffer.from("he"));
        client._socket.emit("data", Buffer.from("ll"));
        client._socket.emit("data", Buffer.from("o"));
        const result = await promise;
        assert.strictEqual(result.toString(), "hello");
      });

      it("should reject on socket close event before enough data", async () => {
        const expectedLength = 5;
        const promise = client._readBytes(expectedLength);
        client._socket.emit("data", Buffer.from("he"));
        client._socket.emit("close");
        await assert.rejects(() => promise, /Socket closed/);
      });
    });

    describe("_sendConnectRequest", () => {
      let client;
      beforeEach(() => {
        client = new ProxyClient({ host: "myhana.example.com", port: 1234 });
        client._socket = createSocketMock();
      });

      it("should write correct SOCKS5 connect request buffer", async () => {
        await client._sendConnectRequest();
        const buf = client._socket.writes[0];
        const hostBuf = Buffer.from(client._options.host, "utf8");
        assert.strictEqual(buf[0], ProxyConstants.ProxyVersions.PROXY_SOCKSV5);
        assert.strictEqual(
          buf[1],
          ProxyConstants.ProxyCommandRequest.PROXYCMD_CONNECT,
        );
        assert.strictEqual(buf[2], 0x00);
        assert.strictEqual(buf[4], hostBuf.length);
        assert.deepStrictEqual(buf.slice(5, 5 + hostBuf.length), hostBuf);
        const portHigh = (client._options.port >> 8) & 0xff;
        const portLow = client._options.port & 0xff;
        assert.strictEqual(buf[5 + hostBuf.length], portHigh);
        assert.strictEqual(buf[6 + hostBuf.length], portLow);
        assert.strictEqual(buf.length, 7 + hostBuf.length);
      });

      it("should throw if host is too long", async () => {
        client._options.host = "a".repeat(
          ProxyConstants.PROXY_MAX_HANAHOST_SIZE + 1,
        );
        await assert.rejects(() => client._sendConnectRequest());
      });
    });

    describe("_readConnectReply", () => {
      let client;
      beforeEach(() => {
        client = new ProxyClient({
          proxyHostname: "proxy.local",
          proxyPort: 1080,
        });
        client._socket = createSocketMock();
      });

      it("should reject if buffer less than 2 bytes with not SOCKS5 error", async () => {
        const promise = client._readConnectReply();
        client._socket.emit("data", Buffer.from([0x05])); // only 1 byte
        await assert.rejects(promise);
      });

      it("should reject if SOCKS version is not 0x05", async () => {
        const promise = client._readConnectReply();
        client._socket.emit("data", Buffer.from([0x04, 0x00]));
        await assert.rejects(promise);
      });

      it("should reject on unknown reply code", async () => {
        const promise = client._readConnectReply();
        client._socket.emit("data", Buffer.from([0x05, 0xff]));
        await assert.rejects(promise);
      });
      it("should resolve with buffer on valid IPv4 reply", async () => {
        const reply = Buffer.from([
          ProxyConstants.ProxyVersions.PROXY_SOCKSV5,
          ProxyConstants.ProxyConnectResponse.PROXYRESP_SUCCESS,
          0x00,
          ProxyConstants.ProxyAddressTypes.PROXYNET_IPV4,
          127,
          0,
          0,
          1,
          0x04,
          0x38,
        ]);

        const promise = client._readConnectReply();
        client._socket.emit("data", reply);
        const result = await promise;
        assert.deepStrictEqual(result, reply);
      });
      it("should resolve with buffer on valid IPv6 reply", async () => {
        const ipv6Address = [
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x01,
        ];
        const reply = Buffer.from([
          ProxyConstants.ProxyVersions.PROXY_SOCKSV5,
          ProxyConstants.ProxyConnectResponse.PROXYRESP_SUCCESS,
          0x00,
          ProxyConstants.ProxyAddressTypes.PROXYNET_IPV6,
          ...ipv6Address,
          0x1f,
          0x90,
        ]);
        const promise = client._readConnectReply();
        client._socket.emit("data", reply);
        const result = await promise;
        assert.deepStrictEqual(result, reply);
      });

      it("should resolve with buffer on valid domain name reply", async () => {
        const domain = "proxy.local";
        const domainBuf = Buffer.from(domain, "utf8");
        const reply = Buffer.concat([
          Buffer.from([
            ProxyConstants.ProxyVersions.PROXY_SOCKSV5,
            ProxyConstants.ProxyConnectResponse.PROXYRESP_SUCCESS,
            0x00,
            ProxyConstants.ProxyAddressTypes.PROXYNET_DOMAINNAME,
            domainBuf.length,
          ]),
          domainBuf,
          Buffer.from([0x04, 0x38]),
        ]);

        const promise = client._readConnectReply();
        client._socket.emit("data", reply);
        const result = await promise;
        assert.deepStrictEqual(result, reply);
      });

      it("should wait for more data if buffer incomplete for domain name", async () => {
        const domain = "proxy.local";
        const domainBuf = Buffer.from(domain, "utf8");

        // Send partial data first (without full domain name)
        const partial = Buffer.from([
          ProxyConstants.ProxyVersions.PROXY_SOCKSV5,
          ProxyConstants.ProxyConnectResponse.PROXYRESP_SUCCESS,
          0x00,
          ProxyConstants.ProxyAddressTypes.PROXYNET_DOMAINNAME,
        ]);
        const promise = client._readConnectReply();
        client._socket.emit("data", partial);

        // Emit rest later
        const rest = Buffer.concat([
          Buffer.from([domainBuf.length]),
          domainBuf,
          Buffer.from([0x04, 0x38]),
        ]);
        client._socket.emit("data", rest);

        const result = await promise;
        assert.deepStrictEqual(result, Buffer.concat([partial, rest]));
      });

      it("should reject on unsupported address type", async () => {
        const promise = client._readConnectReply();
        const buf = Buffer.from([
          ProxyConstants.ProxyVersions.PROXY_SOCKSV5,
          ProxyConstants.ProxyConnectResponse.PROXYRESP_SUCCESS,
          0x00,
          0x05, // Unsupported address type
          0,
          0,
          0,
          0,
          0,
          0,
        ]);
        client._socket.emit("data", buf);
        await assert.rejects(promise);
      });

      it("should reject if socket closes before reply complete", async () => {
        const promise = client._readConnectReply();
        client._socket.emit("close");
        await assert.rejects(promise);
      });
    });
  });

  describe("_connectHttpProxy", () => {
    let originalRequest;
    beforeEach(() => {
      originalRequest = http.request;
    });
    afterEach(() => {
      http.request = originalRequest;
    });

    it("calls callback with socket on successful 200 CONNECT", (done) => {
      const fakeSocket = {};
      http.request = () => ({
        on: (event, cb) => {
          if (event === "connect") {
            process.nextTick(() => cb({ statusCode: 200 }, fakeSocket));
          }
        },
        once: () => {},
        removeListener: () => {},
        end: () => {},
      });
      const client = new ProxyClient({
        proxyHttp: true,
        proxyHostname: "proxyhost",
        host: "desthost",
        port: 1234,
      });
      client._connectHttpProxy((err, socket) => {
        if (err) return done(err);
        assert.strictEqual(socket, fakeSocket);
        done();
      });
    });

    it("calls callback with error on invalid response for CONNECT", (done) => {
      const fakeSocket = {
        destroy: () => {},
        end: () => {},
        on: () => {},
      };
      http.request = () => ({
        on: (event, cb) => {
          if (event === "connect") {
            process.nextTick(() =>
              cb({ statusCode: 403, statusMessage: "Forbidden" }, fakeSocket),
            );
          }
        },
        once: () => {},
        removeListener: () => {},
        end: () => {},
      });
      const client = new ProxyClient({
        proxyHttp: true,
        proxyHostname: "proxyhost",
        host: "desthost",
        port: 1234,
      });
      client._connectHttpProxy((err, socket) => {
        assert(err instanceof Error);
        done();
      });
    });
  });
});