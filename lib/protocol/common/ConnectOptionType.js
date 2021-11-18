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

var ConnectOption = require('./ConnectOption');
var TypeCode = require('./TypeCode');

var ConnectOptionType = module.exports = {};
ConnectOptionType[ConnectOption.CONNECTION_ID] = TypeCode.INT;
ConnectOptionType[ConnectOption.COMPLETE_ARRAY_EXECUTION] = TypeCode.BOOLEAN;
ConnectOptionType[ConnectOption.CLIENT_LOCALE] = TypeCode.STRING;
ConnectOptionType[ConnectOption.SUPPORTS_LARGE_BULK_OPERATIONS] = TypeCode.BOOLEAN;
ConnectOptionType[ConnectOption.LARGE_NUMBER_OF_PARAMETERS_SUPPORT] = TypeCode.BOOLEAN;
ConnectOptionType[ConnectOption.SYSTEM_ID] = TypeCode.STRING;
ConnectOptionType[ConnectOption.DATA_FORMAT_VERSION] = TypeCode.INT;
ConnectOptionType[ConnectOption.SELECT_FOR_UPDATE_SUPPORTED] = TypeCode.BOOLEAN;
ConnectOptionType[ConnectOption.CLIENT_DISTRIBUTION_MODE] = TypeCode.INT;
ConnectOptionType[ConnectOption.ENGINE_DATA_FORMAT_VERSION] = TypeCode.INT;
ConnectOptionType[ConnectOption.DISTRIBUTION_PROTOCOL_VERSION] = TypeCode.BOOLEAN;
ConnectOptionType[ConnectOption.SPLIT_BATCH_COMMANDS] = TypeCode.BOOLEAN;
ConnectOptionType[ConnectOption.USE_TRANSACTION_FLAGS_ONLY] = TypeCode.BOOLEAN;
ConnectOptionType[ConnectOption.ROW_AND_COLUMN_OPTIMIZED_FORMAT] = TypeCode.BOOLEAN;
ConnectOptionType[ConnectOption.IGNORE_UNKNOWN_PARTS] = TypeCode.BOOLEAN;
ConnectOptionType[ConnectOption.DATA_FORMAT_VERSION2] = TypeCode.INT;
ConnectOptionType[ConnectOption.OS_USER] = TypeCode.STRING;
ConnectOptionType[ConnectOption.REDIRECTION_TYPE] = TypeCode.INT;
ConnectOptionType[ConnectOption.REDIRECTED_HOST] = TypeCode.STRING;
ConnectOptionType[ConnectOption.REDIRECTED_PORT] = TypeCode.INT;
ConnectOptionType[ConnectOption.ENDPOINT_HOST] = TypeCode.STRING;
ConnectOptionType[ConnectOption.ENDPOINT_PORT] = TypeCode.INT;
ConnectOptionType[ConnectOption.ENDPOINT_LIST] = TypeCode.STRING;
