# Art Room Phase 0B — checkpoint 14

Date: 2026-09-03

Status: Phase 0B in progress; synchronized live working state and painting-core extraction complete

## Scope

This checkpoint makes the handle-backed working document part of the editor's live state and moves natural/procedural stroke execution out of the application folder without changing painting behavior.

## Completed

- Added a reusable live-document state boundary containing:
  - the compatibility Natural Media Lab document;
  - the validated, data-URL-free working document;
  - creation, document-update, raster-refresh, and recovery-restore operations;
  - structural validation between compatibility and working representations.
- Replaced the editor's standalone document state with the synchronized live-document state.
- Regenerated the working representation after every document mutation.
- Refreshed working raster descriptors after tile persistence, raster reset, recovery restore, and raster Undo/Redo.
- Changed recovery writes to persist the live working state directly instead of projecting it only when the save timer fires.
- Restored the saved working document directly during recovery, including its handle-backed raster descriptors.
- Moved the natural brush presets, seeded random generator, and stroke renderer into `art-room-core`.
- Moved procedural presets and procedural stroke rendering into `art-room-core`.
- Updated the regression harness to compile and exercise the package-level painting engines and live-document lifecycle.

## Verification

- Live-document tests cover creation, functional updates, name synchronization, embedded-data exclusion, raster refresh, recovery restoration, and compatibility/working mismatch rejection.
- Existing deterministic brush/procedural tests pass against the extracted package modules.
- A live browser test painted both a natural-media stroke and a procedural star stroke through the extracted engines.
- After the tile-backed recovery save completed, a forced reload produced an exact visual match of the painted canvas.
- The live app reported no new browser warnings or errors.
- TypeScript validation and the complete Natural Media Lab, room-list, and Luminarium suites pass.
- Production build and release validation pass.

## Phase 0B exit assessment

The editor now owns the working document as live synchronized state, and the remaining paint engines run from reusable modules. Compatibility data URLs still participate in active frame, page, and sprite switching and in several destructive-edit snapshots. Phase 0B therefore remains open until those payload references become handle-backed live snapshots and data URLs are produced only for explicit `.nml` import/export and browser rendering compatibility.

## Next checkpoint

Introduce handle-backed frame, comic-page, and sprite snapshot references, route switching and duplication through those references, and isolate data-URL materialization behind the compatibility serializer and canvas image adapter.
