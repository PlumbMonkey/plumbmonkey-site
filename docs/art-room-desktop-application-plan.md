# Art Room desktop application — product summary, technical audit, and roadmap

Updated: 2026-08-30

## Executive recommendation

Build the desktop product as an orchestration studio instead of attempting to re-create Krita, Blender, Marvelous Designer, CityEngine, MakeHuman, and TouchDesigner from scratch.

The recommended foundation is:

- Keep the existing React interface and extract its document, painting, animation, comic, and procedural systems into reusable packages.
- Package the interface with Tauri 2 for local files, projects, recovery, background jobs, and a smaller desktop footprint.
- Use Babylon.js for the interactive 3D viewport, with WebGPU when available and WebGL as the fallback.
- Use the user's installed Blender as the high-quality geometry, simulation, rigging, animation, and rendering worker.
- Use a separately licensed Blender bridge add-on for jobs that require `bpy`. Keep the MIT application core separate from GPL Blender/add-on code.
- Use GLB/glTF for fast preview and delivery, USD for large editable scenes, OpenRaster for layered 2D interchange, and a new zipped `.pmstudio` project format as the product's source of truth.
- Put the local asset catalog and drag-and-drop browser into the first desktop milestone. The supplied Blender projects are broad enough to seed a distinctive Plumbmonkey library before the procedural generators are complete.

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

## 3. Canvas zoom fix — completed separately

The website repair was implemented and verified before expanding this roadmap. Zoom now changes the paper's real layout dimensions, a rotation-aware viewport supplies correct scroll bounds, Space/middle-button panning scrolls the viewport, and the center row can no longer grow underneath the timeline. Accessible zoom-in/out buttons were added beside the slider.

Tests cover 35%, 70%, 100%, and 160%, pointer-coordinate round trips, and rotated bounds. Interactive checks confirmed that all canvas edges are reachable at 160%, including with a 15° rotation, and that the animation timeline no longer covers the view controls.

The detailed diagnosis, measurements, changed files, and limited follow-on hardening are recorded in `docs/art-room-zoom-fix.md`. The desktop phases below can therefore treat the repaired viewport as the Phase 0 baseline instead of carrying the website defect into the new shell.

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

### Intuitive drag-and-drop asset browser

The browser is a core workspace, not a file-open dialog added at the end. It should index user-approved folders, `.pmstudio` projects, Blender Asset Catalogs, and imported packs without altering the source files.

Every item receives a thumbnail or turntable, type, tags, dimensions/polycount, dependencies, rig compatibility, generator recipe, source path, modification date, hash, license/provenance state, and missing-file warnings. Search must support plain language, filters, saved collections, favourites, recently used items, and visual categories.

Import modes are explicit:

- **Copy into project** for a self-contained editable asset.
- **Link to source** for a file that should update when its original changes.
- **Instance** for many lightweight placements of one asset.
- **Reference only** for mood boards, model sheets, and non-exporting guides.

Drop behavior is contextual and reversible:

| Drop target | Result |
|---|---|
| 2D canvas | New raster/vector/reference layer at the drop point |
| Comic panel | Fill or link the panel artwork while preserving crop controls |
| Timeline | Create image, animation, audio, video, pose, or camera clips |
| 3D viewport | Place a scene instance on the surface/grid under the pointer |
| Character | Attach clothing, hair, prop, material, pose, or animation to a compatible socket/role |
| Material slot | Assign or instance the material, with an undoable replacement preview |
| Asset collection | Copy, link, tag, or add a non-destructive catalogue reference |

The browser must never execute an imported `.blend` script automatically. Blender files are scanned in a background process, missing dependencies are reported, and assets are appended/linked only after the user chooses an import mode.

## 5. Supplied Blender asset library and ingest plan

A read-only Blender 5.2 inventory was run against the supplied working files and the `.blend` payloads inside the three archives. The material is broad enough to seed the first application library and exercise most of the planned browser categories.

### Source overview

| Source | Inventory highlights | Strong initial asset families |
|---|---|---|
| Ghost Circuit rehearsal room | 1,133 objects, 997 mesh objects, 81 materials, four armatures, eight drum actions, 20 marked assets | Guitars, basses, keyboards, drums, amps, stands, cables, rehearsal-room shell, lights, cameras |
| Rad Casino V2 | 632 objects, about 2.08M vertices/1.92M polygons, 201 materials, 43 lights, six actions | Casino floor, poker/roulette/blackjack props, lounge/bar furniture, exterior strip, signs, landscaping, cameras |
| Spectral Arcade | 285 objects, 12 named cabinet families, 16 text objects, 35 lights, 14 of 15 images packed | Arcade cabinets, bezels, controls, marquee art, docking points, high-score displays, room kit |
| Spectral Luminarium | 65 objects, 46 meshes, 22 materials, 16 lights, three cameras | Dome architecture, console, glass/crystal/gold materials, chandelier, dais and lighting kit |
| Spectral Music Room | 168 objects, 119 meshes, 47 materials, five cameras | Drum/synth stations, consoles, cables, screens, room architecture, decorative lighting |
| Furnished house study | 435 objects, 356K vertices, 43 materials, 67 Geometry Nodes modifiers | Doors, baseboards, furniture, fixtures, trees, room components, procedural-detail experiments |
| Extended theatre | Two scenes, 1,178 objects, 138 lights, 120 Geometry Nodes modifiers, linked performance-theatre library | Auditorium, stage, green room, corridors, curtains, seating, dressing room, piano, stage props, moving-light rig |
| Performance theatre library | 535 objects, 24 lights, theatre architecture and stage collections | Reusable theatre shell, seating, curtains, piano, stage props, spot/wash movers |
| NYC street and alley | Two scenes, 63 objects, 44 meshes, 58 materials, 17 lights | Modular buildings, wet streets, alleys, roofs/pipes, props, fog/atmosphere, skyline, sodium lighting |
| Victorian house and weather | Five seasonal/interior scenes, 496 objects, about 1.64M vertices, 37 Geometry Nodes modifiers, 24 lightning actions, one volume plus 150 VDB frames | Victorian exterior/foyer, seasons, trees/flowers/weeds, fog/clouds, lightning, tornado and wind/weather presets |

The two theatre archives also contain 42 build scripts; the NYC archive contains 23. Those scripts are valuable references for turning existing manual builds into original parameterized generators, but they should be reviewed and ported into typed generator recipes rather than executed from the asset browser.

### Ingest pipeline

1. Scan a source file read-only and store a manifest; never rewrite the artist's original `.blend`.
2. Detect scenes, collections, object types, marked assets, materials, images, libraries, rigs, actions, Geometry Nodes, simulation caches, dimensions, and complexity.
3. Report missing or external dependencies and offer relinking/packing in a disposable working copy.
4. Review ownership and licenses for every embedded or linked dependency, even when the scene composition and modelling are original.
5. Classify reusable collections into architecture, interiors, props, instruments, vehicles, vegetation, characters/rigs, lighting, cameras, effects, materials, and generators.
6. Normalize names, units, origin/pivot, transforms, scale, material slots, UVs, preview camera, collision/LOD policy, and export axes in a generated working copy.
7. Generate thumbnails/turntables and optimized GLB proxies while keeping `.blend` as the editable authority.
8. Approve the result into a versioned `.pmasset` package with provenance, dependencies, source link, and update status.

### First import waves

1. **Spectral rooms and arcade:** compact, organized, mostly self-contained, and ideal for validating thumbnails, materials, cameras, lights, hotspots, and room-kit drag/drop.
2. **Theatre and rehearsal assets:** rich reusable props, instruments, marked assets, stage architecture, lighting rigs, and linked-library behavior.
3. **NYC and Victorian environment kits:** validate modular city pieces, seasons, Geometry Nodes, atmosphere, volumes, VDB sequences, and effects animation.
4. **Casino:** optimize before general browsing because of its roughly 1.9M polygons; split into room, furniture, gaming, exterior, sign, vehicle, and landscaping packs.
5. **House study:** use after reviewing training/source provenance and missing references; its 67 Geometry Nodes modifiers make it valuable generator research even if some finished assets remain reference-only.

Three missing images were reported in the rehearsal file, three in the casino, and one in the house study. The theatre/NYC/Victorian archive payloads were otherwise clean in the scan. The asset browser must make this condition visible rather than silently substituting blank textures.

## 6. Product workspaces and feature plan

### A. Paint and illustration

- Tiled/lazy layer storage, masks, groups, clipping, adjustment layers, more blend modes, non-destructive transforms, selection transforms, freehand/lasso/magic-wand selection, filters, vector/text layers, and colour-managed display.
- Brush preset editor, texture tips, stabilizer, perspective/symmetry assistants, brush tags/favourites, and portable brush packs.
- CanvasKit or a native/tiled backend for compositing, with `libmypaint` evaluated for its permissively licensed brush engine.
- OpenRaster import/export and Photoshop-compatible export only after licensing/compatibility review.

### B. Animation, comics, and storyboards

- A shared timeline for raster frames, vector/keyframe animation, 2D rigs, 3D shots, cameras, audio, markers, and dialogue.
- Exposure sheets, frame ranges, copy/paste, nested clips, graph editor, motion paths, audio scrubbing, automatic lip-sync suggestions, and MP4/WebM image-sequence export.
- A story workspace for scripts, beats, issues/chapters, scenes, locations, cast, reference boards, shot lists, and continuity notes. Script lines can create panel/dialogue placeholders without locking the artist into an automatic layout.
- Page, spread, infinite-scroll, webtoon, strip, manga/right-to-left, storyboard, and presentation formats. Include templates, master pages, facing-page preview, page numbering, section breaks, reordering, duplication, variants, and imposition preview.
- Panel tools for rectangular, polygon, curved, borderless, inset, overlapping, and bleeding panels; editable gutters; perspective grids; panel masks; camera guides; safe/action/title areas; and reusable layouts.
- Smart panels can retain a link to a 2D scene, 2D rig, or 3D shot. The artist can pose, light, and rerender the source while preserving crop, lettering, paint-over, and page layout.
- Vector speech/thought/whisper/shout/radio balloons, editable multi-point tails, connectors, linked balloon chains, captions, sound effects, emphasis marks, and reading-order guides.
- Rich lettering with font collections, favourites, fallback checks, OpenType features, vertical text, ruby/furigana support, reusable character/balloon/SFX styles, spell check, find/replace, and translation variants.
- Character, prop, costume, location, and pose libraries exposed directly in the page browser. Dragging a reusable character into a panel can create a linked 2D puppet, a 3D render source, or a flattened copy.
- Non-destructive filters, halftone/screentone libraries, speed lines, focus lines, hatching, ink trapping, panel colour grades, global issue palettes, and style-safe batch updates.
- Print/prepress tools: trim/bleed/safe areas, DPI checks, missing-font/image checks, colour-profile warnings, black-ink coverage warnings, PDF/X handoff research, publisher presets, proof sheets, and export reports.
- Digital publishing tools: accessible reading order, optional alt text/transcripts, tap targets, panel-by-panel export, webtoon slicing, EPUB/fixed-layout research, and localized editions.

#### 2D auto-rigging and deformation

Support two complementary rig types:

1. **Cut-out rig:** separate head/torso/limb/hand/face layers connected by pivots, parenting, draw order, constraints, IK, switches, and replaceable sprites. This is predictable and best for clean production characters.
2. **Mesh-deformation rig:** triangulate one painting or a group of layers, bind it to bones, paint rigidity/pins/weights, and deform the art smoothly. This is best for single illustrations, hair, cloth, faces, and organic secondary motion.

The assisted setup flow should:

1. Import layered OpenRaster/SVG/PNG sequences or a flattened character.
2. Detect alpha islands and suggest semantic pieces from layer names and geometry.
3. Optionally use on-device pose/face/hand landmarks to suggest joints and facial controls; require a user review before creating the rig.
4. Generate pivots or a deformation mesh, propose a bone hierarchy, and calculate initial weights.
5. Let the artist paint weights, rigidity, pins, flex zones, and stacking-order influence.
6. Add angle limits, stretch rules, two-bone IK, pole controls, space switching, transform constraints, paths, and simple springs/dynamics.
7. Create turn/pose/sprite switches, blink controls, mouth/viseme sets, phoneme timing, and reusable expression boards.
8. Run silhouette, joint-bend, draw-order, and extreme-pose checks before publishing the puppet.

OpenToonz is the most useful permissive code/behavior reference: its BSD-licensed Plastic workflow combines triangulated meshes, skeleton vertices, rigidity painting, angle bounds, stacking order, multiple skeletons, and function curves. Synfig's GPL Skeleton Deformation layer is a useful behavior reference but should not be copied into the MIT core. Godot's MIT `Skeleton2D`/`Bone2D` design is another useful runtime reference. MediaPipe code is Apache-2.0 and can suggest landmarks locally, but model redistribution and telemetry terms must be verified before bundling any model.

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

- Define an engine-neutral **Rig Recipe** first: semantic landmarks, bone roles, deform hierarchy, controller roles, constraints, twist/roll policy, sockets, facial controls, weight groups, test poses, and export mapping. Project features must target semantic roles such as `left_hand`, not Rigify or Auto-Rig Pro bone names.
- Each rig driver implements the same operations: validate mesh, fit guide/metarig, generate controls/deform skeleton, bind/weight, create facial rig, test deformation, bake animation, retarget, and export.
- Production fallback path: fit landmarks, generate a Rigify metarig, create control/deform rigs, calculate/transfer weights, run deformation tests, and publish a clean export skeleton.
- Rigify already includes human and several animal metarigs and is the best free, maintainable base for an original Plumbmonkey workflow.
- R&D path: evaluate UniRig for diverse skeleton/skin prediction and RigNet as an older baseline. Both need quality, dependency, model-license, and redistribution review before product use.

### G. Auto-Rig Pro interoperability

Local inspection found:

- Blender 5.2.0 LTS installed.
- Auto-Rig Pro 3.78.26 installed for Blender 5.2.
- Its manifest describes automatic rig generation from reference bones plus file/network/clipboard permissions.
- The included license states that source components are GPL and generated rigs belong to the end user; asset subfolders have their own Royalty Free/CC0 terms.

Recommended approach:

- Do not make the main application depend on Auto-Rig Pro.
- Add an optional adapter that detects the installed add-on and invokes documented Blender operators for users who own/install it. Detection records Blender path/version, add-on version, enabled state, and required operator capabilities; it never installs or updates the add-on automatically.
- Treat generated rigs as user project assets.
- Build the default original rigging workflow on Rigify and Blender APIs.
- If any Auto-Rig Pro GPL source is adapted, keep that derivative in the GPL Blender bridge and publish the corresponding source. Do not copy it into the MIT desktop core.

### Rig-driver switch behavior

On first use, the application runs a capability check:

- **Auto-Rig Pro available and compatible:** offer **Auto-Rig Pro** and **Free Rigify**. Remember the user's default, but allow a per-character choice.
- **Auto-Rig Pro missing, disabled, or incompatible:** select **Free Rigify** automatically and show a non-blocking explanation. Every core character workflow remains usable.
- **No compatible Blender/Rigify:** allow mesh/landmark preparation and queue generation until Blender is configured; never strand the project in a proprietary state.

The project stores the selected driver, driver version, Rig Recipe version, generated control rig, and a clean semantic deform/export skeleton. Animation clips and attachments target the semantic skeleton so they can be retargeted between drivers. Switching a character with existing animation creates a new rig variant and runs retarget/deformation tests; it does not destructively replace the working rig.

The user-facing choice should remain simple:

```text
Rig driver
● Auto-Rig Pro 3.78.26 — installed and compatible
○ Free Rigify — always available with Blender

[Generate rig]  [Advanced mapping…]
```

Auto-Rig Pro-specific options belong inside its adapter panel. Common controls—body type, landmarks, fingers, face, twist bones, export target, weight quality, and test poses—use the shared schema.

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

## 7. Open-source shortlist

| Project | License | Best use here | Important caution |
|---|---|---|---|
| Tauri 2 | MIT / Apache-2.0 | Desktop shell, local capabilities, helper processes | System webviews vary; validate GPU behavior per OS |
| Electron | MIT | Fallback desktop shell with bundled Chromium | Larger installers and memory footprint |
| Babylon.js | Apache-2.0 | Interactive 3D viewport, glTF, animation, WebGPU/WebGL | Preview engine, not a full DCC/simulator |
| Blender 5.2 LTS | GPL | Geometry, simulation, rigging, animation, rendering | Keep GPL bridge/distribution obligations explicit |
| libmypaint | ISC | Mature brush behavior and tiled-surface research | Native integration/WASM work required |
| CanvasKit/Skia | BSD-style | GPU-accelerated 2D paths, text, shaders, compositing | Large WASM and more manual editor architecture |
| OpenRaster | Open specification | Layered 2D interchange | Spec extensions vary between applications |
| OpenToonz | Modified BSD; third-party folders vary | 2D mesh/skeleton/rigidity/stacking workflow reference | Reuse only clearly licensed core files; do not absorb the whole editor architecture |
| Synfig | GPL | Skeleton and raster-deformation behavior reference | Keep as research/interop unless a GPL boundary is desired |
| Godot Engine | MIT | `Skeleton2D`/`Bone2D` runtime and 2D skinning reference | Integrating the whole engine is unnecessary; borrow concepts or isolated permissive code only |
| MediaPipe | Apache-2.0 code | Optional local pose/face/hand landmark suggestions | Verify each model's redistribution terms and telemetry behavior before bundling |
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

## 8. Delivery roadmap

The whole vision is comparable in breadth to several mature creative applications. Deliver it through vertical slices that end in usable art, not through one long infrastructure project.

The time bands below describe concentrated engineering effort for a small experienced team; a solo build should expect substantially longer calendar time. Product/design QA, original asset preparation, and licence review run alongside engineering.

### Phase 0A — Website viewport repair — complete

- The zoom repair was implemented separately before desktop work.
- Geometry tests, the existing application suite, a production build, and hands-on 35–160%/rotation/scroll checks pass.

Exit gate: met on 2026-08-30. The repaired website viewport is the desktop extraction baseline.

### Phase 0B — Extract and stabilize the 2D core (3–5 weeks)

- Progress through checkpoint 14: rotated manipulation, project/package contracts, versioned document and raster recovery, the shared document/command core, verified binary checkpoints, raster-surface adapters, a handle-backed live raster session, synchronized working-document state and recovery projection, dirty-tile persistence/restoration, reversible tile-revision commands, unified mixed Undo/Redo history, bounded in-memory journal compaction, shared document snapshots, natural/procedural painting engines, animation interpolation/timing/rendering, shared rig math, canvas operations, unified comic rendering, export planning and cancellable job coordination, workload profiling, deterministic generator/encoder tests, and the destructive-edit/forced-restart regression gate are complete.
- Split the current component into document, viewport, renderer, commands, persistence, rig, comic, export, and UI packages.
- Apply inverse viewport mapping to rotated bone and comic manipulation.
- Replace data URLs in working memory with binary handles and tiled/lazy layer storage.
- Define `.pmstudio` v1, `.pmasset` v1, and `.nml` migration.
- Add large-document benchmarks, recovery/crash fixtures, viewport end-to-end tests, and deterministic generator tests.

Exit gate: the complete current Art Room runs from reusable packages without Next.js-specific assumptions and survives forced restart/recovery tests.

### Phase 1 — Desktop and project foundation (4–8 weeks)

- Tauri shell, native open/save, recent projects, recovery versions, preferences, background jobs, logs, and Windows packaging.
- Project graph, command journal/checkpoints, asset references, cache invalidation, job cancellation, and missing-file relinking.
- Preserve existing painting, animation, comics, PDF, GIF, and `.nml` workflows; add OpenRaster and image sequences.

Exit gate: a Windows alpha can create, save, recover, reopen, migrate, and export real projects without browser storage.

### Phase 2 — Asset browser and Plumbmonkey starter library (5–8 weeks)

- Folder watching, SQLite index, background `.blend` scan, thumbnails/turntables, collections, tags, favourites, filters, provenance, dependency warnings, and Copy/Link/Instance/Reference modes.
- Implement the contextual drop contracts for the canvas, comic panels, timeline, 3D placeholder, characters, materials, and collections.
- Ingest the Spectral rooms/arcade first, then theatre/rehearsal, NYC/Victorian, casino, and house-study research assets.
- Add `.pmasset` packaging, versioning, source-update detection, proxy generation, and batch approval tools.

Exit gate: users can point the app at the supplied source folders, find assets visually, drag them into projects, reopen those projects, and understand every missing dependency or source update.

### Phase 3 — Advanced comics and 2D animation/auto-rigging (8–12 weeks)

- Story/script/continuity workspace, page/spread/webtoon formats, advanced panel geometry, linked smart panels, richer lettering/balloons/SFX, styles, preflight, and digital/print publishing presets.
- Cut-out rig improvements: semantic layers, auto pivots, IK, limits, space switching, draw-order animation, sprite/pose switches, visemes, and reusable puppets.
- Mesh-deformation rig MVP: triangulation, bones, initial weight generation, painted weights/rigidity/pins, bend tests, and baked/exported animation.
- Optional local landmark suggestions behind an explicit reviewed setup flow.
- Link a 2D puppet or future 3D shot to a comic panel and preserve paint-over plus crop/lettering when rerendering.

Exit gate: create a multi-page issue containing hand-painted panels, a reusable auto-assisted 2D character rig, linked panel updates, professional lettering, and print/digital preflight.

### Phase 4 — 3D viewport and Blender bridge (6–10 weeks)

- Babylon viewport, scene outliner, transforms/gizmos, snapping, cameras, lights, PBR materials, GLB/USD import/export, drag/drop placement, and asset validation.
- Blender discovery/version check, separately licensed bridge, typed job protocol, progress/cancellation, logs, dependency collection, thumbnail/render jobs, and **Open in Blender**.
- Ship one original Geometry Nodes generator and prove parameter/seed round trips.

Exit gate: one `.pmstudio` project mixes layered artwork, a supplied 3D environment asset, a camera animation, and a Blender render without losing editability or provenance.

### Phase 5 — Characters, dual rig drivers, hair, and clothing (10–16 weeks)

- Neutral character and Rig Recipe schemas, MPFB human adapter, face/body controls, materials, test poses, and semantic export skeleton.
- Free Rigify driver as the guaranteed path; capability detection and optional Auto-Rig Pro 3.78.26+ adapter as the alternate driver.
- Driver selection, generation, weight tests, retargeting, rig variants, attachment sockets, action library, and GLB/Blender export.
- Hair guides/interpolation/dynamics/LOD MVP and one parametric GarmentCode-derived outfit with Blender drape, weight transfer, and corrective tools.
- Begin generic quadruped plus one dog/wolf or cat template after the human workflow passes deformation tests.

Exit gate: create a character, change proportions, add hair and clothing, choose Auto-Rig Pro or the free driver, pose/animate it, switch through a tested rig variant, and export an animated GLB.

### Phase 6 — Landscapes, cities, architecture, and interiors (10–16 weeks)

- Seeded terrain/erosion, water, biome scatter, weather zones, LOD tiles, road sketch, parcels, and one editable building grammar.
- Rebuild selected NYC/Victorian/theatre construction ideas as typed original generators with stored parameters and seeds.
- Rooms, walls, slabs, roofs, doors/windows, stairs, furnishings, lighting layouts, style kits, and drag/drop asset population.
- GIS/OSM import with attribution tracking and an IFC import/export experiment through IfcOpenShell.
- VDB/weather ingest and safe cache packaging based on the Victorian archive.

Exit gate: create a natural or urban environment, generate/edit a structure and interior, populate it from the asset browser, place a character, apply weather, and render a shot.

### Phase 7 — Audio-visual pipeline (6–10 weeks)

- Shared local audio-analysis cache, mapping node graph, smoothing/envelopes, live preview, MIDI/OSC, 2D/3D/rig/material/light targets, and bake-to-keyframes.
- Convert an Art Room painting, comic panel, 2D puppet, Spectral-room scene, or custom Geometry Nodes graph into a reusable visualizer template.
- Blender 5.2 sound-node templates, deterministic render queue, transparent passes, and documented FFmpeg packaging.

Exit gate: turn an original graphic, animation, or 3D scene into a repeatable custom visualization and export synchronized live and rendered versions.

### Phase 8 — Production hardening and expansion (ongoing)

- macOS/Linux packaging, GPU fallbacks, performance tiers, colour management, accessibility, localization, signed updates, plugin SDK, asset licensing UI, telemetry opt-in, backups, and crash recovery.
- Expand species, garments, terrain, architecture, interiors, comics, visualizer templates, render farms, and interchange only after each earlier vertical slice is stable.

## 9. First implementation backlog

1. **Completed:** repair and verify the website canvas viewport; preserve the separate fix report.
2. **Completed:** finish inverse rotated-coordinate handling for bone and comic dragging; geometry coverage is in place, with the modifier-wheel browser interaction still tracked as a QA follow-up.
3. **Completed:** specify `.pmstudio` v1, `.pmasset` v1, binary handles, provenance, and `.nml` migration fixtures.
4. **In progress:** extract viewport, document, commands, persistence, painting, rigging, comics, and export services from the React component. The document model, recovery, commands, binary/checkpoint storage, raster geometry, handle-backed raster session and synchronized live working-document state, incremental tile persistence/restoration, revision commands, mixed raster-aware history controller, compatibility snapshot boundary, natural/procedural painting engines, animation interpolation/timing/rendering, rig math, canvas operations/compositing, comic layout/rendering, export planner, cancellable export-job controller, and workload profiler are now separated. The remaining Phase 0B work is replacing active frame/page/sprite data-URL payloads with handle-backed snapshots and limiting data-URL materialization to compatibility and canvas adapters.
5. Prototype Tauri native open/save, versioned recovery, command journal, and background-job cancellation on Windows.
6. Turn the read-only Blender inventory script into the asset-manifest worker and add missing-file/dependency/complexity reports.
7. Build the thumbnail/search/collection browser and ingest Spectral Arcade plus Spectral Luminarium as the first approved pack.
8. Implement Copy/Link/Instance/Reference plus canvas, panel, and timeline drag/drop contracts.
9. Specify the advanced comic book, smart-panel, lettering-style, story/continuity, and preflight data models.
10. Prototype a small 2D deformation rig: triangulated alpha mesh, bone hierarchy, automatic starting weights, rigidity painting, IK, and pose export.
11. Prototype one Babylon GLB viewport and drag a catalogued `.pmasset` into it.
12. Define the Blender job protocol and complete version, capability, render, cancel, and progress smoke tests against Blender 5.2.
13. Specify Rig Recipe v1 and prove capability detection for **Free Rigify** and the installed **Auto-Rig Pro 3.78.26** without copying add-on code.
14. Prototype MPFB → Rig Recipe → Rigify → semantic export skeleton → animated GLB; add the Auto-Rig Pro driver only after the neutral path passes.
15. Prototype one hair preset, one GarmentCode-derived garment/drape, and one asset-browser character attachment.
16. Rebuild one supplied environment construction script as an original typed/seeded generator and round-trip its parameters.
17. Import an Art Room graphic into the visualizer and map bass/mid/treble/onset to four editable 2D/3D properties.

## 10. Research references

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
- [OpenToonz Plastic mesh and skeleton workflow](https://github.com/opentoonz/opentoonz_docs/blob/master/source/create_animations_using_plastic_tool.rst)
- [OpenToonz source and Modified BSD licensing](https://github.com/opentoonz/opentoonz)
- [Synfig Skeleton Deformation Layer](https://synfig.readthedocs.io/en/stable/layers/skeleton_deformation.html)
- [Godot Bone2D and Skeleton2D](https://docs.godotengine.org/en/stable/classes/class_bone2d.html)
- [MediaPipe](https://github.com/google-ai-edge/mediapipe)
- [Meyda](https://github.com/meyda/meyda)
- [FFmpeg legal/license information](https://ffmpeg.org/legal.html)
- [glTF](https://www.khronos.org/gltf/)
- [OpenUSD](https://openusd.org/)
