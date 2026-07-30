import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const output = mkdtempSync(join(tmpdir(), "nml-tests-"));
try {
  execFileSync(process.execPath, [
    join(process.cwd(), "node_modules", "typescript", "bin", "tsc"),
    "app/natural-media-lab/documentModel.ts", "app/natural-media-lab/pdfEncoder.ts", "app/natural-media-lab/brushEngine.ts",
    "--target", "ES2022", "--module", "commonjs", "--outDir", output, "--skipLibCheck",
  ], { stdio: "pipe" });
  const require = createRequire(import.meta.url);
  const { parseProject } = require(join(output, "documentModel.js"));
  const { encodeComicPdf } = require(join(output, "pdfEncoder.js"));
  const { BRUSHES } = require(join(output, "brushEngine.js"));
  const oldProject = {
    format: "natural-media-lab", version: 1, name: "Legacy", width: 100, height: 100,
    layers: [{ id: "layer", name: "Paint", dataUrl: "", visible: true, locked: false, opacity: 1, blendMode: "source-over" }],
    activeLayerId: "layer",
  };
  const migrated = parseProject(oldProject);
  assert.equal(migrated.comic.pages.length, 1);
  assert.equal(migrated.comic.print.profile, "a4");
  assert.equal(migrated.comic.print.cropMarks, true);
  assert.deepEqual(migrated.comic.letteringStyles, []);
  const marker = BRUSHES.find((brush) => brush.id === "marker");
  assert.ok(marker.opacity >= 0.9);
  assert.ok(marker.flow >= 0.9);
  assert.ok(marker.grain <= 0.02);
  for (const filename of ["natural-media-sketchbook.nml", "three-panel-comic.nml", "full-studio-showcase.nml"]) {
    const example = parseProject(JSON.parse(readFileSync(join(process.cwd(), "public", "examples", filename), "utf8")));
    assert.ok(example.layers.length > 0);
    assert.ok(example.comic.pages.length > 0);
  }
  const showcaseSource = JSON.parse(readFileSync(join(process.cwd(), "public", "examples", "full-studio-showcase.nml"), "utf8"));
  const showcase = parseProject(showcaseSource);
  const roundTrip = parseProject(JSON.parse(JSON.stringify(showcase)));
  assert.equal(roundTrip.layers.length, 2);
  assert.equal(roundTrip.animation.frames.length, 2);
  assert.equal(roundTrip.rig.bones.length, 1);
  assert.equal(roundTrip.comic.pages.length, 2);
  assert.equal(roundTrip.comic.pages[0].panels[1].sourcePageId, "showcase-page-2");
  assert.equal(roundTrip.comic.letteringStyles[0].name, "Hand dialogue");
  assert.equal(roundTrip.comic.pageMasters[0].panels.length, 3);
  assert.deepEqual(roundTrip.comic.print, showcase.comic.print);
  const jpeg = "data:image/jpeg;base64,/9j/2Q==";
  const pdf = new Uint8Array(await encodeComicPdf([{ jpegDataUrl: jpeg, pixelWidth: 1, pixelHeight: 1 }, { jpegDataUrl: jpeg, pixelWidth: 1, pixelHeight: 1 }], 595, 842, "QA").arrayBuffer());
  const text = new TextDecoder().decode(pdf);
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text, /\/Count 2/);
  assert.match(text, /xref[\s\S]*startxref[\s\S]*%%EOF$/);
  console.log("Natural Media Lab: migration and PDF checks passed.");
} finally {
  rmSync(output, { recursive: true, force: true });
}
