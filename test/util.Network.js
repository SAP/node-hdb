// Copyright 2026 SAP AG.
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

const NetworkUtil = require('../lib/util/Network');

describe('Util', function () {
  describe('#Network', function () {
    it('should return valid host and port', function (done) {
      const cases = [
        // Host only
        {input: 'myhost', host: 'myhost', port: 0},
        {input: 'h', host: 'h', port: 0},
        // Host and port
        {input: 'myHost2:32115', host: 'myHost2', port: 32115},
        {input: 'myHost4:1', host: 'myHost4', port: 1},
        {input: 'a1234567890abcdef:30015', host: 'a1234567890abcdef', port: 30015},
        {
          input: 'YKFL00540000A_amer.global.corp.sap:65535',
          host: 'YKFL00540000A_amer.global.corp.sap',
          port: 65535,
        },
        {
          input: 'YKFL00540000A-amer.global.corp.sap:65535',
          host: 'YKFL00540000A-amer.global.corp.sap',
          port: 65535,
        },
        // // IPv4
        {input: '127.0.0.1', host: '127.0.0.1', port: 0},
        {input: '127.0.0.1:30015', host: '127.0.0.1', port: 30015},
        {input: '255.255.255.255', host: '255.255.255.255', port: 0},
        {input: '255.255.255.255:30015', host: '255.255.255.255', port: 30015},
        // IPv6
        {input: '[::]:30115', host: '::', port: 30115},
        {input: '::1', host: '::1', port: 0},
        {input: '[::1]:30115', host: '::1', port: 30115},
        {
          input: '[2001:db8:85a3::8a2e:370:7334]:30215',
          host: '2001:db8:85a3::8a2e:370:7334',
          port: 30215,
        },
        {input: '[host]:30015', host: 'host', port: 30015},
        {input: '2001:db8:85a3::8a2e:370:7334', host: '2001:db8:85a3::8a2e:370:7334', port: 0},
        {input: '[2001:db8:85a3::8a2e:370:7334]', host: '2001:db8:85a3::8a2e:370:7334', port: 0},
        // Whitespace
        {input: ' \nhost2 \t', host: 'host2', port: 0},
        {input: ' \thost3:30015 \n', host: 'host3', port: 30015},
        {input: '\t [host4] \n ', host: 'host4', port: 0},
        {input: '\r [host4]:30415\t ', host: 'host4', port: 30415},
        // Internal whitespace (may fail for JS URL, but included for parity)
        {input: 'h :1', host: 'h ', port: 1},
        // IPv6 mapped
        {input: '::FFFF:192.168.0.1', host: '::FFFF:192.168.0.1', port: 0},
        {input: '::ffff:192.168.0.1', host: '::ffff:192.168.0.1', port: 0},
        {input: '::ffff:255.255.255.0', host: '::ffff:255.255.255.0', port: 0},
        {input: '[::ffff:255.255.255.0]:30015', host: '::ffff:255.255.255.0', port: 30015},
        {input: '[::ffff:255.255.255.0]:1', host: '::ffff:255.255.255.0', port: 1},
        {input: '::ffff:c0a8:8b32', host: '::ffff:c0a8:8b32', port: 0},
        {input: '[::ffff:c0a8:8b32]:2', host: '::ffff:c0a8:8b32', port: 2},
        // IPv6 mapped + whitespace
        {input: '      \n::FFFF:192.168.0.1      \r\t', host: '::FFFF:192.168.0.1', port: 0},
        {input: '       \n::ffff:192.168.0.1    \r\t', host: '::ffff:192.168.0.1', port: 0},
        {input: '      \n[::ffff:c0a8:8b32]:2       \t\r', host: '::ffff:c0a8:8b32', port: 2},
        {input: '       \n[::ffff:255.255.255.0]:1    \t\r', host: '::ffff:255.255.255.0', port: 1},
        // IPv6 with subnet
        {
          input: '2001:db8:85a3::8a2e:370:7334/64',
          host: '2001:db8:85a3::8a2e:370:7334/64',
          port: 0,
        },
        {
          input: '    \n\r\t2001:db8:85a3::8a2e:370:7334/64    \n\r\t',
          host: '2001:db8:85a3::8a2e:370:7334/64',
          port: 0,
        },
        {input: '::/64', host: '::/64', port: 0},
        {input: '    \n\r\t::/64    \n\r\t', host: '::/64', port: 0},
        {input: '::1/64', host: '::1/64', port: 0},
        {input: '    \n\r\t::/64    \n\r\t', host: '::/64', port: 0},
        // IPv6 with zone index
        {input: 'fe80::1ff:fe23:4567:890a%eth2', host: 'fe80::1ff:fe23:4567:890a%eth2', port: 0},
        {
          input: '    \n\r\tfe80::1ff:fe23:4567:890a%eth2    \n\r\t',
          host: 'fe80::1ff:fe23:4567:890a%eth2',
          port: 0,
        },
        // IPv6 with subnet in brackets
        {
          input: '[2001:db8:85a3::8a2e:370:7334/64]',
          host: '2001:db8:85a3::8a2e:370:7334/64',
          port: 0,
        },
        {
          input: '    \n\r\t[2001:db8:85a3::8a2e:370:7334/64]    \n\r\t',
          host: '2001:db8:85a3::8a2e:370:7334/64',
          port: 0,
        },
        {input: '[::/64]', host: '::/64', port: 0},
        {input: '    \n\r\t[::/64]    \n\r\t', host: '::/64', port: 0},
        {input: '[::1/64]', host: '::1/64', port: 0},
        {input: '    \n\r\t[::/64]    \n\r\t', host: '::/64', port: 0},
        {input: '[fe80::1ff:fe23:4567:890a%eth2]', host: 'fe80::1ff:fe23:4567:890a%eth2', port: 0},
        {
          input: '    \n\r\t[fe80::1ff:fe23:4567:890a%eth2]    \n\r\t',
          host: 'fe80::1ff:fe23:4567:890a%eth2',
          port: 0,
        },
      ];
      cases.forEach(({input, host, port}) => {
        const r = NetworkUtil.splitAddressStr(input);
        const errMsg = `Test failed with input '${input}'`;
        r.valid.should.equal(true, errMsg);
        r.parsedHost.should.equal(host, errMsg);
        r.parsedPort.should.equal(port, errMsg);
      });
      done();
    });

    it('should return invalid', function (done) {
      const cases = [
        {input: {str: null, len: 0}, host: '', port: 0},
        {input: '', host: '', port: 0},
        {input: ':7', host: '', port: 7},
        {input: 'host  \r\n\tname', host: 'host  \r\n\tname', port: 0},
        {input: 'host  \r\n\tname:30015', host: 'host  \r\n\tname', port: 30015},
        {input: 'host[]name', host: 'host[]name', port: 0},
        {input: 'host[]name:30015', host: 'host[]name', port: 30015},
        {input: 'host\\name', host: 'host\\name', port: 0},
        {input: 'host\\name:30015', host: 'host\\name', port: 30015},
        {input: '[]', host: '', port: 0},
        {input: '[]:14', host: '', port: 14},
        // non ascii
        {input: 'ho\xffst:123', host: 'ho\xffst', port: 123},
        {input: 'ho\x80st:1234', host: 'ho\x80st', port: 1234},
        // extra colons
        {input: 'ho:st:30015', host: 'ho:st:30015', port: 0},
        {input: '::FFXF:192.168.1.0', host: '::FFXF:192.168.1.0', port: 0},
        {input: '::FFXF:8000:8000', host: '::FFXF:8000:8000', port: 0},
        {input: ':::FFXF:8000:8000', host: ':::FFXF:8000:8000', port: 0},
        {input: '[2001:db8:85a3::8a2e:370:7335', host: '[2001:db8:85a3::8a2e:370:7335', port: 0},
        {
          input: '[2001:db8:85a3::8a2e:370:7334]:300:15',
          host: '2001:db8:85a3::8a2e:370:7334',
          port: 300,
        },
        {
          input: '[2001:db8:85a3::8a2e:370:7331]1234',
          host: '2001:db8:85a3::8a2e:370:7331',
          port: 0,
        },
        // internal whitespace
        {input: 'h2: 2', host: 'h2', port: 2},
        {input: 'host \r\n\tname\r\n\tspace', host: 'host \r\n\tname\r\n\tspace', port: 0},
        {input: '[host \r\n\tname\r\n\tspace]', host: 'host \r\n\tname\r\n\tspace', port: 0},
        {input: 'host \r\n\tname\r\n\tspace: 2', host: 'host \r\n\tname\r\n\tspace', port: 2},
        {input: '[host \r\n\tname\r\n\tspace]: 2', host: 'host \r\n\tname\r\n\tspace', port: 2},
        {input: '[::1]: 3', host: '::1', port: 3},
        {input: '[::1] :4', host: '::1', port: 0},
        // invalid port number
        {input: 'host:-30015', host: 'host', port: 0},
        {input: 'myHost3:0', host: 'myHost3', port: 0},
        {input: 'host:65536', host: 'host', port: 0},
        {input: 'host2:99999999', host: 'host2', port: 0},
        {input: 'host3:9999999999999999', host: 'host3', port: 0},
        // extra [ or ]
        {
          input: '[[2001:db8:85a3::8a2e:370:7331]]:1234',
          host: '[2001:db8:85a3::8a2e:370:7331]',
          port: 1234,
        },
        {input: '[[::1]:1', host: '[::1', port: 1},
        {input: '[::1]]:2', host: '::1]', port: 2},
        {input: 'h[ost:3', host: 'h[ost', port: 3},
        {input: 'host]:4', host: 'host]', port: 4},
        {input: 'host:5[3', host: 'host', port: 5},
        {
          input: '2001:db8:85a3:: \n\r\t8a2e:370:7334/64',
          host: '2001:db8:85a3:: \n\r\t8a2e:370:7334/64',
          port: 0,
        },
        {
          input: '2001:db8:85a3::8a2e:370:7334//64',
          host: '2001:db8:85a3::8a2e:370:7334//64',
          port: 0,
        },
        {input: ':: \n\r\t/64', host: ':: \n\r\t/64', port: 0},
        {input: ':://64', host: ':://64', port: 0},
        {input: '::  \n\r\t1/64', host: '::  \n\r\t1/64', port: 0},
        {input: '::1//64', host: '::1//64', port: 0},
        {
          input: 'fe80::1ff:fe23:  \n\r\t4567:890a%eth2',
          host: 'fe80::1ff:fe23:  \n\r\t4567:890a%eth2',
          port: 0,
        },
        {input: 'fe80::1ff:fe23:4567:890a%%eth2', host: 'fe80::1ff:fe23:4567:890a%%eth2', port: 0},
        {
          input: '[2001:db8:85a3:: \n\r\t8a2e:370:7334/64]',
          host: '2001:db8:85a3:: \n\r\t8a2e:370:7334/64',
          port: 0,
        },
        {
          input: '[2001:db8:85a3::8a2e:370:7334//64]',
          host: '2001:db8:85a3::8a2e:370:7334//64',
          port: 0,
        },
        {input: '[:: \n\r\t/64]', host: ':: \n\r\t/64', port: 0},
        {input: '[:://64]', host: ':://64', port: 0},
        {input: '[::  \n\r\t1/64]', host: '::  \n\r\t1/64', port: 0},
        {input: '[::1//64]', host: '::1//64', port: 0},
        {
          input: '[fe80::1ff:fe23:  \n\r\t4567:890a%eth2]',
          host: 'fe80::1ff:fe23:  \n\r\t4567:890a%eth2',
          port: 0,
        },
        {
          input: '[fe80::1ff:fe23:  \n\r\t4567:890a%eth2]:30015',
          host: 'fe80::1ff:fe23:  \n\r\t4567:890a%eth2',
          port: 30015,
        },
        {
          input: '[fe80::1ff:fe23:4567:890a%%eth2]',
          host: 'fe80::1ff:fe23:4567:890a%%eth2',
          port: 0,
        },
        {input: '192.168.0.1%eth2', host: '192.168.0.1%eth2', port: 0},
        {input: '192.168.0.1%eth2:30015', host: '192.168.0.1%eth2', port: 30015},
      ];
      cases.forEach(({input, host, port}) => {
        const r = NetworkUtil.splitAddressStr(input);
        const errMsg = `Test failed with input '${input}'`;
        r.valid.should.equal(false, errMsg);
        r.parsedHost.should.equal(host, errMsg);
        r.parsedPort.should.equal(port, errMsg);
      });
      done();
    });
  });
});
