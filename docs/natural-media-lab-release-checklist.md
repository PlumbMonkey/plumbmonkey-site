# Natural Media Lab Release Checklist

## Before release

- Run `npm test` and require migration and PDF checks to pass.
- Run `npm run build` and require every static route to export.
- Open `/natural-media-lab` at desktop and narrow widths.
- Complete the guided tour with keyboard-only navigation.
- Open both example `.nml` projects and confirm migration.
- Open the full-studio showcase and confirm layers, two animation frames, one rig bone, two comic pages, a sourced panel, styles, and A4 print settings.
- Paint with mouse, pen, and touch where hardware is available.
- Save and reopen a project containing layers, animation, a rig, and comic pages.
- Export PNG, JPG, GIF, and a two-page PDF.
- Parse the PDF and confirm its page count, media size, title, and final trailer.
- Test PDF cancellation during page preparation and worker encoding.

## Deployment

- Preserve the static-export Next.js configuration.
- Publish the entire `out` directory, including `/examples`.
- Run `npm run test:release` against the final `out` directory.
- Confirm `/natural-media-lab`, example downloads, static chunks, and worker chunks return successfully.
- Confirm the production origin allows module workers and blob downloads.
- Check the deployed site at desktop and mobile breakpoints.
- Record the deployed commit and release version.

## Support triage

Ask users to provide:

- Browser and operating-system version
- Canvas dimensions, layer count, animation-frame count, and comic-page count
- The operation attempted and whether the safe fallback appeared
- A sanitized `.nml` project only when they consent to share the artwork

Never request passwords, browser storage, private account data, or unrelated files.

## Recovery guidance

- First try reopening the studio on the same device so IndexedDB recovery can load.
- Use the most recent downloaded `.nml` file when recovery is unavailable.
- Keep the original project before attempting migration or manual JSON repair.
- Raster and PDF exports are delivery files and cannot restore editable layers.

## Release decision

Ship only when automated tests, the production build, example downloads, browser smoke checks, and one complete project round-trip all pass.
