# Art Room Phase 0B — checkpoint 3

Date: 2026-08-31

Status: Phase 0B in progress

## Scope

This checkpoint separates recovery storage from the Natural Media document model and establishes reusable command-journal and versioned-recovery primitives. It preserves the existing editor and `.nml` workflow while preparing recovery for the desktop file adapter.

## Completed

- Removed IndexedDB behavior from `documentModel.ts`.
- Added a website-specific IndexedDB persistence adapter.
- Upgraded browser recovery storage from one rolling record to five timestamped versions.
- Preserved read fallback for the legacy `projects/autosave` record.
- Added a storage-neutral recovery service for save, list, latest, pruning, and reopen behavior.
- Added an append-only command journal with:
  - monotonic sequences;
  - undo/redo head movement;
  - redo-branch replacement after a new command;
  - checkpoint metadata;
  - deterministic replay selection;
  - entry-count and estimated-size checkpoint policies.

## Verification

- Recovery ordering and pruning tests pass.
- An in-memory forced-restart test saves three versions, retains the newest two, recreates the service, and reopens the newest version.
- Journal branching, replay, checkpoint, and checkpoint-policy tests pass.
- The full Natural Media Lab migration/PDF/geometry suite passes.
- The production build and type check pass for all 30 static pages.
- The Natural Media Lab static release package passes.
- The route loaded in the browser with no console errors. The browser controller did not deliver page clicks during this run, so it was not used as evidence for the forced-reload result.

## Compatibility and safety

- Existing browser users retain their prior recovery through the legacy fallback.
- The upgrade creates a new recovery store without deleting the old store.
- Recovery pruning is bounded to the new version store.
- The core recovery service does not depend on IndexedDB, React, Next.js, or Tauri.
- The command journal is not yet wired to every editor action; snapshot undo remains active until command extraction is complete.

## Next checkpoint

Define typed editor commands and route the first document operations through the journal without changing visible behavior. Painting pixel deltas and binary/tiled layer storage remain later Phase 0B work.
