# Art Room Phase 0B — checkpoint 1

Date: 2026-08-31

Status: Phase 0B in progress

## Scope

This checkpoint stabilizes rotated editor interactions before the larger package, persistence, and storage refactors. It builds on the completed website viewport repair and does not change project files, artwork pixels, exports, or recovery data.

## Completed

- Added a shared paper client-space model to the viewport core.
- Added reusable client-to-document and client-to-paper coordinate helpers.
- Changed bone endpoint dragging to use inverse paper rotation before calculating length and rest rotation.
- Changed comic panel, lettering, resize-handle, and artwork focal-point dragging to use inverse paper rotation.
- Extracted comic move, resize, crop, and boundary calculations into a reusable comic engine.
- Extracted bone endpoint edit calculations into the rig engine.
- Added deterministic regression coverage for:
  - rotated client/paper coordinate round trips;
  - rotated document-point mapping;
  - comic movement, resizing, cropping, and page-boundary clamping;
  - bone endpoint length and rotation calculation.

## Verification

- The full project test suite passes.
- The Next.js production build and type check pass for all 30 static pages.
- The Natural Media Lab static release package passes after the production export is generated.
- The Natural Media Lab route builds at 27.7 kB, with 130 kB first-load JavaScript.
- A live 15-degree interaction check moved a comic panel 60 screen pixels to the right. Its document position changed from `10%, 10%` to approximately `19.58%, 5.89%`, confirming that the drag followed the rotated paper axes rather than the unrotated browser bounding box.
- No application console errors were observed during the live interaction check.

The in-app browser's wheel gesture did not propagate a held Control modifier in this environment, so a durable automated modifier-wheel test remains open. Existing zoom geometry tests, accessible zoom controls, and the production browser rendering continue to pass.

## Remaining Phase 0B work

1. Add a dedicated browser test runner that can synthesize native Control/Command-wheel input reliably.
2. Specify `.pmstudio` v1, `.pmasset` v1, binary handles, provenance, and `.nml` migration fixtures.
3. Extract document commands, persistence, painting, rigging, comics, exports, and UI boundaries from the main React component.
4. Replace working-memory data URLs with binary handles and introduce tiled/lazy layer storage.
5. Add command-journal checkpoints, large-document benchmarks, deterministic generator fixtures, and forced restart/recovery tests.

Phase 0B is complete only when the full current Art Room runs from reusable packages without Next.js-specific assumptions and passes forced restart/recovery testing.
