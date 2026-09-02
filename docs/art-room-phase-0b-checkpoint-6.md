# Art Room Phase 0B — checkpoint 6

Date: 2026-08-31

Status: Phase 0B in progress

## Scope

This checkpoint places live canvas lifecycle and compositing behind a raster-surface adapter and starts incremental binary-backed tile writes. The existing data-URL document remains the compatibility and snapshot-undo representation while the new tile cache is proven alongside it.

## Completed

- Added storage-neutral raster geometry for clipping, rectangle union, stroke bounds, and tile intersection.
- Added incremental dirty-tile persistence that:
  - encodes only tiles intersecting a dirty region;
  - creates hashed binary handles for each tile revision;
  - retains unchanged tile references;
  - removes superseded payloads after replacement;
  - resets safely when canvas dimensions change.
- Added the browser canvas adapter for resize, clear, restore, snapshot, regional PNG encoding, and layer compositing.
- Routed live layer restoration, painting contexts, document capture, and artwork compositing through the adapter.
- Added stroke dirty-bound tracking with mirrored-stroke support.
- Added conservative full-surface invalidation for watercolor settling, flip, gradient fill, and merge operations.
- Reset transient tile state across open, new, undo/redo restore, delete, resize, crop, and merge baselines.
- Serialized tile writes per layer so rapid consecutive strokes cannot publish stale descriptors out of order.
- Guarded asynchronous writes with cache generations so work from an abandoned document cannot update the new document's tile index.

## Verification

- Rectangle clipping, union, stroke bounds, and tile intersection tests pass.
- A dirty region crossing one tile boundary writes exactly two tiles.
- Updating one of those tiles performs one new encode, retains the untouched tile, and deletes the replaced payload.
- The complete automated Natural Media Lab, room-list, and Luminarium suites pass.
- TypeScript validation passes for the application and shared packages.
- Hands-on browser verification confirms:
  - a pencil stroke renders on the live canvas;
  - local recovery returns to its saved state;
  - Undo restores the prior blank canvas and enables Redo;
  - no console errors occur.
- The browser download observer did not capture the programmatic export event, so download capture is not counted as passed browser evidence.

## Compatibility and safety

- `.nml` save, recovery, examples, exports, and snapshot undo continue using the established data-URL representation.
- The tile cache is derived and transient; failure displays a non-blocking note and does not put the user's snapshot recovery at risk.
- Encoded tile bytes receive the same SHA-256 and defensive-storage behavior as other binary payloads.
- Core dirty-region and tile-write logic has no dependency on React, Next.js, DOM canvas, IndexedDB, or Tauri.

## Next checkpoint

Persist tile descriptors and payloads with recovery checkpoints, add tile-based surface restoration, and move pixel-edit undo toward tile revision commands. Whole-document data-URL snapshots remain the fallback until restart and mixed-operation recovery tests pass.
