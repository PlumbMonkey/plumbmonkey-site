# Art Room Phase 0B — checkpoint 7

Date: 2026-09-01

Status: Phase 0B in progress

## Scope

This checkpoint makes the incremental raster cache survive browser recovery, restores canvas surfaces from verified tiles, and records reversible tile revisions. Whole-document snapshots remain the visible undo fallback while tile history proves its storage and replay rules.

## Completed

- Added `art-room-raster-recovery` version `1` snapshots containing:
  - per-layer tile-set descriptors;
  - the binary metadata required by current descriptors;
  - defensive copies of the referenced payload bytes.
- Added strict snapshot parsing for duplicate handles, malformed bytes, invalid descriptors, and missing references.
- Added integrity-checked cache reconstruction after restart.
- Versioned browser recovery records now store a compatibility document and optional raster snapshot together.
- Autosave waits for queued layer writes before capturing the raster checkpoint.
- Reopen restores the data-URL compatibility layer first, then applies verified tiles to the matching canvas coordinates.
- Raster failures are non-destructive and fall back to the compatibility snapshot.
- Added `raster.tiles.replace` commands with before/after descriptors and created/replaced handle ids.
- Added deterministic forward and reverse application for tile-revision commands.
- Retained superseded tile bytes during the active session so reverse tile application remains possible.
- Preserved legacy single-document and pre-raster recovery records.

## Verification

- A raster snapshot is created from a two-tile surface, cloned as if crossing a restart boundary, restored into a fresh binary store, and reopened with identical descriptors.
- Reopened payloads are available by their original handles.
- Corrupted recovery bytes fail SHA-256 verification.
- Missing and duplicate handles remain rejected.
- Tile-revision redo selects the new descriptor and undo restores the previous descriptor.
- The complete automated Natural Media Lab, room-list, and Luminarium suites pass.
- TypeScript validation passes for the application and shared packages.
- A live forced-restart test confirms that a painted pencil stroke survives a full page reload, recovery returns to “Saved on this device,” and no browser console errors occur.

## Compatibility and safety

- Existing IndexedDB recovery versions remain readable without a destructive schema migration.
- Every new recovery version is independently reopenable and does not depend on payloads owned only by another version.
- Recovery pruning continues to retain the newest five records.
- Only payloads referenced by the current descriptors are copied into durable recovery; superseded in-memory undo payloads are not duplicated into autosave.
- Snapshot undo/redo remains the UI authority, so a raster-command defect cannot block recovery of current artwork.

## Next checkpoint

Integrate tile-revision application with the visible undo/redo controller, add bounded retention and journal checkpoint compaction, and test mixed sequences of painting, layer metadata commands, resize/crop, undo, restart, and redo.
