# Natural Media Lab v0.8.1

## Release candidate

Natural Media Lab is now a local-first browser studio for natural painting, procedural art, animation, puppet performance, and multi-page comic publishing.

### Creative tools

- Fourteen natural-media brushes with wetness, grain, flow, scatter, and pressure controls
- Watercolor settling, ink feathering, dry pigment, smudging, oil height, and palette-knife behavior
- Deterministic procedural vegetation, weather, fire, smoke, cloud, and lightning emitters
- Layers, blend modes, selections, transforms, color harmonies, gradients, guides, and canvas navigation

### Motion and comics

- Frame animation, onion skinning, timing holds, transform interpolation, GIF export, rigs, poses, sprites, mouth cues, and camera keys
- Multi-page comics with independent artwork, editable panels, bubbles, captions, lettering styles, page masters, and sourced-panel crops
- PNG, JPG, whole-book print, and downloadable PDF publishing
- A4 and US Letter profiles with bleed and crop marks

### Reliability

- Versioned `.nml` project files and automatic on-device recovery
- Backward migration for painting, animation, rig, comic, page-art, layout-style, and print-profile additions
- Automated migration and PDF-structure tests
- Worker-based PDF encoding with a synchronous fallback
- Cancellable PDF jobs with safe worker cleanup
- First-run guided onboarding with a restartable Tour control
- Browser-verified responsive tour navigation and accessible dialog controls
- Contextual Help center with creative and publishing guidance
- Downloadable sketchbook and three-panel comic starter projects
- Release, deployment, recovery, and support checklist
- Full-studio editable showcase fixture and round-trip validation
- Machine-readable release manifest and static-package deployment gate
- Spectral Manor moonlit, burgundy, and brass studio theme
- Dark, dense chisel-marker behavior clearly separated from pencil and graphite

## Known limitations

- Large page compositing still occurs on the main thread before PDF encoding begins.
- GIF encoding is main-thread work and is capped at 480 pixels wide.
- Browser-driven accessibility and cross-browser regression tests are not yet automated.
- Rich text, custom fonts, audio tracks, MP4 export, and physically based fluid/impasto simulation remain future work.

## Next release

Phase 7D should move page and GIF compositing into workers, add browser regression coverage, and publish example `.nml` projects with guided onboarding.
