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

var Segment = require('./Segment');
var data = require('../data');
var common = require('../common');
var MessageType = common.MessageType;
var PartKind = common.PartKind;

module.exports = function connect(method, options) {
  var segment = new Segment(MessageType.CONNECT);

  // authentication
  segment.add({
    kind: PartKind.AUTHENTICATION,
    module: method.Connect
  }, options.authentication);

  // clientId
  segment.add(PartKind.CLIENT_ID, options.clientId);

  // connectOptions
  var connectOptions;
  if (options.connectOptions) {
    connectOptions = options.connectOptions;
  } else {
    connectOptions = data.ConnectOptions.getDefaultConnectOptions();
  }
  segment.add(PartKind.CONNECT_OPTIONS, connectOptions);

  return segment;
};