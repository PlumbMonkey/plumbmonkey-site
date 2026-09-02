# Art Room Phase 0B — checkpoint 12

Date: 2026-09-02

Status: Phase 0B in progress; animation renderer and working-document contract complete

## Scope

This checkpoint removes animation-frame and GIF pixel rendering from the React screen and formalizes a handle-backed working-document projection that excludes compatibility data URLs.

## Completed

- Moved rig hierarchy, posed rotation, world-space bone geometry, and endpoint editing into the shared core.
- Added a shared animation renderer that owns:
  - paper/background rendering;
  - camera pan, zoom, rotation, and deterministic shake;
  - sprite-exposure precedence over painted frame artwork;
  - interpolated layer transforms, opacity, and blend modes;
  - bound-layer rig rotation around configured pivots;
  - frame downscaling and `ImageData` generation for GIF encoding;
  - an injectable layer-source resolver for future direct binary-handle rendering.
- Reconnected onion-skin frame rendering and GIF export to the shared animation renderer.
- Added `art-room-working-document` v1, a projection containing:
  - live tiled-raster descriptors and handle IDs;
  - document, layer, animation, rig, and comic structure;
  - populated frame/page layer identifiers;
  - sprite metadata without embedded image payloads;
  - explicit ephemeral simulation-buffer markers.
- Added `RasterSession.createWorkingDocument()` so the live tile session is the authoritative source for the working projection.
- Verified that the working projection contains no layer, simulation, animation-frame, comic-page, or sprite data URLs.
- Added regression coverage for camera state, deterministic shake, sprite selection, renderer geometry, GIF-sized frame generation, invalid dimensions, working-document projection, descriptor cloning, and handle collection.

## Verification

- A live test created a painted frame, duplicated it, added a blank third frame, and navigated between frames with onion skin enabled.
- Timed playback entered and exited the playing state correctly across the three frames.
- GIF rendering completed and reported “GIF exported” without new browser errors.
- A forced page reload restored all three frames and the “Saved on this device” recovery state without new browser errors.
- TypeScript validation and the complete Natural Media Lab, room-list, and Luminarium suites pass.

## Phase 0B exit assessment

All major pixel renderers and editing primitives now run from reusable modules without React or Next.js assumptions. A handle-only working-document contract also exists and is produced directly by the raster session.

Phase 0B remains open for adoption of that projection as the editor's primary non-compatibility state and for extraction of PDF/GIF job lifecycle coordination. The legacy `.nml` document continues to be maintained in parallel so existing browser projects remain compatible.

## Next checkpoint

Add a reusable cancellable export-job controller, use the working-document projection at the persistence/checkpoint boundary, and define the exact conversion path between live handles and legacy `.nml` snapshots.
