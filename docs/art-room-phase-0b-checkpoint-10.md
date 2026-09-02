# Art Room Phase 0B — checkpoint 10

Date: 2026-09-02

Status: Phase 0B in progress; live raster-session boundary complete

## Scope

This checkpoint moves live tiled-raster ownership, compatibility snapshot capture, and animation timing/interpolation out of the React editor screen. The goal is to make those behaviors independently reusable and testable before the remaining renderer orchestration is split from the web UI.

## Completed

- Added a shared `RasterSession` service that owns:
  - the binary store and live tile descriptors;
  - per-layer serialized writes;
  - cancellation of stale queued work after a reset;
  - reversible raster revision creation and application;
  - lazy handle resolution;
  - recovery snapshot creation and restoration;
  - pruning of superseded binary payloads while retaining history references.
- Reconnected the editor's painting, mixed Undo/Redo, recovery, restore, and history pruning paths to the shared raster session.
- Added a DOM-independent document snapshot boundary. Compatibility data URLs for layers, simulations, the active animation frame, and the active comic page are now assembled by the shared core rather than by the React screen.
- Added a shared animation service for default transforms, keyframe interpolation, easing, hold keys, and safe frame playback timing.
- Reconnected live animation rendering, transform editing, export rendering, and playback timing to that service.
- Added controller-level regression coverage for queued-write invalidation, forward/reverse revisions, recovery reconstruction, lazy resolution, payload pruning, compatibility snapshots, keyframe interpolation, hold behavior, and playback timing.

## Verification

- TypeScript validation and the complete Natural Media Lab, room-list, and Luminarium suites pass.
- A live editor test created a full-canvas gradient backed by tiled raster storage.
- Undo restored the preceding painted canvas; Redo restored the gradient. The controls changed state correctly and the browser reported no errors.
- After the recovery save completed, a forced page reload restored the gradient and “Saved on this device” state. As designed, the in-session Undo and Redo stacks restarted empty.

## Phase 0B exit assessment

The live binary tile session is now reusable core state rather than a collection of React-owned stores, queues, maps, and recovery helpers. Compatibility data URLs remain only where the current document, animation-frame, comic-page, export, and `.nml` contracts still require them.

Phase 0B remains open against its strict exit gate. The large React screen still coordinates several canvas edits, comic rendering, and encoder/export operations directly, and the public document contract still exposes compatibility data URLs. The next extraction must put those operations behind renderer/editor services so the complete current Art Room can run without Next.js-specific assumptions.

## Next checkpoint

Extract the remaining canvas-edit and comic/export rendering orchestration, formalize the handle-backed working-document boundary, and reduce the React screen to input, layout, and view-state coordination.
