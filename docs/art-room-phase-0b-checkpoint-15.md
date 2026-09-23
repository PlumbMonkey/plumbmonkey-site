# Art Room Phase 0B — checkpoint 15

Date: 2026-09-16

Status: Phase 0B in progress; frame, page, and sprite binary-handle routing complete

## Scope

This checkpoint introduces verified binary handles for animation-frame, comic-page, and sprite artwork and routes the editor's snapshot navigation and animation rendering through those handles.

## Completed

- Added a reusable document-binary session that:
  - converts Natural Media Lab image payloads into an Art Room binary checkpoint;
  - stores payload bytes behind integrity-checked binary handles;
  - exposes typed frame-layer, comic-page-layer, and sprite references;
  - lazily resolves references for canvas rendering;
  - invalidates superseded asynchronous captures safely.
- Extended the handle-only working document with:
  - per-frame layer references;
  - per-page layer references;
  - per-sprite references;
  - handle collection across tiled raster and snapshot payloads.
- Added validation for every persisted snapshot reference.
- Kept older working-document v1 recovery values loadable when the new optional reference maps are absent.
- Routed frame navigation, frame duplication, frame deletion, comic-page navigation, comic-page duplication, and comic-page deletion through resolved binary handles.
- Routed onion-skin and GIF animation sources through frame/sprite handles.
- Captured new frames, pages, and sprite variants into the binary session immediately after creation.
- Rebuilt the binary session from the compatibility document after browser recovery or project import.

## Verification

- Unit coverage verifies frame, page, and sprite reference creation and resolution.
- The working-document projection contains the three snapshot handle classes without embedded image data.
- Reset behavior, handle enumeration, malformed-reference rejection, and payload integrity checks pass.
- A live test painted artwork, duplicated its animation frame, navigated between the original and duplicate, duplicated its comic page, and navigated between both pages through the binary session.
- A forced reload restored six animation frames, three comic pages, the active selections, and the duplicated artwork visibly intact.
- GIF rendering entered the handle-backed source path, and the live app reported no browser warnings or errors.
- TypeScript validation, the complete repository suite, production build, and release validation pass.

## Phase 0B exit assessment

Active frame, page, and sprite consumers now use binary handles. The compatibility document still mirrors image data URLs in React state so legacy `.nml` export, history snapshots, and a few destructive-edit paths remain synchronous. Phase 0B remains open until that mirror is generated only on demand by the compatibility serializer and those final edit/history paths use binary references directly.

## Next checkpoint

Remove compatibility image payloads from the primary React state, add an explicit asynchronous `.nml` materializer for save/export, and convert destructive edits plus history snapshots to handle-backed document state.
