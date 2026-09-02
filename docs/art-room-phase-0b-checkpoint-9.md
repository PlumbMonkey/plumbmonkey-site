# Art Room Phase 0B — checkpoint 9

Date: 2026-09-02

Status: Phase 0B in progress; regression gate complete

## Scope

This checkpoint extracts reusable export decisions from the editor screen and completes the planned Phase 0B regression harness for large tiled documents, deterministic generators and encoders, destructive edits, versioned recovery, and live forced-restart behavior.

## Completed

- Added a shared export-planning service for:
  - Windows-safe output names;
  - PNG, JPEG, and WebP media types and extensions;
  - transparent-background flattening policy;
  - bounded GIF output dimensions;
  - A4 and US Letter PDF page and bleed geometry.
- Integrated the shared plans into artwork, comic-page, PDF, GIF, and `.nml` exports.
- Added a reusable raster-workload profiler reporting tile geometry, maximum tile count, raw layer bytes, exposure slots, and interactive/heavy/extreme workload tiers.
- Centralized the decision that tells visible history when a destructive or unfinished raster operation must reset the incremental tile cache.
- Expanded automated coverage for:
  - safe and reserved Windows filenames;
  - raster flattening and output extensions;
  - GIF downscaling and PDF bleed calculations;
  - a 4096 × 4096, 256-tile dirty-surface persistence benchmark;
  - 4096 × 4096 documents with sixteen layers, twenty-four frames, and twelve comic pages;
  - deterministic seeded procedural operations;
  - byte-identical seeded GIF encoding;
  - destructive-history cache invalidation;
  - restart recovery after a destructive edit while retaining the preceding raster recovery version.

## Verification

- The synthetic 4096-pixel tile benchmark persisted and verified 256 tile handles in 7 ms on this test run. This measures tile addressing, hashing, descriptor construction, and memory-store overhead; it is not a browser PNG-encoding or GPU benchmark.
- A live editor test painted a 1920 × 1080 document, replaced it with a new 1200 × 1200 canvas, and verified Undo, Redo, and a second Undo restored the correct dimensions and artwork each time.
- A forced page reload reopened the final 1920 × 1080 recovery version with both painted strokes intact, “Saved on this device” restored, and the expected empty in-session Undo stack.
- The live artwork Export action produced no page or console error. Exact filenames and binary encoder output are asserted in the automated suite because this browser harness does not surface data-URL downloads as downloadable artifacts.
- TypeScript validation and the complete Natural Media Lab, room-list, and Luminarium suites pass.

## Phase 0B exit assessment

The regression portion of the Phase 0B exit gate is met. The current Art Room behavior is now covered across viewport geometry, document migration, commands, binary checkpoints, tiled raster recovery, mixed Undo/Redo, deterministic procedural output, PDF/GIF output, destructive edits, and forced restart.

Phase 0B remains open for one final architectural checkpoint. Compatibility data URLs still exist in the live document model, and some canvas, animation, comic-rendering, and export orchestration remains inside the React screen. Those boundaries must move behind reusable services before claiming that the complete editor runs from packages without Next.js-specific assumptions.

## Next checkpoint

Complete the Phase 0B architectural exit: move the remaining canvas/document-edit and animation/comic-render orchestration behind reusable adapters, narrow the React component to UI coordination, and make binary handles the live working representation while keeping `.nml` data URLs only at the compatibility boundary.
