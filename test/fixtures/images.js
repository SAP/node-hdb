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

var fs = require('fs');
var path = require('path');

module.exports = [{
  NAME: 'lobby.jpg',
  BDATA: fs.readFileSync(path.join(__dirname, 'img', 'lobby.jpg'))
}, {
  NAME: 'locked.png',
  BDATA: fs.readFileSync(path.join(__dirname, 'img', 'locked.png'))
}, {
  NAME: 'logo.png',
  BDATA: fs.readFileSync(path.join(__dirname, 'img', 'logo.png'))
}, {
  NAME: 'sap.jpg',
  BDATA: fs.readFileSync(path.join(__dirname, 'img', 'sap.jpg'))
}];