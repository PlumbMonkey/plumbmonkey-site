# Art Room desktop application — product summary, technical audit, and roadmap

Date: 2026-08-29

## Executive recommendation

Build the desktop product as an orchestration studio instead of attempting to re-create Krita, Blender, Marvelous Designer, CityEngine, MakeHuman, and TouchDesigner from scratch.

The recommended foundation is:

- Keep the existing React interface and extract its document, painting, animation, comic, and procedural systems into reusable packages.
- Package the interface with Tauri 2 for local files, projects, recovery, background jobs, and a smaller desktop footprint.
- Use Babylon.js for the interactive 3D viewport, with WebGPU when available and WebGL as the fallback.
- Use the user's installed Blender as the high-quality geometry, simulation, rigging, animation, and rendering worker.
- Use a separately licensed Blender bridge add-on for jobs that require `bpy`. Keep the MIT application core separate from GPL Blender/add-on code.
- Use GLB/glTF for fast preview and delivery, USD for large editable scenes, OpenRaster for layered 2D interchange, and a new zipped `.pmstudio` project format as the product's source of truth.

This gives us a credible path to a useful desktop release while leaving room for increasingly original Plumbmonkey generators.

## 1. What the current Art Room can do

The website calls the application **Natural Media Lab v0.8.1** and exposes it as the **Art Room**. It is a local-first browser studio, not a simple drawing demo.

### Natural-media painting

- Pointer input for mouse, pen, and touch, including pressure-sensitive brush sizing.
- Sixteen tools: pencil, graphite, charcoal, ink, calligraphy, marker, watercolor, acrylic, oil, palette knife, pastel, chalk, airbrush, pixel brush, smudge, and eraser.
- Controls for size, flow, wetness, grain, scatter, pressure response, paper absorbency, pigment separation, and material-effects strength.
- Seeded brush randomness, so a stroke can be reproduced from the same settings and seed.
- Watercolor blooms and settling, ink feathering and pooling, dry pigment dust, smudging, oil bristle ridges, palette-knife dragging, and stored wetness/oil-height maps.
- RGB, HSL, and HSV colour editing, recent colours, curated swatches, harmony suggestions, and diagonal gradient fill.

### Procedural painting

- Seeded grass, leaves, stars, snow, rain, vines, fire, smoke, clouds, and lightning.
- Density, scale, wind, colour variation, layers, mirror mode, undo, save, and export all work with procedural marks.
- Procedural output is baked into ordinary layer pixels, which makes it compatible with the current compositor and exports.

### Canvas and layer editing

- Multiple full-resolution layers with visibility, lock, opacity, ordering, duplication, merge-down, and Normal/Multiply/Screen/Overlay blend modes.
- Rectangle and ellipse selections, crop to selection, horizontal/vertical flip, whole-document resizing, mirror painting, grid display, and grid snapping.
- Pan, zoom, rotation, reset view, and an independent animation-camera transform.
- Sixteen whole-document undo snapshots and redo.
- Paper or transparent backgrounds, with landscape, square, HD, A4, and custom sizes up to 4096 pixels per dimension.

### Animation and 2D puppet work

- Frame creation, duplication, deletion, reordering, looping, 1–24 FPS playback, variable frame holds, and previous-frame onion skinning.
- Sparse per-frame layer transform keys for position, rotation, scale, opacity, and easing.
- Camera pan, zoom, rotation, and shake keys.
- A basic hierarchical 2D bone rig with parent-child relationships, layer bindings, pivots, keyed bone rotations, direct endpoint dragging, forward kinematics, two-bone IK, and named pose presets.
- Captured sprite variants, per-frame sprite exposure, and manual Rest/A/E/O/M mouth cues.
- Animated GIF export, currently limited to 480 pixels wide.

### Comic and publishing tools

- Multi-page comic books with independent page artwork.
- Strip, grid, and feature-page templates; custom panels; sourced artwork from another page; non-destructive crop, pan, and zoom.
- Speech bubbles, thought bubbles, captions, tails, three lettering styles, alignment, multi-selection, group alignment/distribution, snapping, and smart guides.
- Reusable lettering styles and page masters.
- Page PNG/JPG, whole-book print, and local PDF export.
- A4 and US Letter output with configurable DPI, bleed, and crop marks.
- Publishing diagnostics and cancellation for PDF preparation/encoding.

### Projects and reliability

- Versioned `.nml` JSON projects with PNG data URLs for layer pixels and simulation maps.
- Backward migration for older paintings, animation, rig, comic, style, and print data.
- One rolling IndexedDB recovery project on the current device.
- PNG, JPG, WEBP, GIF, PDF, print, and `.nml` output.
- First-run tour, contextual help, example projects, automated document-migration/PDF checks, and a static-release validator.

### Current health check

- The source/migration/PDF tests pass.
- The Next.js production build completes, including type checking and all 30 static pages.
- The Natural Media Lab static release package passes after the production output is built.
- The page payload is currently about 26.8 kB for the Art Room route and about 129 kB including shared first-load JavaScript.

## 2. Current limitations and technical debt

The present implementation is a strong prototype, but it is not yet a safe foundation for a full DCC-style desktop application without refactoring.

- Most application behavior and UI live in one approximately 1,018-line React component.
- Every layer is a full-resolution browser canvas. Large documents, many layers, frames, and pages multiply memory use quickly.
- `.nml` embeds full PNG data URLs in JSON. It is easy to understand but slow and large for serious projects.
- Undo stores up to sixteen complete document snapshots, which will become expensive once 3D scenes, long animation, and larger images are added.
- Painting and page compositing still perform substantial work on the main UI thread.
- GIF encoding is main-thread work and deliberately small.
- The brush simulation is visually suggestive rather than physically based.
- Blend modes, selection tools, masks, groups, colour management, vector layers, filters, rich text, custom fonts, audio tracks, video export, and production-grade rig/weight tools are limited or absent.
- The current 2D rig is appropriate for cut-out animation but not a substitute for a deforming 3D skeleton and skinning system.
- Recovery stores one browser-local autosave rather than maintaining projects, versions, backups, and recoverable job state.
- Browser interaction and cross-browser regression tests are not yet automated.

## 3. Canvas zoom glitch

### Diagnosis

The zoom glitch is architectural rather than a bad slider value.

The stage is a centered CSS grid with `overflow: auto`. The paper keeps its original layout size and is enlarged only with a CSS `transform: ... scale(...)`. CSS transforms change the visual rectangle but not the element's normal layout dimensions. Once the canvas is larger than the viewport, the visual content grows around its centre while the scrollable layout box still represents the unscaled paper. This can clip the top/left portion and make it impossible to scroll back to it.

Other usability issues compound this:

- Zoom is centred on the paper rather than the pointer, so the focal artwork jumps during zoom.
- Editor zoom and animation-camera zoom are multiplied together but presented in different areas, which can look like a broken editor zoom.
- The same transform combines editor pan, camera pan, editor rotation, camera rotation, and zoom, making coordinate conversion and automated testing harder.
- The paper is also given fixed responsive widths, so document size, viewport size, CSS size, and zoom are four separate scales.

### Recommended fix

1. Introduce a dedicated viewport model with explicit `scale`, `rotation`, and translation matrices.
2. Add an untransformed **canvas sizer** whose layout width and height equal the displayed document size after zoom. Put the transformed paper inside that sizer.
3. Use top-left positioning for overflow, adding calculated margins only when the scaled canvas is smaller than the viewport. Never rely on `place-items: center` for oversized content.
4. Zoom around the mouse/pen position: record the document-space point under the pointer, change the zoom, then update pan so that point stays under the pointer.
5. Convert pointer coordinates with the inverse viewport matrix. This supports rotation, future 3D overlays, and precise selections.
6. Rename controls to **Editor view zoom** and **Animation camera zoom**.
7. Add Fit, 100%, Fit Width, Fit Height, and Reset Rotation commands.
8. Add automated tests at 35%, 70%, 100%, and 160%, with landscape, portrait, rotated, panned, and narrow-window cases. Confirm all four canvas corners can be reached.

### Acceptance criteria

- No canvas edge is permanently clipped at any supported zoom or rotation.
- Zooming under the pointer keeps the same document point stationary within one screen pixel.
- Panning works with Space-drag, middle mouse, pen, and touch.
- Drawing, selections, rig handles, comic handles, and smart guides retain correct document coordinates after pan/zoom/rotation.
- Editor zoom never alters exported pixels or animation-camera keys.

## 4. Proposed desktop architecture

### Application layers

```text
Tauri desktop shell
├── React studio UI
│   ├── 2D canvas/editor
│   ├── Babylon.js 3D viewport
│   ├── node/parameter editor
│   ├── timeline and graph editor
│   └── asset/project browser
├── application core
│   ├── project graph and commands
│   ├── undo journal and autosave
│   ├── job queue and cache
│   ├── asset metadata and provenance
│   └── import/export validation
├── local workers
│   ├── tiled 2D renderer
│   ├── image/PDF/GIF/video jobs
│   ├── audio analysis
│   └── thumbnails and proxies
└── Blender bridge (separate GPL component)
    ├── geometry-node generators
    ├── simulation and baking
    ├── character/rig adapters
    ├── USD/GLB/BLEND interchange
    └── Cycles/EEVEE render jobs
```

### Why Tauri first

Tauri 2 can reuse the present React UI, exposes a Rust/JavaScript message boundary for files and processes, and supports external helper binaries. It does not ship an entire browser runtime, keeping the desktop shell smaller. Electron is the fallback if predictable bundled Chromium/WebGPU behavior proves more valuable than footprint. Make that decision after a Windows, macOS, and Linux viewport prototype rather than by preference alone.

### Why Babylon.js for the live viewport

Babylon.js is Apache-2.0 licensed, supports WebGPU and WebGL, has strong glTF/PBR/animation support, and keeps the interactive editor in the same TypeScript application as the 2D tools. The viewport is for responsive creation and preview; Blender remains the authority for high-quality geometry generation, simulation, baking, and final rendering.

### Why Blender as a worker instead of reimplementing it

Blender already supplies robust meshes, curves, Geometry Nodes, sculpting, modifiers, UVs, materials, hair, cloth, fluids, armatures, constraints, animation, compositing, EEVEE, and Cycles. It can run scripted background jobs and, when needed, open an interactive `.blend` for expert refinement. The desktop app should send typed jobs and receive progress, logs, thumbnails, GLBs, USD layers, and final renders.

The app should detect a compatible local Blender installation and let the user select another one. Avoid bundling Blender initially; bundling adds hundreds of megabytes plus GPL distribution obligations.

### Project and asset formats

- `.pmstudio`: zipped project manifest, edit graph, 2D tiles, audio-analysis cache, thumbnails, and references to large external assets.
- `.nml`: preserved as an import/export compatibility format.
- OpenRaster `.ora`: layered 2D interchange with Krita, GIMP, MyPaint, and Scribus.
- GLB/glTF: optimized preview, delivery, web, game, and AR/VR assets.
- USD/USDZ: large editable scenes, variants, composition, animation, and DCC interchange.
- `.blend`: Blender-authoritative generator, simulation, and render work files.
- IFC: architectural/BIM interchange through IfcOpenShell when precise building semantics are needed.
- SQLite: local asset index, job state, search metadata, provenance, and recent-project history—not the binary artwork itself.

### Non-destructive command model

Replace whole-document undo snapshots with an append-only command journal and checkpoints. Generator parameters, random seeds, inputs, dependencies, application version, and Blender version should be stored with every generated asset. This makes results reproducible and generators upgradable.

## 5. Product workspaces and feature plan

### A. Paint and illustration

- Tiled/lazy layer storage, masks, groups, clipping, adjustment layers, more blend modes, non-destructive transforms, selection transforms, freehand/lasso/magic-wand selection, filters, vector/text layers, and colour-managed display.
- Brush preset editor, texture tips, stabilizer, perspective/symmetry assistants, brush tags/favourites, and portable brush packs.
- CanvasKit or a native/tiled backend for compositing, with `libmypaint` evaluated for its permissively licensed brush engine.
- OpenRaster import/export and Photoshop-compatible export only after licensing/compatibility review.

### B. Animation, comics, and storyboards

- A shared timeline for raster frames, vector/keyframe animation, 2D rigs, 3D shots, cameras, audio, markers, and dialogue.
- Exposure sheets, frame ranges, copy/paste, nested clips, graph editor, motion paths, audio scrubbing, automatic lip-sync suggestions, and MP4/WebM image-sequence export.
- Comic spreads, templates, richer typography, linked characters/props, vector balloons, style libraries, preflight, CMYK-aware print handoff, and publisher presets.

### C. 3D scene and asset workspace

- Outliner, properties, transform gizmos, snapping, collections, cameras, lights, materials, modifiers, UV preview, animation timeline, and render settings.
- GLB/USD import, validation, texture relinking, LOD generation, collision meshes, thumbnails, turntables, and publish presets.
- Babylon preview for speed; one-click **Open in Blender** for expert editing; background Blender jobs for generation and rendering.

### D. Hair and fur generator

1. Select a scalp/body region or use a character template.
2. Create guide curves and expose style controls for length, part, curl, clump, frizz, density, taper, children, colour, roughness, and randomness.
3. Interpolate dense curves with Blender hair Geometry Nodes.
4. Add optional hair/fur dynamics and collision, then bake for animation.
5. Export as render curves, cards, or mesh strips with LODs.

For animals, the same system becomes short fur, manes, feathers, quills, and tails through species-specific presets.

### E. Clothing generator

1. Start from body measurements or the current character mesh.
2. Assemble parametric 2D pattern components (bodice, sleeves, collar, skirt, trouser legs, pockets, cuffs, and closures).
3. Stitch and drape in Blender, with collision, fabric presets, seam allowance, layering, and fit ease.
4. Provide corrective sculpt/weight transfer, thickness, UVs, materials, and LODs.
5. Save both the editable pattern and fitted 3D result.

GarmentCode is the strongest permissively licensed research starting point for parametric sewing patterns. Seamly2D is useful for pattern-file ideas/interchange but is GPL and should stay behind a licensing boundary unless the entire relevant component is GPL.

### F. Human, animal, and creature generator

#### Humans

- Use MPFB as the first Blender-side human backend: parametric body controls, Rigify support, procedural skin/eyes, clothing/body-part/material assets, and CC0 core assets.
- Store the Plumbmonkey-facing controls in an engine-neutral parameter schema so MPFB can later be supplemented or replaced by original base meshes and morph sets.
- Add face proportions, expressions/visemes, skin, eyes, teeth, age, build, asymmetry, stylization, and topology presets.

#### Animals and creatures

- Use a species-template system rather than pretending one universal topology can cover everything.
- First templates: generic quadruped, cat, dog/wolf, horse, bird, shark/fish, and a modular fantasy creature.
- Each template owns a base mesh, semantic regions, morph targets, material zones, rig recipe, test poses, and export rules.
- Blend species traits only within compatible topology families; use remeshing/retopology when crossing families.

#### Automatic rigging

- Production path: fit landmarks, generate a Rigify metarig, create control/deform rigs, calculate/transfer weights, run deformation tests, and publish a clean export skeleton.
- Rigify already includes human and several animal metarigs and is the best open, maintainable base for an original Plumbmonkey workflow.
- R&D path: evaluate UniRig for diverse skeleton/skin prediction and RigNet as an older baseline. Both need quality, dependency, model-license, and redistribution review before product use.

### G. Auto-Rig Pro interoperability

Local inspection found:

- Blender 5.2.0 LTS installed.
- Auto-Rig Pro 3.78.26 installed for Blender 5.2.
- Its manifest describes automatic rig generation from reference bones plus file/network/clipboard permissions.
- The included license states that source components are GPL and generated rigs belong to the end user; asset subfolders have their own Royalty Free/CC0 terms.

Recommended approach:

- Do not make the main application depend on Auto-Rig Pro.
- Add an optional adapter that detects the installed add-on and invokes documented Blender operators for users who own/install it.
- Treat generated rigs as user project assets.
- Build the default original rigging workflow on Rigify and Blender APIs.
- If any Auto-Rig Pro GPL source is adapted, keep that derivative in the GPL Blender bridge and publish the corresponding source. Do not copy it into the MIT desktop core.

### H. Natural landscape generator

- Seeded terrain noise, terraces, erosion, rivers, shorelines, roads/paths, biome masks, snow lines, material splats, scatter, wind zones, and water.
- Tile/LOD generation, height maps, normal maps, collision, vegetation proxies, and world-origin/georeferencing support.
- Use A.N.T. Landscape as a reference/prototype, Blender Geometry Nodes for the original production graph, and BlenderGIS for importing DEM, raster, shapefile, GeoTIFF, and OpenStreetMap data.

### I. Urban environments, structures, architecture, and interiors

#### Urban generation

- Road graph from sketch, GIS, or OpenStreetMap.
- Parcel subdivision, zoning/style rules, building footprints, setbacks, height ranges, blocks, sidewalks, street furniture, signs, vegetation, traffic lanes, and damage/age variants.
- Keep attribution and ODbL requirements attached to any OpenStreetMap-derived project and export.

#### Structures and architecture

- Parametric walls, slabs, roofs, openings, doors, windows, stairs, rails, columns, beams, and facade systems.
- Building Tools is a useful MIT prototype for rapid floorplan/floor/door/window/roof/stair/balcony generation.
- Sverchok is valuable for advanced parametric geometry but GPL and best used as a Blender-side optional integration.
- IfcOpenShell's LGPL library can provide IFC semantics and conversion; Bonsai is a GPL Blender authoring layer.

#### Interiors

- Room adjacency graph, circulation, door/window placement, wall finishes, flooring, ceilings, lighting, fixtures, furniture zones, clutter density, and style kits.
- Start with deterministic rules and editable constraints. Generative AI can suggest layouts later, but every result must remain measurable, inspectable, and manually correctable.
- Label the output as visualization/design assistance, not certified architectural or code-compliance documentation.

### J. Audio visualizer pipeline

The present Luminarium/visualizer already provides a useful Canvas 2D foundation. The desktop pipeline should let any created graphic, layered painting, animation, SVG, GLB, material, particle system, or Geometry Nodes graph become a visualizer template.

Pipeline:

1. Import or create the visual asset.
2. Analyze live or recorded audio into amplitude, spectrum bands, centroid, rolloff, flux, onset/beat, pitch/chroma, and section markers.
3. Map features through a visual node graph with smoothing, envelopes, ranges, curves, random seeds, MIDI/OSC, and manual automation.
4. Drive 2D layer transforms/effects, 3D geometry, shaders, lights, particles, cameras, hair/cloth, and post-processing.
5. Preview in real time and bake deterministic keyframes/features for repeatable final renders.
6. Export live performance presets, transparent image sequences, WebM/MP4, or a Blender scene/render queue.

Meyda is a practical MIT-licensed JavaScript analyzer for the live TypeScript path. Blender 5.2 can also sample sound frequencies directly in Geometry Nodes, making the installed version unusually well suited to the offline/final-render path. FFmpeg is appropriate for encoding only with a documented LGPL/GPL build and codec review.

## 6. Open-source shortlist

| Project | License | Best use here | Important caution |
|---|---|---|---|
| Tauri 2 | MIT / Apache-2.0 | Desktop shell, local capabilities, helper processes | System webviews vary; validate GPU behavior per OS |
| Electron | MIT | Fallback desktop shell with bundled Chromium | Larger installers and memory footprint |
| Babylon.js | Apache-2.0 | Interactive 3D viewport, glTF, animation, WebGPU/WebGL | Preview engine, not a full DCC/simulator |
| Blender 5.2 LTS | GPL | Geometry, simulation, rigging, animation, rendering | Keep GPL bridge/distribution obligations explicit |
| libmypaint | ISC | Mature brush behavior and tiled-surface research | Native integration/WASM work required |
| CanvasKit/Skia | BSD-style | GPU-accelerated 2D paths, text, shaders, compositing | Large WASM and more manual editor architecture |
| OpenRaster | Open specification | Layered 2D interchange | Spec extensions vary between applications |
| MPFB | GPL; core assets CC0 | Parametric humans, clothing/assets, Rigify | Blender-side boundary; asset provenance still matters |
| Rigify | GPL | Original human/animal rig-generator foundation | It creates controls; fitting and skinning still need work |
| Auto-Rig Pro | GPL code plus asset-specific terms | Optional installed adapter and export compatibility | Do not require it or mix source into the MIT core |
| GarmentCode | MIT | Parametric sewing-pattern generator | Simulation dependencies and dataset licenses need review |
| Seamly2D | GPL-3+ | Pattern ideas/interchange/optional companion | Copyleft boundary |
| A.N.T. Landscape | GPL-2+ | Terrain/erosion prototype | Limited support; build original production graphs |
| BlenderGIS | License in repository | DEM/GIS/OSM import | Older Blender baseline; service keys and data licenses |
| Building Tools | MIT | Building grammar prototype | Reported Blender 4.0 compatibility; test on 5.2 |
| Sverchok | GPL-3 | Advanced parametric architecture/geometry | Blender-side optional integration |
| IfcOpenShell | LGPL-3+ | IFC data, conversion, validation | BIM is a large specialist domain |
| Bonsai | GPL-3+ | Blender-native IFC authoring | Blender-side boundary |
| RigNet | GPL-3 | Auto-rigging research baseline | Old Python/CUDA stack; not a production dependency |
| UniRig | MIT research release | Diverse mesh skeleton/skinning R&D | Verify weights, checkpoints, hardware, and redistribution |
| Meyda | MIT | Live/offline audio features in TypeScript | Mature but not a complete music-understanding system |
| FFmpeg | LGPL-2.1+ or GPL depending build | Encoding and media conversion | Codec patents and build configuration require review |
| glTF/GLB | Royalty-free standard | Runtime delivery, web/game/AR assets | Not ideal as the only editable scene source |
| OpenUSD | TOST license | Large editable scene composition/interchange | More complex toolchain and concepts |

## 7. Delivery roadmap

The whole vision is comparable in breadth to several mature creative applications. Deliver it through vertical slices that end in usable art, not through one long infrastructure project.

### Phase 0 — Stabilize and extract (2–4 weeks)

- Fix canvas zoom/pan/rotation and add viewport regression tests.
- Split the current component into document core, renderer, commands, persistence, export, and UI packages.
- Replace data URLs in working memory with binary asset handles.
- Define `.pmstudio` v1 and `.nml` migration.
- Add crash fixtures, larger-document benchmarks, and browser tests.

Exit gate: the website Art Room is more reliable than v0.8.1 and its core runs without Next.js-specific assumptions.

### Phase 1 — Desktop foundation (4–8 weeks)

- Tauri shell, native open/save, recent projects, recovery, preferences, update channel, asset index, background jobs, and logs.
- Preserve all existing painting, animation, comic, and export features.
- Add OpenRaster and image-sequence workflows.

Exit gate: a signed Windows alpha can create, save, recover, reopen, and export real projects without browser storage.

### Phase 2 — 3D and Blender bridge (6–10 weeks)

- Babylon viewport, scene outliner, transforms, cameras/lights/materials, GLB/USD import/export, and asset validation.
- Blender discovery, version check, job protocol, progress/cancellation, thumbnail/render jobs, and Open in Blender.
- Ship a small original Geometry Nodes generator to prove round-trip editing.

Exit gate: one project mixes a layered painting, a 3D scene, a camera animation, and a Blender render without losing editability.

### Phase 3 — Character vertical slice (8–14 weeks)

- MPFB human adapter, neutral engine schema, body/face controls, material presets.
- Hair guide generator, clothing-pattern MVP, drape job, Rigify fitting/skinning, deformation tests, GLB export.
- Optional Auto-Rig Pro adapter.

Exit gate: create a human, change proportions, generate hair and one fitted outfit, rig/pose it, and export a working animated GLB.

### Phase 4 — World vertical slice (8–14 weeks)

- Seeded terrain, biome scatter, road sketch, parcels, one building grammar, rooms, doors/windows, and interior furnishing rules.
- GIS/OSM import prototype with attribution tracking.
- IFC import/export experiment through IfcOpenShell.

Exit gate: create a small natural or urban environment, edit its seed/constraints, place a character, and render a shot.

### Phase 5 — Audio-visual vertical slice (6–10 weeks)

- Shared audio-analysis cache, mapping node graph, live preview, MIDI/OSC, 2D/3D targets, and bake-to-keyframes.
- Blender 5.2 sound-node templates, render queue, and documented FFmpeg packaging.

Exit gate: turn an Art Room graphic or animation into a repeatable custom visualizer and export a synchronized video.

### Phase 6 — Production hardening (ongoing)

- macOS/Linux packaging, GPU fallbacks, performance tiers, colour management, accessibility, localization, signed updates, plugin SDK, asset licensing UI, telemetry opt-in, backups, and crash recovery.
- Expand species, garments, terrain, architecture, interior styles, visualizer templates, render farms, and collaborative interchange only after each earlier vertical slice is stable.

## 8. First implementation backlog

1. Fix and test the website canvas viewport.
2. Write `.pmstudio` v1 and a migration plan from `.nml` version 1.
3. Extract the current 2D document/command engine from the React component.
4. Prototype Tauri file open/save and recovery on Windows.
5. Prototype one Babylon GLB viewport next to the existing 2D canvas.
6. Define the Blender job protocol and make a version/render smoke test against Blender 5.2.
7. Build one original Geometry Nodes generator and round-trip its parameters.
8. Prototype MPFB → Rigify → GLB as the first character path.
9. Prototype GarmentCode pattern parameters → Blender cloth drape for one shirt or dress.
10. Import an existing Art Room image into the visualizer and map bass/mid/treble/onset to four editable properties.

## 9. Research references

- [Tauri 2 architecture](https://v2.tauri.app/concept/architecture/)
- [Tauri external binaries/sidecars](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/develop/sidecar.mdx)
- [Electron process model](https://github.com/electron/electron/blob/main/docs/tutorial/process-model.md)
- [Babylon.js](https://github.com/BabylonJS/Babylon.js)
- [Babylon.js WebGPU support](https://github.com/BabylonJS/Documentation/blob/master/content/setup/support/webGPU.md)
- [Blender license and add-on guidance](https://www.blender.org/about/license/)
- [Blender 5.2 LTS](https://www.blender.org/releases/5-2/)
- [Blender 5.2 Geometry Nodes physics](https://code.blender.org/2026/07/geometry-nodes-physics/)
- [Blender hair interpolation](https://docs.blender.org/manual/en/5.1/modeling/geometry_nodes/hair/generation/interpolate_hair_curves.html)
- [Rigify](https://docs.blender.org/manual/en/latest/addons/rigify/index.html)
- [MPFB](https://github.com/makehumancommunity/mpfb2)
- [MakeHuman/MPFB licensing](https://static.makehumancommunity.org/about/license.html)
- [GarmentCode](https://github.com/maria-korosteleva/GarmentCode)
- [Seamly2D](https://github.com/FashionFreedom/Seamly2D)
- [A.N.T. Landscape](https://extensions.blender.org/add-ons/antlandscape/)
- [BlenderGIS](https://github.com/domlysz/BlenderGIS)
- [Building Tools](https://github.com/ranjian0/building_tools)
- [Sverchok](https://github.com/nortikin/sverchok)
- [IfcOpenShell/Bonsai](https://github.com/IfcOpenShell/IfcOpenShell)
- [OpenStreetMap copyright and licensing](https://www.openstreetmap.org/copyright)
- [RigNet](https://github.com/zhan-xu/RigNet)
- [UniRig paper/project](https://zjp-shadow.github.io/works/UniRig/)
- [libmypaint](https://github.com/mypaint/libmypaint)
- [CanvasKit](https://docs.skia.org/docs/user/modules/canvaskit/)
- [OpenRaster](https://www.openraster.org/)
- [Meyda](https://github.com/meyda/meyda)
- [FFmpeg legal/license information](https://ffmpeg.org/legal.html)
- [glTF](https://www.khronos.org/gltf/)
- [OpenUSD](https://openusd.org/)

