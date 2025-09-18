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

const net = require("net");
const util = require("../util");
const http = require("http");

const {
  DEFAULT_PROXY_PORT,
  PROXY_MAX_HANAHOST_SIZE,
  PROXY_MAX_PASSWORD_SIZE,
  PROXY_MAX_USERID_SIZE,
  PROXY_MAX_SAPCLOUDJWT_SIZE,
  ProxyVersions,
  ProxyAuthMethods,
  ProxyAuthRequestVersion,
  ProxyAuthResponse,
  ProxyCommandRequest,
  ProxyAddressTypes,
  ProxyConnectResponse,
  NetworkErrors,
} = require("./common/ProxyConstants");

class ProxyClient {
  constructor(options) {
    this._options = options;
    if (!this._options.proxyPort) {
      this._options.proxyPort = DEFAULT_PROXY_PORT;
    }
    this._socket = undefined; //this._socket is only used by SOCKS5
  }

  connect(cb) {
    if (util.getBooleanProperty(this._options.proxyHttp)) {
      this._connectHttpProxy(cb);
    } else {
      this._socket = new net.Socket();
      this._connectSocks5Proxy(cb);
    }
  }

  //HTTP proxy support
  _connectHttpProxy(cb) {
    const headers = {};
    if (this._options.proxyUserName || this._options.proxyPassword) {
      headers["Proxy-Authorization"] = `Basic ${Buffer.from(
        `${this._options.proxyUserName}:${this._options.proxyPassword}`,
      ).toString("base64")}`;
    }

    const req = http.request({
      host: this._options.proxyHostname,
      port: this._options.proxyPort,
      method: "CONNECT",
      path: `${this._options.host}:${this._options.port}`,
      headers: headers,
    });

    //TODO: Implement a timeout using the `communicationTimeout` option after it is merged
    req.on("connect", (res, socket) => {
      req.removeListener("error", onError);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return cb(null, socket);
      } else {
        socket.destroy();
        return cb(
          new Error(
            NetworkErrors.ERR_NETWORK_PROXY_CONNECT_FAIL +
              `: ${res.statusCode} ${res.statusMessage}`,
          ),
        );
      }
    });
    function onError(err) {
      return cb(err);
    }
    req.once("error", onError);
    req.end();
  }

  //SOCKS5 proxy support
  _connectSocks5Proxy(cb) {
    this._socket.connect(
      this._options.proxyPort,
      this._options.proxyHostname,
      () => {
        (async () => {
          try {
            await this._doHandshake();
            await this._doAuthentication();
            await this._sendConnectRequest();
            await this._readConnectReply();
            this._socket.removeListener("error", onError);
            return cb(null, this._socket);
          } catch (err) {
            this._socket.removeListener("error", onError);
            this._socket.destroy();
            return cb(err);
          }
        })();
      },
    );
    const onError = (err) => {
      this._socket.destroy();
      return cb(err);
    };
    this._socket.once("error", onError);
  }

  async _doHandshake() {
    const greeting = Buffer.from([
      ProxyVersions.PROXY_SOCKSV5, //VER
      4, //NMETHODS
      ProxyAuthMethods.PROXYAUTH_NOAUTH, //METHODS
      ProxyAuthMethods.PROXYAUTH_GSSAPI,
      ProxyAuthMethods.PROXYAUTH_USERPASS,
      ProxyAuthMethods.PROXYAUTH_SAPCLOUDJWT, //Custom 0x80 authentication
    ]);
    this._socket.write(greeting);
    const data = await this._readBytes(2);
    if (data[0] !== ProxyVersions.PROXY_SOCKSV5) {
      throw new Error(NetworkErrors.ERR_NETWORK_PROXY_NOTSOCKSV5);
    }
    this.authMethod = data[1];
  }

  async _doAuthentication() {
    switch (this.authMethod) {
      case ProxyAuthMethods.PROXYAUTH_NOAUTH:
        break;
      case ProxyAuthMethods.PROXYAUTH_USERPASS:
        if (!(await this._doProxyUserPassAuthentication())) {
          throw new Error(NetworkErrors.ERR_NETWORK_PROXY_AUTH_USERPASS_REJECT);
        }
        break;
      case ProxyAuthMethods.PROXYAUTH_SAPCLOUDJWT:
        if (!(await this._doProxySAPCloudAuthentication())) {
          throw new Error(NetworkErrors.ERR_NETWORK_PROXY_AUTH_SAPCLOUD_REJECT);
        }
        break;
      default:
        throw new Error(NetworkErrors.ERR_NETWORK_PROXY_AUTH_UNSUPPORTED);
    }
  }

  async _sendConnectRequest() {
    const hostBuf = Buffer.from(this._options.host, "utf8");
    if (hostBuf.length > PROXY_MAX_HANAHOST_SIZE) {
      throw new Error(NetworkErrors.ERR_NETWORK_PROXY_HANA_HOSTNAME_TOO_LONG);
    }
    const req = Buffer.alloc(7 + hostBuf.length);
    req[0] = ProxyVersions.PROXY_SOCKSV5; //VER
    req[1] = ProxyCommandRequest.PROXYCMD_CONNECT; //CMD
    req[2] = 0x00; //RSV
    req[3] = ProxyAddressTypes.PROXYNET_DOMAINNAME; //ATYP
    req[4] = hostBuf.length; //LEN
    hostBuf.copy(req, 5); //DST.ADDR
    req[5 + hostBuf.length] = (this._options.port >> 8) & 0xff; //DST.PORT (hi)
    req[6 + hostBuf.length] = this._options.port & 0xff; //DST.PORT (lo)
    this._socket.write(req);
  }

  // TODO: Implement a timeout for this function using the `communicationTimeout` option after it is merged
  _readConnectReply() {
    return new Promise((resolve, reject) => {
      let buffers = [];
      let totalLength = 0;

      const onData = (chunk) => {
        buffers.push(chunk);
        totalLength += chunk.length;
        const buffer = Buffer.concat(buffers, totalLength);
        if (buffer.length < 2) {
          cleanup();
          reject(
            new Error(
              `${NetworkErrors.ERR_NETWORK_PROXY_NOTSOCKSV5}: ${this._options.proxyHostname}:${this._options.proxyPort}`,
            ),
          );
          return;
        }
        if (buffer[0] !== ProxyVersions.PROXY_SOCKSV5) {
          cleanup();
          reject(new Error(NetworkErrors.ERR_NETWORK_PROXY_NOTSOCKSV5));
          return;
        }
        const rep = buffer[1];
        if (rep !== ProxyConnectResponse.PROXYRESP_SUCCESS) {
          const errorMap = {
            [ProxyConnectResponse.PROXYRESP_SOCKSSERVER_FAIL]:
              NetworkErrors.ERR_NETWORK_PROXY_CONNECT_SOCKSSERVER_FAIL,
            [ProxyConnectResponse.PROXYRESP_RULESET]:
              NetworkErrors.ERR_NETWORK_PROXY_CONNECT_RULESET,
            [ProxyConnectResponse.PROXYRESP_NET_UNREACHABLE]:
              NetworkErrors.ERR_NETWORK_PROXY_CONNECT_NET_UNREACHABLE,
            [ProxyConnectResponse.PROXYRESP_HOST_UNREACHABLE]:
              NetworkErrors.ERR_NETWORK_PROXY_CONNECT_HOST_UNREACHABLE,
            [ProxyConnectResponse.PROXYRESP_CONN_REFUSED]:
              NetworkErrors.ERR_NETWORK_PROXY_CONNECT_CONN_REFUSED,
            [ProxyConnectResponse.PROXYRESP_TTL_EXPIRED]:
              NetworkErrors.ERR_NETWORK_PROXY_CONNECT_TTL_EXPIRED,
            [ProxyConnectResponse.PROXYRESP_CMD_UNSUPPORTED]:
              NetworkErrors.ERR_NETWORK_PROXY_CONNECT_CMD_UNSUPPORTED,
            [ProxyConnectResponse.PROXYRESP_BAD_ADDRESS_TYPE]:
              NetworkErrors.ERR_NETWORK_PROXY_CONNECT_BAD_ADDRESS_TYPE,
          };
          cleanup();
          reject(
            new Error(
              errorMap[rep] || NetworkErrors.ERR_NETWORK_PROXY_CONNECT_FAIL,
            ),
          );
          return;
        }

        if (buffer.length < 6) return;

        const atyp = buffer[3];
        const SOCKS5_HEADER_LENGTH = 4; // VER (1) + REP (1) + RSV (1) + ATYP (1)
        const PORT_LENGTH = 2;
        const DOMAIN_LENGTH_FIELD_SIZE = 1;
        let expectedLength;
        if (atyp === ProxyAddressTypes.PROXYNET_IPV4) {
          expectedLength = SOCKS5_HEADER_LENGTH + 4 + PORT_LENGTH;
        } else if (atyp === ProxyAddressTypes.PROXYNET_DOMAINNAME) {
          expectedLength =
            SOCKS5_HEADER_LENGTH +
            DOMAIN_LENGTH_FIELD_SIZE +
            buffer[4] +
            PORT_LENGTH;
        } else if (atyp === ProxyAddressTypes.PROXYNET_IPV6) {
          expectedLength = SOCKS5_HEADER_LENGTH + 16 + PORT_LENGTH;
        } else {
          cleanup();
          reject(
            new Error(NetworkErrors.ERR_NETWORK_PROXY_CONNECT_BAD_ADDRESS_TYPE),
          );
          return;
        }
        if (buffer.length >= expectedLength) {
          cleanup();
          resolve(buffer.subarray(0, expectedLength));
          return;
        }
      };
      const onClose = () => {
        cleanup();
        reject(new Error("Socket closed"));
      };
      const cleanup = () => {
        this._socket.removeListener("data", onData);
        this._socket.removeListener("close", onClose);
      };
      this._socket.on("data", onData);
      this._socket.once("close", onClose);
    });
  }

  async _doProxyUserPassAuthentication() {
    let userBuf;
    if (this._options.proxyScpAccount) {
      const [user, pass] = this._options.proxyScpAccount.split(".");
      const encodedUser = Buffer.from(user, "utf8").toString("base64");
      const encodedPass = pass
        ? "." + Buffer.from(pass, "utf8").toString("base64")
        : "";
      userBuf = Buffer.from(`1.${encodedUser}${encodedPass}`, "utf8");
    } else {
      userBuf = Buffer.from(this._options.proxyUserName || "", "utf8");
    }
    const passBuf = Buffer.from(this._options.proxyPassword || "", "utf8");

    if (userBuf.length > PROXY_MAX_USERID_SIZE) {
      throw new Error(NetworkErrors.ERR_NETWORK_PROXY_AUTH_USERPASS_USERLONG);
    }
    if (passBuf.length > PROXY_MAX_PASSWORD_SIZE) {
      throw new Error(NetworkErrors.ERR_NETWORK_PROXY_AUTH_USERPASS_PWDLONG);
    }

    const buf = Buffer.alloc(3 + userBuf.length + passBuf.length);
    buf[0] = ProxyAuthRequestVersion.PROXYREQ_VERSION1;
    buf[1] = userBuf.length;
    userBuf.copy(buf, 2);
    buf[2 + userBuf.length] = passBuf.length;
    passBuf.copy(buf, 3 + userBuf.length);
    this._socket.write(buf);

    return await this._checkProxyAuthenticationResult();
  }

  async _doProxySAPCloudAuthentication() {
    const userBuf = Buffer.from(this._options.proxyUserName, "utf8");
    let passBuf = this._options.proxyScpAccount
      ? Buffer.from(
          Buffer.from(this._options.proxyScpAccount, "utf8").toString("base64"),
        )
      : this._options.proxyPassword
        ? Buffer.from(this._options.proxyPassword, "utf8")
        : Buffer.alloc(0);

    if (userBuf.length > PROXY_MAX_SAPCLOUDJWT_SIZE) {
      //512K bytes
      throw new Error(NetworkErrors.ERR_NETWORK_PROXY_AUTH_SAPCLOUD_USERLONG);
    }
    if (passBuf.length > PROXY_MAX_PASSWORD_SIZE) {
      //255 bytes
      throw new Error(NetworkErrors.ERR_NETWORK_PROXY_AUTH_SAPCLOUD_PWDLONG);
    }

    const authRequestSize = 6 + userBuf.length + passBuf.length;
    const authBuf = Buffer.alloc(authRequestSize);
    authBuf[0] = ProxyAuthRequestVersion.PROXYREQ_VERSION1;
    authBuf.writeUInt32BE(userBuf.length, 1);
    userBuf.copy(authBuf, 5);
    authBuf[5 + userBuf.length] = passBuf.length;
    if (passBuf.length > 0) {
      passBuf.copy(authBuf, 6 + userBuf.length);
    }
    this._socket.write(authBuf);
    return await this._checkProxyAuthenticationResult();
  }

  async _checkProxyAuthenticationResult() {
    const data = await this._readBytes(2);
    return (
      data.length === 2 &&
      data[0] === ProxyAuthRequestVersion.PROXYREQ_VERSION1 &&
      data[1] === ProxyAuthResponse.PROXYAUTHRESP_SUCCESS
    );
  }

  // TODO: Implement a timeout for this function using the `communicationTimeout` option after it is merged
  _readBytes(expectedLength) {
    return new Promise((resolve, reject) => {
      let buffers = [];
      let totalLength = 0;
      const onData = (chunk) => {
        buffers.push(chunk);
        totalLength += chunk.length;
        if (totalLength >= expectedLength) {
          cleanup();
          resolve(Buffer.concat(buffers, totalLength));
        }
      };
      const onClose = () => {
        cleanup();
        reject(new Error("Socket closed"));
      };
      const cleanup = () => {
        this._socket.removeListener("data", onData);
        this._socket.removeListener("close", onClose);
      };
      this._socket.on("data", onData);
      this._socket.once("close", onClose);
    });
  }
}

module.exports = {
  ProxyClient,
};
