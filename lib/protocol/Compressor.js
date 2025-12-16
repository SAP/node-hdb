// Copyright 2025 SAP AG.
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

const common = require('./common');
const util = require('../util'); 

const PACKET_HEADER_LENGTH = common.PACKET_HEADER_LENGTH;
const SEGMENT_HEADER_LENGTH = common.SEGMENT_HEADER_LENGTH;

const CompressionFlag_LZ4Supported = 0x00000100;
const CompressionFlag_LZ4Enabled = 0x00000200;
const MIN_COMPRESSION_SIZE_PCT = 95;
const PACKET_OPTION_IS_COMPRESSED = 2;

let wasmLZ4;
let lz4Available = true;
try {
  wasmLZ4 = require('lz4-wasm-nodejs');
} catch (err) {
  lz4Available = false;
}

function determineCompressionFlags(compressOption) {
  if (!lz4Available) {
    return undefined;
  }
  
  let addCompFlags = true;
  let compFlags = CompressionFlag_LZ4Supported;
  // Check if the client provided a compression option.
  if (compressOption != undefined) {
    // If the client explicitly enabled compression.
    if (util.getBooleanProperty(compressOption)) {
      compFlags |= CompressionFlag_LZ4Enabled;
    } else {
      // Client explicitly disabled compression.
      addCompFlags = false;
    }
  }
  return addCompFlags ? compFlags : undefined;
}

function isPacketCompressed(packetOptions) {
  return packetOptions === PACKET_OPTION_IS_COMPRESSED;
} 

function isLZ4CompressionNegotiated(compFlags) {
  return util.isFlagBitSet(compFlags, CompressionFlag_LZ4Supported) && util.isFlagBitSet(compFlags, CompressionFlag_LZ4Enabled);
}

function compress(packet) {
  const HEADER_AND_SEGMENT_LENGTH = PACKET_HEADER_LENGTH + SEGMENT_HEADER_LENGTH;
  const headerAndSegment = packet.subarray(0, HEADER_AND_SEGMENT_LENGTH);
  const toCompress = packet.subarray(HEADER_AND_SEGMENT_LENGTH);

  const compressedRaw = wasmLZ4.compress(toCompress);
  const compressedPayload = compressedRaw.subarray(4); // Strip 4-byte size header
  const finalLength = HEADER_AND_SEGMENT_LENGTH + compressedPayload.length;

  if (finalLength < (MIN_COMPRESSION_SIZE_PCT * packet.length) / 100) {
    const finalPacket = Buffer.alloc(finalLength);

    // Copy headerAndSegment and compressedPayload into the finalPacket
    headerAndSegment.copy(finalPacket, 0);
    finalPacket.set(compressedPayload, HEADER_AND_SEGMENT_LENGTH);
  
    // Update packet header fields
    const COMPRESSIONVARPARTLENGTH = packet.readUInt32LE(12); // original varpartlength
    finalPacket.writeUInt32LE(compressedPayload.length + SEGMENT_HEADER_LENGTH, 12); // VARPARTLENGTH
    finalPacket.writeUInt8(PACKET_OPTION_IS_COMPRESSED, 22); // PACKETOPTIONS
    finalPacket.writeUInt32LE(COMPRESSIONVARPARTLENGTH, 24); // COMPRESSIONVARPARTLENGTH

    return finalPacket;
  } else {
    return packet;
  }
}

/**
 * Decompresses the payload of a packet
 * Does not reset the message header fields in the decompressed packet
 * @param {Buffer} buffer - The entire buffer to be decompressed (minus the message header)
 * @param {number} decompressedSize - Expected size of the packet once decompressed (minus the message header)
 * @returns {Buffer} - The fully decompressed packet (minus the message header).
 */
function decompress(buffer, decompressedSize) {
  const header = buffer.subarray(0, SEGMENT_HEADER_LENGTH);
  const compressed = buffer.subarray(SEGMENT_HEADER_LENGTH);

  const sizeHeader = Buffer.alloc(4); //create a 4-byte buffer for decompressed size
  sizeHeader.writeUInt32LE(decompressedSize - SEGMENT_HEADER_LENGTH, 0);
  const compressedWithHeader = Buffer.concat([sizeHeader, compressed]);

  let output;
  try {
    output = wasmLZ4.decompress(compressedWithHeader);
  } catch (err) {
    throw new Error(`Packet decompression failed: ${err.message}`);
  }
  return Buffer.concat([header, output]);
}


module.exports = {
  compress,
  decompress,
  isLZ4CompressionNegotiated,
  determineCompressionFlags,
  isPacketCompressed
};