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

var net = require('net');
var tls = require('tls');

exports.createSocket = net.connect;
exports.createSecureSocket = tls.connect;
exports.connect = function connect(options, cb) {
  options.allowHalfOpen = false;
  var createSocket;
  if ('key' in options || 'cert' in options || 'ca' in options || 'pfx' in
    options) {
    createSocket = exports.createSecureSocket;
  } else {
    createSocket = exports.createSocket;
  }
  var socket = createSocket(options, cb);
  socket.setNoDelay(true);
  return socket;
};