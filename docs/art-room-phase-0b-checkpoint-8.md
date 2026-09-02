# Art Room Phase 0B — checkpoint 8

Date: 2026-09-01

Status: Phase 0B in progress

## Scope

This checkpoint unifies visible document history with reversible raster-tile revisions. Undo and Redo can now cross painting and compatible layer-metadata edits in one ordered sequence without discarding painted pixels. The provisional command journal also gains bounded compaction around explicit document baselines.

## Completed

- Replaced raw document arrays with typed history entries carrying:
  - the compatibility document snapshot;
  - raster compatibility information;
  - an optional `raster.tiles.replace` revision;
  - the associated command-journal sequence.
- Added shared, independently tested history helpers for recording and moving bounded Undo/Redo entries.
- Limited each visible history direction to sixteen entries and discarded the redo branch after a new edit.
- Attached asynchronous dirty-tile revisions to the painting history entry that initiated them.
- Retained tile payloads referenced by the current canvas, Undo, or Redo history and pruned unreferenced superseded payloads.
- Marked layer opacity, blend mode, visibility, add, delete, reorder, and duplicate operations as raster-compatible metadata edits.
- Kept resize, crop, merge, flip, fill, and other pixel-changing operations on the conservative compatibility-snapshot fallback.
- Applied tile descriptors forward and backward during visible Redo and Undo, with integrity-checked lazy payload restoration.
- Added journal compaction that removes commands at or before an explicit checkpoint while preserving monotonic sequence numbers for later commands.
- Stored an in-memory document baseline whenever the journal reaches its entry-count or estimated-size checkpoint policy.
- Made compatibility snapshots authoritative if Undo crosses a compacted baseline, preventing later edits from inheriting a misleading journal head.

## Verification

- Automated mixed-history coverage records a stroke followed by a metadata edit, undoes both, then redoes both in the same order.
- Automated coverage confirms the metadata step retains the raster descriptor while stroke Undo removes it and stroke Redo restores it.
- Bounded-history coverage confirms the oldest entry is dropped and a new edit clears the redo branch.
- Journal-compaction coverage confirms commands through the checkpoint are removed, later commands replay, and post-compaction sequence numbers remain monotonic.
- TypeScript validation and the complete Natural Media Lab, room-list, and Luminarium suites pass.
- A live editor test drew a pencil stroke, changed the active layer to Multiply, and verified:
  - the first Undo returned the layer to Normal while the stroke remained;
  - the second Undo removed the stroke;
  - the first Redo restored the stroke;
  - the second Redo restored Multiply;
  - no browser console errors occurred.

## Compatibility and safety

- Existing `.nml` documents and browser recovery records remain readable.
- Compatibility snapshots remain the visible-history authority when an operation invalidates the tile cache or crosses a compacted baseline.
- Journal checkpoints and their baselines are currently in memory. Durable `.pmstudio` command checkpoints wait for the native package store.
- Recovery restores the latest saved document and raster state after restart; the in-session Undo/Redo branches are not yet persisted across restarts.

## Next checkpoint

Finish the remaining editor-service extraction, add large-document and destructive-edit recovery fixtures, and close the Phase 0B exit gate with forced-restart, viewport, export, and deterministic-generator regression coverage.
