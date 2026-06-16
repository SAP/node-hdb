# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pure JavaScript SAP HANA database client for Node.js (≥18).

## Development Guidelines

- **Backward compatibility**: This is a published npm package — any change visible to consumers must be backward compatible. This includes public method and callback signatures, emitted events, exported names, and existing behavior.
- **Naming**: `_` prefix for private fields/methods (`_socket`, `_cleanup()`); no prefix for public ones.
- **Variables**: Always `const`/`let`, never `var`. When modifying existing code, convert nearby `var` declarations too.
- **Classes**: ES6 `class` for new classes; existing `util.inherits` classes stay as-is — only add new methods to them.

## Architecture

`Client` is the public API entry point. It delegates to `Connection`, the logical layer that owns the request queue, session state, and a `PhysicalConnectionSet`. `PhysicalConnection` handles the actual socket I/O: TCP connect, HDB handshake, compression, and packet framing.

`ConnectionManager` is a connect-time utility that handles multi-host failover and MDC tenant routing; it is discarded once the connection is open.

**Data Flow**: `Client` → `Connection` → `PhysicalConnection` → HANA server.

**Protocol Wire Format**: `lib/protocol/common/` defines constants and enums. `lib/protocol/request/` and `lib/protocol/reply/` handle segment and part serialization. `lib/protocol/data/` contains per-part-kind read/write codecs.

## Testing

```bash
# Run all tests (unit + acceptance)
make test

# Run unit tests only (no HANA server needed)
make test-unit

# Run acceptance tests only (requires HANA server)
make test-acceptance
```

Acceptance tests require `test/db/config.json` (copy from `test/db/config.tpl.json` and fill in credentials). Without it, a local mock server starts automatically.

Unit tests in `test/` cover individual modules (e.g. `lib.Connection.js`, `lib.ConnectionTopology.js`). Acceptance tests in `test/acceptance/` exercise a real HANA server. The mock server (`test/mock/server.js`) replays canned responses for auth + basic SQL operations. `test/TestUtil.js` provides topology test helpers (`TopologyTestUtils`).
