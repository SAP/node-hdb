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
  COMMAND: 3,
  RESULT_SET: 5,
  ERROR: 6,
  STATEMENT_ID: 10,
  TRANSACTION_ID: 11,
  ROWS_AFFECTED: 12,
  RESULT_SET_ID: 13,
  TOPOLOGY_INFORMATION: 15,
  TABLE_LOCATION: 16,
  READ_LOB_REQUEST: 17,
  READ_LOB_REPLY: 18,
  TABLE_NAME: 19,
  /*
  ABAP_ISTREAM: 25,
  ABAP_OSTREAM: 26,
  */
  COMMAND_INFO: 27,
  WRITE_LOB_REQUEST: 28,
  CLIENT_CONTEXT: 29,
  WRITE_LOB_REPLY: 30,
  PARAMETERS: 32,
  AUTHENTICATION: 33,
  SESSION_CONTEXT: 34,
  CLIENT_ID: 35,
  STATEMENT_CONTEXT: 39,
  PARTITION_INFORMATION: 40,
  OUTPUT_PARAMETERS: 41,
  CONNECT_OPTIONS: 42,
  COMMIT_OPTIONS: 43,
  FETCH_OPTIONS: 44,
  FETCH_SIZE: 45,
  PARAMETER_METADATA: 47,
  RESULT_SET_METADATA: 48,
  FIND_LOB_REQUEST: 49,
  FIND_LOB_REPLY: 50,
  /*
  ITAB_SHM: 51,
  ITAB_CHUNK_METADATA: 53,
  ITAB_METADATA: 55,
  ITAB_RESULT_CHUNK: 56,
  */
  CLIENT_INFO: 57,
  /*
  STREAM_DATA: 58,
  OSTREAM_RESULT: 59,
  FDA_REQUEST_METADATA: 60,
  FDA_REPLY_METADATA: 61,
  BATCH_PREPARE: 62,
  BATCH_EXECUTE: 63,
  */
  TRANSACTION_FLAGS: 64,
  DB_CONNECT_INFO: 67
};
