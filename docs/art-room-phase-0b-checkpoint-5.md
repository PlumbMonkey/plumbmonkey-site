# Art Room Phase 0B — checkpoint 5

Date: 2026-08-31

Status: Phase 0B in progress

## Scope

This checkpoint implements the storage-neutral binary boundary needed to remove data URLs from future working documents. It creates verified migration checkpoints and lazy payload access without changing the website editor's current `.nml` behavior.

## Completed

- Added a reusable binary-store interface and defensive in-memory adapter.
- Added standards-based data URL decoding/encoding and SHA-256 hashing.
- Finalized planned `.nml` binaries into handles containing media type, byte length, digest, and embedded package path.
- Added deterministic `art-room-checkpoint` version `1` creation and validation.
- Replaced migrated data URLs with explicit binary-handle references using safe JSON Pointer traversal.
- Escaped `/` and `~` in layer IDs correctly when producing JSON Pointers.
- Extended `.nml` migration planning to include rig sprite variants.
- Added a lazy binary resolver that:
  - loads a payload only when requested;
  - coalesces concurrent reads;
  - caches successful resolutions;
  - verifies byte length and SHA-256 before exposing content;
  - removes failed reads from its cache so recovery can be retried.
- Added the sparse `art-room-tile-set` version `1` contract with bounds and duplicate-coordinate validation.
- Added an optional deterministic ID source to the compatibility parser so repeated migrations create identical checkpoints.

## Verification

- Repeating migration with the same source and checkpoint metadata produces an identical checkpoint.
- Layer pixels, wet maps, animation exposures, fallback comic-page exposures, and sprite variants become verified binary payloads.
- Layer IDs containing `/` migrate and resolve correctly.
- Two concurrent requests for the same lazy payload perform one storage read.
- Corrupted payloads fail integrity verification.
- Checkpoints with missing binary handles are rejected.
- Invalid and duplicate tile coordinates are rejected.
- The full Natural Media Lab, room-list, and Luminarium test suites pass.

## Compatibility and safety

- The live website continues to read, edit, recover, and export `.nml` version `1` with data URLs.
- Migration operates on a parsed copy and does not modify the source object or file.
- Binary adapters receive and return defensive byte copies.
- Package writers can now persist checkpoint metadata and payload bytes independently of React, Next.js, IndexedDB, or Tauri.
- The tile contract is implemented, but the current canvas renderer is not yet writing dirty tiles.

## Next checkpoint

Extract live painting/compositing state behind a raster-surface adapter and begin writing dirty regions to binary-backed tiles. Snapshot undo remains in place until pixel commands and checkpoint restoration can be proven together.
