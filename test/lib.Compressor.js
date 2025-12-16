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
"use strict";

const assert = require("assert");
const lib = require("../lib");
const common = lib.common;
const Compressor = require("../lib/protocol/Compressor");
const crypto = require("crypto");

describe("Lib", function () {
  let lz4Available = true;
  try {
    require("lz4-wasm-nodejs");
  } catch (err) {
    lz4Available = false;
  }

  if (lz4Available) {
    describe("#Compressor", function () {
      const PACKET_HEADER_LENGTH = common.PACKET_HEADER_LENGTH;
      const SEGMENT_HEADER_LENGTH = common.SEGMENT_HEADER_LENGTH;
      const HEADER_AND_SEGMENT_LENGTH = PACKET_HEADER_LENGTH + SEGMENT_HEADER_LENGTH;

      describe("determineCompressionFlags", function () {
        it("should return supported flag when compression is not explicitly set", function () {
          const flags = Compressor.determineCompressionFlags(undefined);
          assert.strictEqual(flags, 0x00000100); // LZ4Supported
        });

        it("should return supported flag and enabled flag when compression is true", function () {
          const flags = Compressor.determineCompressionFlags(true);
          assert.strictEqual(flags, 0x00000100 | 0x00000200); // LZ4Supported, LZ4Enabled
        });

        it("should not return any compression flags when compression is false", function () {
          const flags = Compressor.determineCompressionFlags(false);
          assert.strictEqual(flags, undefined);
        });
      });

      describe("isLZ4CompressionNegotiated", function () {
        it("should return true if both LZ4Supported and LZ4Enabled flags are set", function () {
          assert.strictEqual(Compressor.isLZ4CompressionNegotiated(0x00000100 | 0x00000200), true);
        });

        it("should return false if LZ4Supported flag is not set", function () {
          assert.strictEqual(Compressor.isLZ4CompressionNegotiated(0x00000200), false);
        });

        it("should return false if LZ4Enabled flag is not set", function () {
          assert.strictEqual(Compressor.isLZ4CompressionNegotiated(0x00000100), false);
        });
      });

      describe("Compress and Decompress", function () {
        describe('with compressible data (10KB of "a")', function () {
          const payload = Buffer.alloc(10000, "a");
          let packet;
          let compressedPacket;

          beforeEach(function () {
            packet = Buffer.alloc(HEADER_AND_SEGMENT_LENGTH + payload.length);
            packet.writeUInt32LE(SEGMENT_HEADER_LENGTH + payload.length, 12); // Set VARPARTLENGTH
            payload.copy(packet, HEADER_AND_SEGMENT_LENGTH);
            compressedPacket = Compressor.compress(packet);
          });

          it("should compress the packet", function () {
            compressedPacket.length.should.be.lessThan(packet.length);
          });

          it("packet headers should be correctly set", function () {
            assert.strictEqual(
              compressedPacket.length - PACKET_HEADER_LENGTH,
              compressedPacket.readUInt32LE(12),
            );
            assert.strictEqual(2, compressedPacket.readUInt8(22));
            assert.strictEqual(
              packet.length - PACKET_HEADER_LENGTH,
              compressedPacket.readUInt32LE(24),
            );
          });

          it("should decompress the compressed packet correctly", function () {
            const final = Compressor.decompress(
              compressedPacket.slice(PACKET_HEADER_LENGTH),
              payload.length + SEGMENT_HEADER_LENGTH,
            );
            const recoveredPayload = final.slice(SEGMENT_HEADER_LENGTH);
            assert(
              payload.equals(recoveredPayload),
              "Decompressed data should match original payload",
            );
          });
        });

        describe("with uncompressible data (random bytes)", function () {
          it("should skip compression if data is not compressible", function () {
            const payload = crypto.randomBytes(10000);
            const packet = Buffer.alloc(HEADER_AND_SEGMENT_LENGTH + payload.length);
            payload.copy(packet, HEADER_AND_SEGMENT_LENGTH);

            const compressedPacket = Compressor.compress(packet);
            assert.deepStrictEqual(
              compressedPacket,
              packet,
              "Uncompressible packet should match original packet",
            );
          });
        });
      });
      it("should throw an error if decompressed size does not match expected size", function () {
        const payload = Buffer.alloc(10000, "a");
        const packet = Buffer.alloc(HEADER_AND_SEGMENT_LENGTH + payload.length);
        packet.writeUInt32LE(SEGMENT_HEADER_LENGTH + payload.length, 12); // VARPARTLENGTH
        payload.copy(packet, HEADER_AND_SEGMENT_LENGTH);
        const compressedPacket = Compressor.compress(packet);
        const compressedPayload = compressedPacket.slice(PACKET_HEADER_LENGTH);
        const wrongDecompressedSize = payload.length + SEGMENT_HEADER_LENGTH + 1;
        assert.throws(
          () => {
            Compressor.decompress(compressedPayload, wrongDecompressedSize);
          },
           /Packet decompression failed/
        );
      });
    });
  }
});
