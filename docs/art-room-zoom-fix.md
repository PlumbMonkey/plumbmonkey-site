# Art Room website canvas zoom fix

Date completed: 2026-08-30

This is an isolated repair to the existing Natural Media Lab/Art Room website. It does not introduce desktop, 3D, asset-library, rigging, or project-format changes.

## Problem

The paper was enlarged with a CSS transform while its layout box stayed at the original size. The stage therefore calculated scroll ranges from the wrong dimensions. At higher zoom, canvas edges could become clipped or unreachable. The enlarged content also forced the center grid row beyond its assigned height, allowing the animation timeline to cover the view controls.

## Implemented repair

- Added a reusable viewport-math module with zoom clamping, responsive paper sizing, rotation-aware bounds, and client/paper coordinate conversion.
- Zoom now changes the paper's actual layout width and height instead of applying a visual-only scale.
- Added a rotation-aware canvas viewport whose dimensions include the complete rotated paper plus a safe gutter.
- Replaced centered-grid overflow behavior with a flex-based scroll viewport. Small canvases remain centered; large canvases start inside reachable scroll bounds.
- Changed Space/middle-button panning to move the viewport scroll position rather than translating the paper outside its layout bounds.
- Added pointer-anchor calculations so Ctrl/Command-wheel zoom can preserve the document point below the pointer.
- Constrained the center grid row with `minmax(0, 1fr)` and `min-height: 0`, preventing the timeline from overlapping the status bar.
- Renamed the control to **View zoom** and added accessible zoom-out and zoom-in buttons alongside the range control.
- Left animation-camera keys, document pixels, exports, and the `.nml` format unchanged.

## Verification

Automated checks:

- Existing room-list, Natural Media Lab migration/PDF, and Luminarium checks pass.
- Added unit coverage for zoom limits, responsive paper sizing, rotated viewport bounds, and forward/inverse pointer mapping.
- The production build and type check pass for all 30 static pages.

Interactive checks used a 1280 × 720 browser viewport with a recovered 1920 × 1080 document:

| View zoom | Displayed paper | Scroll behavior |
|---|---:|---|
| 35% | 315 × 177 px | Centred; no unnecessary scrollbars |
| 70% | 630 × 354 px | Centred default view |
| 100% | 900 × 506 px | Correct internal horizontal and vertical scrolling |
| 160% | 1440 × 810 px | 1520 × 890 px scrollable viewport; every edge reachable |
| 160% + 15° | 1601 × 1155 px visual bounds | Rotation wrapper expands to approximately 1681 × 1235 px |

At 160%, both zero-scroll and maximum-scroll positions were checked: the upper-left and lower-right paper edges remain reachable. The timeline begins after the workspace and no longer covers the zoom controls.

## Files changed

- `app/natural-media-lab/NaturalMediaLab.tsx`
- `app/natural-media-lab/natural-media-lab.module.css`
- `app/natural-media-lab/viewportMath.ts`
- `scripts/test-natural-media-lab.mjs`

## Follow-on hardening

The zoom defect itself is repaired. During the later editor extraction, use the same inverse viewport mapping for rotated bone-endpoint dragging and rotated comic-item dragging, which still inherit older bounding-rectangle calculations. Add a dedicated end-to-end test for modifier-wheel input when the project adopts a browser test runner that can synthesize that native event reliably.
