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

exports.AUTHREQUEST = {
  packet: new Buffer(
      '0000000000000000' + // Session id
      '00000000' + // Packet count
      '70010000' + // Varpart length
      'e0ff0f00' + // Varpart size
      '0100' + // Number of segments
      '00000000000000000000' + // Extra options
      '70010000' + // Segment length
      '00000000' + // Segment offset
      '0300' + // Number of parts
      '0100' + // Segment number
      '01' + // Segment kind
      '41' + // Message type
      '00' + // Auto commit
      '00' + // Command options
      '0000000000000000' + // Filler
      '1d' + // Part kind
      '00' + // Part attributes
      '0300' + // Argument count
      '00000000' + // Big argument count
      '28000000' + // Part buffer length
      'b8ff0f00' + // Buffer size
      '011d1200322e32332e32342e31373333353138383135021d060053514c444243031d04006e6f6465' + // Part data
      '43' + // Part kind
      '00' + // Part attributes
      '0000' + // Argument count
      '00000000' + // Big argument count
      '00000000' + // Part buffer length
      '80ff0f00' + // Buffer size
      '21' + // Part kind
      '00' + // Part attributes
      '0100' + // Argument count
      '00000000' + // Big argument count
      'fb000000' + // Part buffer length
      '70ff0f00' + // Buffer size
      '00000000000000000000000000000000000000000000000000000000000000000000000000000000' +
      '00000000000000000000000000000000000000000000000000000000000000000000000000000000' +
      '00000000000000000000000000000000000000000000000000000000000000000000000000000000' +
      '00000000000000000000000000000000000000000000000000000000000000000000000000000000' +
      '00000000000000000000000000000000000000000000000000000000000000000000000000000000' + 
      '00000000000000000000000000000000000000000000000000000000000000000000000000000000' + 
      '0000000000000000000000', 'hex'), // Part data
  trace: [
    "<REQUEST>",
    "  SESSION ID: 0 PACKET COUNT: 0",
    "  VARPART LENGTH: 368 VARPART SIZE: 1048544",
    "  NO OF SEGMENTS: 1",
    "    SEGMENT 1 OF 1 MESSAGE TYPE: AUTHENTICATE",
    "      LENGTH: 368 OFFSET: 0",
    "      NO OF PARTS: 3 NUMBER: 1",
    "      KIND: REQUEST AUTOCOMMIT: 0",
    "      OPTIONS: ()",
    "      PART 1 CLIENT_CONTEXT",
    "        LENGTH: 40 SIZE: 1048504",
    "        ARGUMENTS: 3",
    "        ATTRIBUTES: ()",
    "        DATA:",
    "      0|01 1D 12 00 32 2E 32 33 2E 32 34 2E 31 37 33 33|....2.23.24.1733|",
    "     10|35 31 38 38 31 35 02 1D 06 00 53 51 4C 44 42 43|518815....SQLDBC|",
    "     20|03 1D 04 00 6E 6F 64 65                        |....node        |",
    "      PART 2 DB_CONNECT_INFO",
    "        LENGTH: 0 SIZE: 1048448",
    "        ARGUMENTS: 0",
    "        ATTRIBUTES: ()",
    "        DATA:",
    "      PART 3 AUTHENTICATION",
    "        LENGTH: 251 SIZE: 1048432",
    "        ARGUMENTS: 1",
    "        ATTRIBUTES: ()",
    "        DATA:",
    "        [AUTHENTICATION INFORMATION]",
    "</REQUEST>"
  ],
};

exports.REPLY = {
    packet: new Buffer(
        '54d871a5a3960300' + // Session id
        '05000000' + // Packet count
        '68010000' + // Varpart length
        '10750000' + // Varpart size
        '0100' + // Number of segments
        '00000000000000000000' + // Extra options
        '68010000' + // Segment length
        '00000000' + // Segment offset
        '0300' + // Number of parts
        '0100' + // Segment number
        '02' + // Segment kind
        '00' + // Filler
        '0500' + // Function code
        '0000000000000000' + // Filler
        '0d' + // Part kind
        '00' + // Part attributes
        '0100' + // Argument count
        '00000000' + // Big argument count
        '08000000' + // Part buffer length
        '40010000' + // Buffer size
        'faa8000046170300' + // Part data
        '27' + // Part kind
        '00' + // Part attributes
        '0400' + // Argument count
        '00000000' + // Big argument count
        'd6000000' + // Part buffer length
        '28010000' + // Buffer size
        '0121b4000100000000000fd0920b0000000000002373000000000000a43d00000000000000000000' + 
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000fd0edfe0fd0ffffffffffffff7f000000000000000000000000000040b001000000' +
        '000000000000000000000000fce37115b7620100851299140204b6050000000000000704e1030000' +
        '00000000080468aa0000000000000000' + // Part data
        '05' + // Part kind
        '11' + // Part attributes
        '0200' + // Argument count
        '00000000' + // Big argument count
        '3a000000' + // Part buffer length
        '40000000' + // Buffer size
        '1a4865726520697320736f6d6520737472696e6720746f206164641e486572652069732061207365' + 
        '636f6e6420737472696e6720746f20616464000000000000', 'hex'), // Part data
    trace: [
        "<REPLY>",
        "  SESSION ID: 1010054529669204 PACKET COUNT: 5",
        "  VARPART LENGTH: 360 VARPART SIZE: 29968",
        "  NO OF SEGMENTS: 1",
        "    SEGMENT 1",
        "      LENGTH: 360 OFFSET: 0",
        "      NO OF PARTS: 3 NUMBER: 1",
        "      KIND: REPLY",
        "      FUNCTION CODE: SELECT",
        "      PART 1 RESULT_SET_ID",
        "        LENGTH: 8 SIZE: 320",
        "        ARGUMENTS: 1",
        "        ATTRIBUTES: ()",
        "        DATA:",
        "      0|FA A8 00 00 46 17 03 00                        |....F...        |",
        "      PART 2 STATEMENT_CONTEXT",
        "        LENGTH: 214 SIZE: 296",
        "        ARGUMENTS: 4",
        "        ATTRIBUTES: ()",
        "        DATA:",
        "      0|01 21 B4 00 01 00 00 00 00 00 0F D0 92 0B 00 00|.!..............|",
        "     10|00 00 00 00 23 73 00 00 00 00 00 00 A4 3D 00 00|....#s.......=..|",
        "     20|00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00|................|",
        "     30|00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00|................|",
        "     40|00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00|................|",
        "     50|00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00|................|",
        "     60|00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00|................|",
        "     70|00 00 00 00 00 00 00 00 00 00 00 00 00 00 0F D0|................|",
        "     80|ED FE 0F D0 FF FF FF FF FF FF FF 7F 00 00 00 00|...........\x7F....|",
        "     90|00 00 00 00 00 00 00 00 00 00 40 B0 01 00 00 00|..........@.....|",
        "     A0|00 00 00 00 00 00 00 00 00 00 00 00 FC E3 71 15|..............q.|",
        "     B0|B7 62 01 00 85 12 99 14 02 04 B6 05 00 00 00 00|.b..............|",
        "     C0|00 00 07 04 E1 03 00 00 00 00 00 00 08 04 68 AA|..............h.|",
        "     D0|00 00 00 00 00 00                              |......          |",
        "      PART 3 RESULT_SET",
        "        LENGTH: 58 SIZE: 64",
        "        ARGUMENTS: 2",
        "        ATTRIBUTES: (LAST|CLOSED)",
        "        DATA:",
        "      0|1A 48 65 72 65 20 69 73 20 73 6F 6D 65 20 73 74|.Here is some st|",
        "     10|72 69 6E 67 20 74 6F 20 61 64 64 1E 48 65 72 65|ring to add.Here|",
        "     20|20 69 73 20 61 20 73 65 63 6F 6E 64 20 73 74 72| is a second str|",
        "     30|69 6E 67 20 74 6F 20 61 64 64                  |ing to add      |",
        "</REPLY>",
    ]
}
