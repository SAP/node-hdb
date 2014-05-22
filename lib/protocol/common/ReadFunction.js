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

var ReadFunction = module.exports = {};

var READ_TINYINT = 'readTinyInt';
var READ_SMALLINT = 'readSmallInt';
var READ_INT = 'readInt';
var READ_BIGINT = 'readBigInt';
var READ_STRING = 'readString';
var READ_BINARY = 'readBinary';
var READ_DATE = 'readDate';
var READ_DAYDATE = 'readDayDate';
var READ_TIME = 'readTime';
var READ_SECONDTIME = 'readSecondTime';
var READ_TIMESTAMP = 'readTimestamp';
var READ_LONGDATE = 'readLongDate';
var READ_SECONDDATE = 'readSecondDate';
var READ_BLOB = 'readBLob';
var READ_CLOB = 'readCLob';
var READ_NCLOB = 'readNCLob';
var READ_DOUBLE = 'readDouble';
var READ_FLOAT = 'readFloat';
var READ_DECIMAL = 'readDecimal';

ReadFunction[TypeCode.TINYINT] = READ_TINYINT;
ReadFunction[TypeCode.SMALLINT] = READ_SMALLINT;
ReadFunction[TypeCode.INT] = READ_INT;
ReadFunction[TypeCode.BIGINT] = READ_BIGINT;
ReadFunction[TypeCode.STRING] = READ_STRING;
ReadFunction[TypeCode.VARCHAR1] = READ_STRING;
ReadFunction[TypeCode.VARCHAR2] = READ_STRING;
ReadFunction[TypeCode.CHAR] = READ_STRING;
ReadFunction[TypeCode.NCHAR] = READ_STRING;
ReadFunction[TypeCode.NVARCHAR] = READ_STRING;
ReadFunction[TypeCode.NSTRING] = READ_STRING;
ReadFunction[TypeCode.SHORTTEXT] = READ_STRING;
ReadFunction[TypeCode.ALPHANUM] = READ_STRING;
ReadFunction[TypeCode.BINARY] = READ_BINARY;
ReadFunction[TypeCode.VARBINARY] = READ_BINARY;
ReadFunction[TypeCode.BSTRING] = READ_BINARY;
ReadFunction[TypeCode.DATE] = READ_DATE;
ReadFunction[TypeCode.TIME] = READ_TIME;
ReadFunction[TypeCode.TIMESTAMP] = READ_TIMESTAMP;
ReadFunction[TypeCode.DAYDATE] = READ_DAYDATE;
ReadFunction[TypeCode.SECONDTIME] = READ_SECONDTIME;
ReadFunction[TypeCode.LONGDATE] = READ_LONGDATE;
ReadFunction[TypeCode.SECONDDATE] = READ_SECONDDATE;
ReadFunction[TypeCode.BLOB] = READ_BLOB;
ReadFunction[TypeCode.LOCATOR] = READ_BLOB;
ReadFunction[TypeCode.CLOB] = READ_CLOB;
ReadFunction[TypeCode.NCLOB] = READ_NCLOB;
ReadFunction[TypeCode.NLOCATOR] = READ_NCLOB;
ReadFunction[TypeCode.TEXT] = READ_NCLOB;
ReadFunction[TypeCode.DOUBLE] = READ_DOUBLE;
ReadFunction[TypeCode.REAL] = READ_FLOAT;
ReadFunction[TypeCode.DECIMAL] = READ_DECIMAL;