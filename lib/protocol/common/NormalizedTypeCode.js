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

var TypeCode = require('./TypeCode');

var NormalizedTypeCode = module.exports = {};
// TinyInt
NormalizedTypeCode[TypeCode.TINYINT] = TypeCode.TINYINT;
// SmallInt
NormalizedTypeCode[TypeCode.SMALLINT] = TypeCode.SMALLINT;
// Int
NormalizedTypeCode[TypeCode.INT] = TypeCode.INT;
// BigInt
NormalizedTypeCode[TypeCode.BIGINT] = TypeCode.BIGINT;
// Double
NormalizedTypeCode[TypeCode.DOUBLE] = TypeCode.DOUBLE;
// Real
NormalizedTypeCode[TypeCode.REAL] = TypeCode.REAL;
// Decimal
NormalizedTypeCode[TypeCode.DECIMAL] = TypeCode.DECIMAL;
// String
NormalizedTypeCode[TypeCode.STRING] = TypeCode.STRING;
NormalizedTypeCode[TypeCode.VARCHAR1] = TypeCode.STRING;
NormalizedTypeCode[TypeCode.VARCHAR2] = TypeCode.STRING;
NormalizedTypeCode[TypeCode.CHAR] = TypeCode.STRING;
NormalizedTypeCode[TypeCode.SHORTTEXT] = TypeCode.STRING;
NormalizedTypeCode[TypeCode.ALPHANUM] = TypeCode.STRING;
// NString
NormalizedTypeCode[TypeCode.NCHAR] = TypeCode.NSTRING;
NormalizedTypeCode[TypeCode.NVARCHAR] = TypeCode.NSTRING;
NormalizedTypeCode[TypeCode.NSTRING] = TypeCode.NSTRING;
// Binary
NormalizedTypeCode[TypeCode.BINARY] = TypeCode.BINARY;
NormalizedTypeCode[TypeCode.VARBINARY] = TypeCode.BINARY;
NormalizedTypeCode[TypeCode.BSTRING] = TypeCode.BINARY;
// BLob
NormalizedTypeCode[TypeCode.BLOB] = TypeCode.BLOB;
NormalizedTypeCode[TypeCode.LOCATOR] = TypeCode.BLOB;
// Clob
NormalizedTypeCode[TypeCode.CLOB] = TypeCode.CLOB;
// NCLob
NormalizedTypeCode[TypeCode.NCLOB] = TypeCode.NCLOB;
NormalizedTypeCode[TypeCode.NLOCATOR] = TypeCode.NCLOB;
NormalizedTypeCode[TypeCode.TEXT] = TypeCode.NCLOB;
// Date
NormalizedTypeCode[TypeCode.DATE] = TypeCode.DATE;
// Time
NormalizedTypeCode[TypeCode.TIME] = TypeCode.TIME;
// Timestamp
NormalizedTypeCode[TypeCode.TIMESTAMP] = TypeCode.TIMESTAMP;
// DayDate
NormalizedTypeCode[TypeCode.DAYDATE] = TypeCode.DAYDATE;
// SecondTime
NormalizedTypeCode[TypeCode.SECONDTIME] = TypeCode.SECONDTIME;
// LongDate
NormalizedTypeCode[TypeCode.LONGDATE] = TypeCode.LONGDATE;
// SecondDate
NormalizedTypeCode[TypeCode.SECONDDATE] = TypeCode.SECONDDATE;