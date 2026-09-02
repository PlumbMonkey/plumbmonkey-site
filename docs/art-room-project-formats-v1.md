# Art Room project formats v1

Date: 2026-08-31

Status: Phase 0B contract; packaging and persistence implementation follows this specification.

## `.pmstudio` v1

`.pmstudio` is a ZIP package whose root `manifest.json` uses the `plumbmonkey-studio` format and version `1`. The manifest identifies the project, application version, editable document, binary handles, asset references, and command journal/checkpoint.

Required package layout:

```text
manifest.json
document/document.json
binary/...
journal/commands.jsonl
journal/checkpoints/...
```

The editable document stores handles instead of data URLs. Binary payloads may be embedded, external, or cache-backed. Embedded paths are relative, use forward slashes, and may not contain empty, `.` or `..` segments. Readers must reject unsafe package paths before extracting a ZIP.

Asset references preserve the user's explicit import mode: Copy, Link, Instance, or Reference. A project may record an expected hash for linked content so relinking and source updates remain visible.

## `.pmasset` v1

`.pmasset` is a ZIP package whose root `manifest.json` uses the `plumbmonkey-asset` format and version `1`. It defines one versioned asset, its entry point, optional preview, tags, dependencies, binary payloads, and provenance.

Provenance records whether the asset was created, imported, generated, or linked; its source; licensing/attribution state; redistribution status; and, when applicable, the generator id, version, seed, parameters, and Blender version.

Imported Blender files are data, not trusted code. Packaging or browsing a `.blend` never authorizes script execution.

## Binary handles

Every finalized binary handle has:

- a project-unique id;
- media type and byte length;
- a 64-character SHA-256 digest;
- exactly one embedded, external, or cache location.

Hashes support corruption checks, deduplication, cache invalidation, and source-update detection. External paths are never silently rewritten or embedded. Cache handles are rebuildable and must not be the only copy of user-authored content.

## Checkpoints and tile sets

An `art-room-checkpoint` version `1` records the journal sequence, creation time, editable document, and complete binary-handle table. Binary values inside the checkpoint document use `{ "kind": "binary-handle", "handleId": "…" }`. Readers reject duplicate handles and references to handles that are not present in the table.

Payloads are loaded lazily through a storage adapter. The first read verifies both byte length and SHA-256; successful reads may be cached, while failed reads are never retained in the cache.

Large raster surfaces may point to an `art-room-tile-set` version `1`. A tile set records canvas dimensions, tile size, and a sparse list of `(column, row, handleId)` entries. Sparse coordinates represent blank tiles without allocating payloads. Readers reject out-of-bounds and duplicate coordinates. The website canvas adapter now writes dirty 256-pixel PNG tiles into a transient binary cache; durable package-backed tiles replace that cache when native project save is introduced.

Browser recovery uses a self-contained `art-room-raster-recovery` version `1` snapshot inside each versioned recovery envelope. It contains the current layer tile descriptors and only the payloads referenced by those descriptors. Reopen verifies every handle, byte length, digest, descriptor, and reference before rebuilding the cache. A failed raster restore falls back to the compatible document snapshot rather than replacing artwork with blank content.

Each successful tile write also emits a `raster.tiles.replace` revision command containing the before/after descriptors and the created/replaced handle ids. Visible history entries pair compatibility document snapshots with their optional tile revisions, so painting and raster-compatible layer metadata can be undone and redone in one ordered sequence. Superseded bytes are retained only while the current canvas or bounded Undo/Redo history references them.

The provisional in-memory command journal compacts when it reaches its entry-count or estimated-size policy. Compaction records an explicit compatibility-document baseline, removes commands at or before that checkpoint, and preserves monotonic sequence numbers for later commands. If visible Undo crosses the compacted baseline, the restored compatibility snapshot becomes authoritative and the provisional replay journal is reset. Durable command replay and package-backed checkpoint retention remain part of native `.pmstudio` persistence.

## `.nml` migration

Migration first parses the current `.nml` through the existing compatibility loader. A planning pass then identifies layer pixels, simulation maps, animation exposures, comic-page exposures, and sprite variants that are still embedded as data URLs. Each receives a deterministic package path and a finalized binary handle.

The migration is copy-on-write:

1. Read and validate the source `.nml` without changing it.
2. Decode planned data URLs into a temporary package.
3. Hash and verify every binary payload.
4. Replace data URLs in the editable document with finalized handles.
5. Write the manifest and initial journal checkpoint.
6. Verify the package can reopen before offering it as the saved `.pmstudio` file.

The source `.nml` remains available as an interchange/export format during Phase 0B and Phase 1.

## Compatibility rules

- Readers reject unknown major versions and unsafe embedded paths.
- Writers emit the current version only and never overwrite source files during migration.
- Unknown optional fields are preserved when a package is rewritten where practical.
- Missing external assets remain explicit unresolved references; they are not replaced with blank content.
- Generator parameters, random seed, application version, and Blender version travel with generated assets.
