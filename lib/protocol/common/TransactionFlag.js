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

module.exports = {
  ROLLED_BACK: 0,
  COMMITTED: 1,
  NEW_ISOLATION_LEVEL: 2,
  DDL_COMMIT_MODE_CHANGED: 3,
  WRITE_TRANSACTION_STARTED: 4,
  NO_WRITE_TRANSACTION_STARTED: 5,
  SESSION_CLOSING_TRANSACTION_ERRROR: 6
};