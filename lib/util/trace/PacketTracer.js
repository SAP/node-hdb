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

var zeropad = require('../zeropad');
var bignum = require('../bignum');
var MessageType = require('../../protocol/common/MessageType');
var SegmentKind = require('../../protocol/common/SegmentKind');
var CommandOption = require('../../protocol/common/CommandOption');
var PartKind = require('../../protocol/common/PartKind');
var PartAttributes = require('../../protocol/common/ResultSetAttributes');
var FunctionCode = require('../../protocol/common/FunctionCode');

var MessageTypeMap = invertToMap(MessageType);
var SegmentKindMap = invertToMap(SegmentKind);
var CommandOptionMap = invertToMap(CommandOption);
var PartKindMap = invertToMap(PartKind);
var PartAttributesMap = invertToMap(PartAttributes);
var FunctionCodeMap = invertToMap(FunctionCode);

function invertToMap(object) {
  var map = new Map();
  Object.keys(object).forEach(key => {
    map.set(object[key], key);
  });
  return map;
}

/*
  The initializationRequestBuffer is formatted as
  0xff, 0xff, 0xff, 0xff,           // preamble
  4, 20, 0,                         // client version
  4,                                // request major version - 0x04
  1, 0,                             // request minor version - 0x01
  0,                                // reserved
  1,                                // number of options
  1, 1                              // option_id: 1 - endian, value: 01 - LE (00 - BE)
*/
function parseInitializationRequest(buffer) {
  var traceOutput = new LogWrapper();
  var log = traceOutput.log.bind(traceOutput);
  var logData = traceOutput.logData.bind(traceOutput);
  log(0, "<REQUEST>    " + getLocalTimestamp());
  log(4, `INFO REQUEST (${buffer.length} BYTES)`);
  var requestMajorVersion = buffer.readInt8(7);
  var requestMinorVersion = buffer.readInt16LE(8);
  log(2, `REQUEST PROTOCOL VERSION: ${requestMajorVersion}.${requestMinorVersion}`);
  var numOptions = buffer.readInt8(11);
  if (numOptions >= 1) {
    for (var i = 12; i < 12 + 2 * numOptions; i += 2) {
      if (buffer.readInt8(i) === 1) {
        if (buffer.readInt8(i + 1) === 1) {
          log(0, "ENDIAN: LE");
        } else if (buffer.readInt8(i + 1) === 0) {
          log(0, "ENDIAN: BE");
        }
      }
    }
  }
  traceOutput.indent += 2;
  logData(formatHexData(traceOutput.indent, buffer, 0, buffer.length));
  traceOutput.clearIndentLog('</REQUEST>');
  return traceOutput.logStr;
}
exports.parseInitializationRequest = parseInitializationRequest;

function parseInitializationReply(buffer) {
  var traceOutput = new LogWrapper();
  var log = traceOutput.log.bind(traceOutput);
  var logData = traceOutput.logData.bind(traceOutput);
  log(0, "<REPLY>      " + getLocalTimestamp());
  log(4, `INFO REQUEST REPLY (${buffer.length} BYTES)`);
  traceOutput.indent += 4;
  logData(formatHexData(traceOutput.indent, buffer, 0, buffer.length));
  traceOutput.clearIndentLog('</REPLY>');
  return traceOutput.logStr;
}
exports.parseInitializationReply = parseInitializationReply;

function parseRequest(buffer, connectionId) {
  var traceOutput = new LogWrapper();
  var log = traceOutput.log.bind(traceOutput);
  var logData = traceOutput.logData.bind(traceOutput);

  var sessionId = bignum.readInt64LE(buffer, 0);
  var packetCount = buffer.readUInt32LE(8);
  var varPartLength = buffer.readUInt32LE(12);
  var varPartSize = buffer.readUInt32LE(16);
  var numSegments = buffer.readUInt16LE(20);
  var packetOptions = buffer.readInt8(22);

  if (connectionId) {
    log(0, `CONNECTION ID: ${connectionId}`);
  }
  log(0, "<REQUEST>    " + getLocalTimestamp());
  // Shift indent up 2 spaces
  traceOutput.indent += 2;
  if (packetOptions === 2) {
    var compressionVarpartLength = buffer.readUInt32LE(24);
    log(0, `COMPRESSED PACKET DECOMPRESSED VARPART LENGTH: ${compressionVarpartLength}`);
  } else if (packetOptions === 3) {
    log(0, "SUPPORTS REATTACH");
  }
  log(0, `SESSION ID: ${sessionId} PACKET COUNT: ${packetCount}`);
  log(0, `VARPART LENGTH: ${varPartLength} VARPART SIZE: ${varPartSize}`);
  log(0, `NO OF SEGMENTS: ${numSegments}`);

  var curSegmentOffset = 32; // Message header is 32 bytes
  for (var segIndex = 1; segIndex <= numSegments; segIndex++) {
    var segmentLength = buffer.readInt32LE(curSegmentOffset);
    var segmentOffset = buffer.readInt32LE(curSegmentOffset + 4);
    var numParts = buffer.readInt16LE(curSegmentOffset + 8);
    var segmentNumber = buffer.readInt16LE(curSegmentOffset + 10);
    var segmentKind = SegmentKindMap.get(buffer.readInt8(curSegmentOffset + 12));
    var messageType = MessageTypeMap.get(buffer.readInt8(curSegmentOffset + 13));
    var autoCommit = buffer.readInt8(curSegmentOffset + 14);
    var commandOptions = readBitOptions(buffer.readInt8(curSegmentOffset + 15), CommandOptionMap);

    log(2, `SEGMENT ${segIndex} OF ${numSegments} MESSAGE TYPE: ${messageType}`);
    log(2, `LENGTH: ${segmentLength} OFFSET: ${segmentOffset}`);
    log(0, `NO OF PARTS: ${numParts} NUMBER: ${segmentNumber}`);
    log(0, `KIND: ${segmentKind} AUTOCOMMIT: ${autoCommit}`);
    log(0, `OPTIONS: ${commandOptions}`);

    parseParts(buffer, curSegmentOffset, numParts, traceOutput, log, logData);

    curSegmentOffset += segmentLength;
  }

  traceOutput.clearIndentLog('</REQUEST>');
  return traceOutput.logStr;
}
exports.parseRequest = parseRequest;

function parseReply(buffer) {
  var traceOutput = new LogWrapper();
  var log = traceOutput.log.bind(traceOutput);
  var logData = traceOutput.logData.bind(traceOutput);

  var sessionId = bignum.readInt64LE(buffer, 0);
  var packetCount = buffer.readUInt32LE(8);
  var varPartLength = buffer.readUInt32LE(12);
  var varPartSize = buffer.readUInt32LE(16);
  var numSegments = buffer.readUInt16LE(20);
  var packetOptions = buffer.readInt8(22);

  log(0, "<REPLY>      " + getLocalTimestamp());
  // Shift indent up 2 spaces
  traceOutput.indent += 2;
  if (packetOptions === 2) {
    var compressionVarpartLength = buffer.readUInt32LE(24);
    log(0, `COMPRESSED PACKET DECOMPRESSED VARPART LENGTH: ${compressionVarpartLength}`);
  } else if (packetOptions === 3) {
    log(0, "INITIATING SESSION REATTACH");
  }
  log(0, `SESSION ID: ${sessionId} PACKET COUNT: ${packetCount}`);
  log(0, `VARPART LENGTH: ${varPartLength} VARPART SIZE: ${varPartSize}`);
  log(0, `NO OF SEGMENTS: ${numSegments}`);

  var curSegmentOffset = 32; // Message header is 32 bytes
  for (var segIndex = 1; segIndex <= numSegments; segIndex++) {
    var segmentLength = buffer.readInt32LE(curSegmentOffset);
    var segmentOffset = buffer.readInt32LE(curSegmentOffset + 4);
    var numParts = buffer.readInt16LE(curSegmentOffset + 8);
    var segmentNumber = buffer.readInt16LE(curSegmentOffset + 10);
    var segmentKind = SegmentKindMap.get(buffer.readInt8(curSegmentOffset + 12));
    var functionCode = FunctionCodeMap.get(buffer.readInt16LE(curSegmentOffset + 14));

    log(2, `SEGMENT ${segIndex}`);
    log(2, `LENGTH: ${segmentLength} OFFSET: ${segmentOffset}`);
    log(0, `NO OF PARTS: ${numParts} NUMBER: ${segmentNumber}`);
    log(0, `KIND: ${segmentKind}`);
    log(0, `FUNCTION CODE: ${functionCode}`);

    parseParts(buffer, curSegmentOffset, numParts, traceOutput, log, logData);

    curSegmentOffset += segmentLength;
  }

  traceOutput.clearIndentLog('</REPLY>');
  return traceOutput.logStr;
}
exports.parseReply = parseReply;

function parseParts(buffer, curSegmentOffset, numParts, traceOutput, log, logData) {
  var curPartOffset = curSegmentOffset + 24;
  for (var partIndex = 1; partIndex <= numParts; partIndex++) {
    var partKind = PartKindMap.get(buffer.readInt8(curPartOffset));
    var partAttributes = readBitOptions(buffer.readInt8(curPartOffset + 1), PartAttributesMap);
    var argumentCount = buffer.readInt16LE(curPartOffset + 2);
    if (argumentCount === -1) {
      argumentCount = buffer.readInt32LE(curPartOffset + 4);
    }
    var bufferLength = buffer.readInt32LE(curPartOffset + 8);
    var alignedBufferLength = alignLength(bufferLength, 8);
    var bufferSize = buffer.readInt32LE(curPartOffset + 12);

    log(0, `PART ${partIndex} ${partKind}`);
    log(2, `LENGTH: ${bufferLength} SIZE: ${bufferSize}`);
    log(0, `ARGUMENTS: ${argumentCount}`);
    log(0, `ATTRIBUTES: ${partAttributes}`);
    log(0, "DATA:");

    if (buffer.readInt8(curPartOffset) === PartKind.AUTHENTICATION) {
      // Do not log authentication information
      log(0, "[AUTHENTICATION INFORMATION]");
    } else if (bufferLength > 0) {
      // Part header is 16 bytes
      logData(formatHexData(traceOutput.indent, buffer, curPartOffset + 16, curPartOffset + 16 + bufferLength));
    }

    // Shift indent back 2 spaces
    traceOutput.indent -= 2;
    curPartOffset += 16 + alignedBufferLength;
  }
}

function formatBufferRow(indent, buffer, curIndex, offset, end) {
  var calcEnd = offset + curIndex + 16;
  var trueEnd;
  if (end < calcEnd) trueEnd = end;
  else trueEnd = calcEnd;
  var hexEncodingStr = "";
  var humanReadableStr = "";

  for (var i = offset + curIndex; i < trueEnd; i++) {
    hexEncodingStr += zeropad.lpad(2, buffer[i].toString(16).toUpperCase());
    if (i < trueEnd - 1) hexEncodingStr += " ";

    if (buffer[i] >= 32 && buffer[i] <= 127) {
      humanReadableStr += String.fromCharCode(buffer[i]);
    } else {
      humanReadableStr += '.';
    }
  }

  var indexStr = curIndex.toString(16).toUpperCase() + "|";
  indexStr = indexStr.padStart(indent, ' ');

  // Pad the end of the hex encoding to be 47 in length, the length when
  // all 16 bytes are set. Similarly, pad the humanReadableStr to 16
  return indexStr + hexEncodingStr.padEnd(47, ' ') + "|" + humanReadableStr.padEnd(16) + "|";
}

function formatHexData(indent, buffer, offset, end) {
  // Split the data into rows of 16 bytes
  var hexDataStr = "";
  var endIndex = end - offset;
  for (var i = 0; i < endIndex; i += 16) {
    hexDataStr += formatBufferRow(indent, buffer, i, offset, end) + "\n";
  }
  return hexDataStr;
}

function getLocalTimestamp() {
  var curDate = new Date();
  return curDate.getFullYear() + '-'
      + zeropad.lpad(2, curDate.getMonth() + 1) + '-'
      + zeropad.lpad(2, curDate.getDate()) + ' '
      + zeropad.lpad(2, curDate.getHours()) + ':'
      + zeropad.lpad(2, curDate.getMinutes()) + ':'
      + zeropad.lpad(2, curDate.getSeconds()) + '.'
      + zeropad.lpad(3, curDate.getMilliseconds());
}

function readBitOptions(options, optionMap) {
  var firstOption = true;
  var result = "(";
  optionMap.forEach((value, key) => {
    if (options & key) {
      if (firstOption) firstOption = false;
      else result += "|";
      result += value;
    }
  });
  result += ")";
  return result;
}

function alignLength(length, alignment) {
  if (length % alignment === 0) {
    return length;
  }
  return length + alignment - length % alignment;
}

function LogWrapper() {
  this.logStr = "";
  this.indent = 0;
}

LogWrapper.prototype.log = function log(indentChange, message) {
  this.indent += indentChange;
  this.logStr += ' '.repeat(this.indent) + message + "\n";
}

LogWrapper.prototype.clearIndentLog = function log(message) {
  this.indent = 0;
  this.logStr += message + "\n\n";
}

LogWrapper.prototype.logData = function logData(dataStr) {
  this.logStr += dataStr;
}
