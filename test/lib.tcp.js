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

var tcp = require('../lib/protocol/tcp');
var tls = require('tls');
var createSocket = tcp.createSocket;
var createSecureSocket = tcp.createSecureSocket;
var socket = {
  setNoDelay: function setNoDelay(noDelay) {
    noDelay.should.equal(true);
  },
  setKeepAlive: function setKeepAlive(enable, time) {}
};
var digiCertRoots = [
    // DigiCert RSA4096 Root G5
    "-----BEGIN CERTIFICATE-----\n" +
    "MIIFXjCCA0agAwIBAgIQCL+ib5o/M2WirPCmOMQBcDANBgkqhkiG9w0BAQwFADBJ\n" +
    "MQswCQYDVQQGEwJVUzEXMBUGA1UEChMORGlnaUNlcnQsIEluYy4xITAfBgNVBAMT\n" +
    "GERpZ2lDZXJ0IFJTQTQwOTYgUm9vdCBHNTAeFw0yMTAxMTUwMDAwMDBaFw00NjAx\n" +
    "MTQyMzU5NTlaMEkxCzAJBgNVBAYTAlVTMRcwFQYDVQQKEw5EaWdpQ2VydCwgSW5j\n" +
    "LjEhMB8GA1UEAxMYRGlnaUNlcnQgUlNBNDA5NiBSb290IEc1MIICIjANBgkqhkiG\n" +
    "9w0BAQEFAAOCAg8AMIICCgKCAgEAqr4NsgZ9JvlH6uQb50JpuJnCue4ksUaQy1kk\n" +
    "UlQ1piTCX5EZyLZC1vNHZZVk54VlZ6mufABP4HgDUK3zf464EeeBYrGL3/JJJgne\n" +
    "Dxa82iibociXL5OQ2iAq44TU/6mesC2/tADemx/IoGNTaIVvTYXGqmP5jbI1dmJ0\n" +
    "A9yTmGgFns2QZd3SejGrJC1tQC6QP2NsLOv6HoBUjXkCkBSztU9O9YgEQ4DDSLMm\n" +
    "L6xRlTJVJS9BlrBWoQg73JgfcoUsd8qYzDj7jnLJbewF7O1NtzxbFFCF3Zf7WfeQ\n" +
    "EvQTv4NNgLIVZRGXYOXWXOYEtVDmcTO2IJOpaAA4zknbtFw7ctdFXFS/zTwBIx58\n" +
    "1vhpLKUACmwySLTecC06ExfBf2TL8zDtoT2WZ/GUtWBsW2lo9YIzCaK22fOFsm6g\n" +
    "lPDCxH2hLMpz9a7gUpyiZuYDzurf7RjUuWOL9+j/+7Nbj0PFr7d0lFA1Za7WL/GF\n" +
    "j1OhcPSNMl28lsMewgQEnAQPs11+iSDKXicNiUoSI7T2xN3YH/hoszb4HrzG94S2\n" +
    "6IpOiDA4wCbYcAoJOjQOa4ISlhwv5p6t2HE1gbGMBm70bmb/S0quvfD+11xfU7sy\n" +
    "PM1i0RSgKR8Q3qlyT7GtZOWDKo+L6oSV7pglmJqzcTzBp1DyrEJiMcKhkMbu4reK\n" +
    "qLW2GzsCAwEAAaNCMEAwHQYDVR0OBBYEFGJtt5FPxOqjYmCPoNC+tY8GfGgAMA4G\n" +
    "A1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBDAUAA4IC\n" +
    "AQBh6PsnbdbiuLMJr6rwsYJM/j0XiU0tFZ377tC7hOyEddtDE96Mn8cp74d0yxNw\n" +
    "gVYAdPyu9Nk63iIIUaWgXIJmtntMqdqPq6wcQZZm1p3eVua/TrGyXl/Aw27UwoSQ\n" +
    "9X2xuhbRKYrInenP0McZOz/P7vfhM65CyJjACJ7zWvPf1Cs7jqgoVhnHTnc8JVTc\n" +
    "uEhI0fknaj7sE6+yBYn9VV/zfY4NnAldLIp+hc744b8RPTKMWtd+PfQzWM+iBZij\n" +
    "s/vOib/9whbdbtyISQ0LoAP/50XpBMHp/aqddfi4H4eD2es501qny5isE4kA/G+V\n" +
    "TuF9EUZt9jhGoxOgLAH1Ys+/HFCRJ3Rdt+xHfNDRdct77tFNIwrDYKV3LYDaZw+O\n" +
    "a3YH8KYP6oSuHnm/CIraCfP07rU289R6Q7qUNeH6wTsblpmkV2PrtaiC9634d9d2\n" +
    "hvN2U1Zb/CZChM6fg5GRr/S+cBWApdjoabHYkVS4GbJi+aL6Ve0Ev7lEhuTP8ZsA\n" +
    "vxEPvrV0JFH/dzRj7EgjDugR63dt2sqCkb6khJNM2qH+zAaE6CHoVLrm0x1jPcJa\n" +
    "/ObJg55yZKmGWQCMwvcTg7bQpDHGrJGOe6QiVhPGdccjvItb/EY9/l1SKa+v6MnD\n" +
    "dkvoq0cC8poN0yyIgAeGwGMPAkyOBFN2uVhCb3wpcF2/Jw==\n" +
    "-----END CERTIFICATE-----\n",

    // DigiCert Global Root CA
    "-----BEGIN CERTIFICATE-----\n" +
    "MIIDrzCCApegAwIBAgIQCDvgVpBCRrGhdWrJWZHHSjANBgkqhkiG9w0BAQUFADBh\n" +
    "MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3\n" +
    "d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBD\n" +
    "QTAeFw0wNjExMTAwMDAwMDBaFw0zMTExMTAwMDAwMDBaMGExCzAJBgNVBAYTAlVT\n" +
    "MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j\n" +
    "b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IENBMIIBIjANBgkqhkiG\n" +
    "9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4jvhEXLeqKTTo1eqUKKPC3eQyaKl7hLOllsB\n" +
    "CSDMAZOnTjC3U/dDxGkAV53ijSLdhwZAAIEJzs4bg7/fzTtxRuLWZscFs3YnFo97\n" +
    "nh6Vfe63SKMI2tavegw5BmV/Sl0fvBf4q77uKNd0f3p4mVmFaG5cIzJLv07A6Fpt\n" +
    "43C/dxC//AH2hdmoRBBYMql1GNXRor5H4idq9Joz+EkIYIvUX7Q6hL+hqkpMfT7P\n" +
    "T19sdl6gSzeRntwi5m3OFBqOasv+zbMUZBfHWymeMr/y7vrTC0LUq7dBMtoM1O/4\n" +
    "gdW7jVg/tRvoSSiicNoxBN33shbyTApOB6jtSj1etX+jkMOvJwIDAQABo2MwYTAO\n" +
    "BgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUA95QNVbR\n" +
    "TLtm8KPiGxvDl7I90VUwHwYDVR0jBBgwFoAUA95QNVbRTLtm8KPiGxvDl7I90VUw\n" +
    "DQYJKoZIhvcNAQEFBQADggEBAMucN6pIExIK+t1EnE9SsPTfrgT1eXkIoyQY/Esr\n" +
    "hMAtudXH/vTBH1jLuG2cenTnmCmrEbXjcKChzUyImZOMkXDiqw8cvpOp/2PV5Adg\n" +
    "06O/nVsJ8dWO41P0jmP6P6fbtGbfYmbW0W5BjfIttep3Sp+dWOIrWcBAI+0tKIJF\n" +
    "PnlUkiaY4IBIqDfv8NZ5YBberOgOzW6sRBc4L0na4UU+Krk2U886UAb3LujEV0ls\n" +
    "YSEY1QSteDwsOoBrp+uvFRTp2InBuThs4pFsiv9kuXclVzDAGySj4dzp30d8tbQk\n" +
    "CAUw7C29C79Fv1C5qfPrmAESrciIxpg0X40KPMbp1ZWVbd4=\n" +
    "-----END CERTIFICATE-----\n"
];

describe('Lib', function () {

  describe('#tcp', function () {

    it('should create a secure connection', function (done) {
      tcp.createSecureSocket = function tlsConnect(options, cb) {
        tcp.createSecureSocket = createSecureSocket;
        options.allowHalfOpen.should.equal(false);
        options.servername.should.equal(options.host);
        process.nextTick(cb);
        return socket;
      };
      tcp.connect({
        pfx: true,
        host: 'localhost'
      }, done).should.equal(socket);
    });

    it('should override default servername', function (done) {
      tcp.createSecureSocket = function tlsConnect(options, cb) {
        tcp.createSecureSocket = createSecureSocket;
        options.allowHalfOpen.should.equal(false);
        options.servername.should.equal('customSNI');
        process.nextTick(cb);
        return socket;
      };
      tcp.connect({
        pfx: true,
        host: 'localhost',
        servername: 'customSNI'
      }, done).should.equal(socket);
    });

    it('should create a connection', function (done) {
      tcp.createSocket = function netConnect(options, cb) {
        tcp.createSocket = createSocket;
        options.allowHalfOpen.should.equal(false);
        process.nextTick(cb);
        return socket;
      };
      tcp.connect({}, done).should.equal(socket);
    });

    it('should fallback to default trusted CAs', function (done) {
      var testCase = 0;
      tcp.createSecureSocket = function tlsConnect(options, cb) {
        switch (testCase) {
          case 0:
            (options.ca === undefined).should.equal(true);
            break;
          case 1:
            options.ca[0].should.equal("DummyCert");
            options.ca[1].should.equal(digiCertRoots[0]);
            options.ca[2].should.equal(digiCertRoots[1]);
            break;
          case 2:
            options.ca[0].should.equal("DummyCert");
            options.ca[1].should.equal("DummyCert2");
            options.ca[2].should.equal(digiCertRoots[0]);
            options.ca[3].should.equal(digiCertRoots[1]);
            break;
          case 3:
            options.ca.should.equal("DummyCert");
            break;
          case 4:
            options.ca.length.should.equal(tls.rootCertificates.length + 1);
            for(var i = 0; i < tls.rootCertificates.length; ++i) {
              options.ca[i+1].should.equal(tls.rootCertificates[i]);
            }
          default:
            break;
        }
        process.nextTick(cb);
        return socket;
      }
      // testCase = 0
      tcp.connect({useTLS: true}, () => {
        ++testCase; // 1
        tcp.connect({ca: "DummyCert"}, () => {
          ++testCase; // 2
          tcp.connect({ca: ["DummyCert", "DummyCert2"], sslUseDigiCertRoots: true}, () => {
            ++testCase; // 3
            tcp.connect({ca: "DummyCert", sslUseDigiCertRoots: false}, () => {
              ++testCase; // 4
              tcp.connect({ca: ["DummyCert"], sslUseDefaultTrustStore: true}, () => {
                tcp.createSecureSocket = createSecureSocket;
                done();
              }).should.equal(socket);
            }).should.equal(socket);
          }).should.equal(socket);
        }).should.equal(socket);
      });
    });

  });
});
