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
  NIL: 0,
  DDL: 1,
  INSERT: 2,
  UPDATE: 3,
  DELETE: 4,
  SELECT: 5,
  SELECT_FOR_UPDATE: 6,
  EXPLAIN: 7,
  DB_PROCEDURE_CALL: 8,
  DB_PROCEDURE_CALL_WITH_RESULT: 9,
  FETCH: 10,
  COMMIT: 11,
  ROLLBACK: 12,
  SAVEPOINT: 13,
  CONNECT: 14,
  WRITE_LOB: 15,
  READ_LOB: 16,
  PING: 17,
  DISCONNECT: 18,
  CLOSE_CURSOR: 19,
  FIND_LOB: 20,
  ABAP_STREAM: 21,
  XA_START: 22,
  XA_JOIN: 23
};