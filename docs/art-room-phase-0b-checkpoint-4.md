# Art Room Phase 0B — checkpoint 4

Date: 2026-08-31

Status: Phase 0B in progress

## Scope

This checkpoint moves the Natural Media document model into the reusable Art Room core and introduces deterministic typed commands for the first editor operations. The website keeps its current snapshot undo behavior while the command boundary is proven incrementally.

## Completed

- Moved the Natural Media document types, constructors, validation, and migration parser into `packages/art-room-core`.
- Kept a small website compatibility facade so existing painting, rigging, comics, persistence, and export imports remain stable.
- Added typed commands for:
  - layer add and duplicate;
  - layer delete;
  - layer reorder;
  - layer rename;
  - layer visibility and lock state;
  - layer opacity and blend mode.
- Added a deterministic reducer whose timestamps come from the command rather than ambient time.
- Connected every supported layer metadata action to the append-only command journal.
- Reset the active command journal when opening a project, creating a new document, or restoring a snapshot, preventing a provisional journal from being replayed across a different document baseline.

## Verification

- A four-command edit sequence updates, reorders, adds, and deletes layers correctly.
- Replaying the journal from the same starting document produces an identical final document.
- Invalid commands are non-destructive, including an attempt to delete the only remaining layer.
- The complete Natural Media Lab test suite passes.
- The production build and type check pass for all 30 static pages.
- The Natural Media Lab static release package passes.

## Compatibility and safety

- The `.nml` parser and public website import path remain compatible.
- Snapshot undo/redo remains the visible UI authority during this migration.
- Pixel-changing operations such as painting, merge, flip, resize, crop, and gradient fill remain on snapshot history until binary handles and tiled storage can represent their deltas safely.
- The shared document and command modules do not depend on React, Next.js, IndexedDB, or Tauri.

## Next checkpoint

Extract the next service boundary from the React component, prioritizing export/compositing or painting state, then introduce binary layer handles and a checkpoint format before switching visible undo/redo to command replay.
