# Art Room Phase 0B — checkpoint 13

Date: 2026-09-03

Status: Phase 0B in progress; durable working-document recovery and shared export jobs complete

## Scope

This checkpoint adopts the handle-backed working-document projection at the browser recovery boundary and removes PDF/GIF job lifecycle management from the React screen.

## Completed

- Added a reusable export-job controller with:
  - single-active-job enforcement;
  - stable job identity and state transitions;
  - `AbortSignal` cancellation;
  - cancellation callbacks and explicit cancellation checks;
  - reverse-order resource cleanup;
  - distinct succeeded, cancelled, and failed outcomes.
- Routed both comic PDF and animation GIF exports through the shared controller.
- Registered PDF worker timers, rejection, and termination with the shared lifecycle so cancellation cannot leave worker resources active.
- Preserved the safe main-thread PDF fallback for genuine worker failures while preventing cancellation from accidentally starting the fallback encoder.
- Advanced browser recovery to envelope version 2.
- Persisted the handle-backed `art-room-working-document` projection with every recovery version, alongside the compatibility document and raster payloads.
- Added a working-document parser that validates the contract, canvas dimensions, layer identities, tile-set descriptors, and the absence of compatibility `dataUrl` fields.
- Preserved loading of version 1 recovery envelopes and older raw document snapshots.
- Added regression coverage for export success, duplicate-job rejection, cancellation, cleanup order, failure state, working-document parsing, malformed dimensions, invalid raster descriptors, and embedded-data rejection.

## Recovery conversion path

The live raster session produces the working document and its tile-handle descriptors. Recovery stores that projection together with the raster payload snapshot needed to reopen those handles. The legacy Natural Media Lab document remains in the same envelope as the compatibility/UI state until the React editor is converted to use the working contract as its primary in-memory document.

## Verification

- A live comic-book PDF export completed through the worker path and reported “PDF exported.”
- A live animation GIF export completed and reported “GIF exported.”
- A recovery save was forced by adding a fifth animation frame; after a page reload, all five frames and both comic pages were restored from browser recovery.
- The live app reported no new browser warnings or errors.
- TypeScript validation passes.
- The complete Natural Media Lab, room-list, and Luminarium test suites pass.
- Production build and release checks pass.

## Phase 0B exit assessment

The persistence boundary now records the handle-backed working representation, and PDF/GIF lifecycle coordination is reusable. The remaining strict exit work is to make the working document the editor's primary in-memory state instead of a persisted companion, and to move the remaining app-local paint/procedural execution boundary into reusable core adapters. Until that migration is complete, Phase 0B remains open.

## Next checkpoint

Promote the working-document contract into the live editor state, retain `.nml` data URLs only during explicit compatibility import/export, and extract the remaining brush/procedural surface execution from the app folder.
