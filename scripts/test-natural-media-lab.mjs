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
    "app/natural-media-lab/documentModel.ts", "app/natural-media-lab/pdfEncoder.ts", "app/natural-media-lab/gifEncoder.ts", "app/natural-media-lab/brushEngine.ts", "app/natural-media-lab/proceduralEngine.ts", "app/natural-media-lab/viewportMath.ts",
    "packages/art-room-core/src/recovery.ts", "packages/art-room-core/src/projectFormats.ts", "packages/art-room-core/src/commandJournal.ts", "packages/art-room-core/src/documentModel.ts", "packages/art-room-core/src/documentSnapshot.ts", "packages/art-room-core/src/animation.ts", "packages/art-room-core/src/animationRenderer.ts", "packages/art-room-core/src/rig.ts", "packages/art-room-core/src/comicLayout.ts", "packages/art-room-core/src/comicRenderer.ts", "packages/art-room-core/src/canvasOperations.ts", "packages/art-room-core/src/editorCommands.ts", "packages/art-room-core/src/binaryStorage.ts", "packages/art-room-core/src/rasterSurface.ts", "packages/art-room-core/src/rasterRecovery.ts", "packages/art-room-core/src/rasterRevision.ts", "packages/art-room-core/src/rasterSession.ts", "packages/art-room-core/src/historyController.ts", "packages/art-room-core/src/exportPlanning.ts", "packages/art-room-core/src/workload.ts",
    "--target", "ES2022", "--module", "commonjs", "--rootDir", ".", "--outDir", output, "--skipLibCheck",
  ], { stdio: "pipe" });
  const require = createRequire(import.meta.url);
  const appCompiled = (...parts) => join(output, "app", "natural-media-lab", ...parts);
  const coreCompiled = (...parts) => join(output, "packages", "art-room-core", "src", ...parts);
  const { parseProject } = require(appCompiled("documentModel.js"));
  const { encodeComicPdf } = require(appCompiled("pdfEncoder.js"));
  const { encodeGif } = require(appCompiled("gifEncoder.js"));
  const { BRUSHES, seededRandom } = require(appCompiled("brushEngine.js"));
  const { PROCEDURAL_BRUSHES, renderProceduralStroke } = require(appCompiled("proceduralEngine.js"));
  const { clampEditorZoom, clientPointToDocumentPoint, clientPointToPaperRatio, clientPointToPaperRatioInSpace, getCanvasViewportGeometry, getPaperBaseSize, paperRatioToClientPoint } = require(appCompiled("viewportMath.js"));
  const { getBoneEndpointEdit } = require(coreCompiled("rig.js"));
  const { isSafePackagePath, parsePmAssetManifest, parsePmStudioManifest, planNmlBinaryMigration } = require(coreCompiled("projectFormats.js"));
  const { appendJournalEntry, compactJournalAtCheckpoint, createCommandJournal, journalEntriesToReplay, moveJournalHead, setJournalCheckpoint, shouldCreateCheckpoint } = require(coreCompiled("commandJournal.js"));
  const { createVersionedRecoveryService, latestRecoveryRecord, recoveryRecordsToDelete, sortRecoveryRecords } = require(coreCompiled("recovery.js"));
  const { applyEditorCommand } = require(coreCompiled("editorCommands.js"));
  const { captureDocumentSnapshot } = require(coreCompiled("documentSnapshot.js"));
  const { DEFAULT_LAYER_TRANSFORM, easeTimelineValue, framePlaybackDelay, resolveLayerTransform } = require(coreCompiled("animation.js"));
  const { animationCameraState, animationLayerSourceUrl, renderAnimationFrame, renderAnimationImageData } = require(coreCompiled("animationRenderer.js"));
  const { comicPanelSourceTransform, comicRectToPixels, comicTextPosition, getComicTransformPatch, wrapComicText } = require(coreCompiled("comicLayout.js"));
  const { pagesWithActiveComicState } = require(coreCompiled("comicRenderer.js"));
  const { cropCanvasLayer, fillCanvasLinearGradient, flattenCanvas, flipCanvasLayer, mergeCanvasLayers, resizeCanvasLayer } = require(coreCompiled("canvasOperations.js"));
  const { createLazyBinaryResolver, createMemoryBinaryStore, createNmlBinaryCheckpoint, decodeDataUrl, encodeDataUrl, parseArtRoomCheckpoint, parseTileSetDescriptor } = require(coreCompiled("binaryStorage.js"));
  const { clipRasterRect, dirtyRectForSegment, persistDirtyRasterTiles, tilesForRasterRect, unionRasterRects } = require(coreCompiled("rasterSurface.js"));
  const { createRasterRecoverySnapshot, parseRasterRecoverySnapshot, restoreRasterRecoverySnapshot } = require(coreCompiled("rasterRecovery.js"));
  const { applyRasterTileRevision, rasterRevisionHandlesToRetain } = require(coreCompiled("rasterRevision.js"));
  const { RasterSession } = require(coreCompiled("rasterSession.js"));
  const { historyEntryRequiresRasterReset, recordHistoryEntry, takeHistoryStep } = require(coreCompiled("historyController.js"));
  const { planComicPdfExport, planGifExport, planRasterExport, safeExportStem } = require(coreCompiled("exportPlanning.js"));
  const { profileRasterWorkload } = require(coreCompiled("workload.js"));
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
  const capturedSnapshot = captureDocumentSnapshot(migrated, {
    layerDataUrl: (layer) => `data:image/png;base64,${layer.id}`,
    simulationDataUrl: (layer, kind) => `data:image/png;base64,${layer.id}-${kind}`,
    now: () => "2026-09-02T02:00:00.000Z",
  });
  assert.equal(capturedSnapshot.layers[0].dataUrl, "data:image/png;base64,layer");
  assert.equal(capturedSnapshot.layers[0].simulation.wetMapUrl, "data:image/png;base64,layer-wet");
  assert.equal(capturedSnapshot.animation.frames[0].layerData.layer, capturedSnapshot.layers[0].dataUrl);
  assert.equal(capturedSnapshot.comic.pages[0].layerData.layer, capturedSnapshot.layers[0].dataUrl);
  assert.equal(capturedSnapshot.updatedAt, "2026-09-02T02:00:00.000Z");
  assert.equal(migrated.layers[0].dataUrl, "");
  const transformFrames = [
    { ...migrated.animation.frames[0], id: "animation-1", transforms: { layer: { ...DEFAULT_LAYER_TRANSFORM, x: 0, opacity: 100, easing: "ease-in-out" } } },
    { ...migrated.animation.frames[0], id: "animation-2", transforms: {} },
    { ...migrated.animation.frames[0], id: "animation-3", transforms: { layer: { ...DEFAULT_LAYER_TRANSFORM, x: 100, opacity: 50 } } },
  ];
  assert.deepEqual(resolveLayerTransform(transformFrames, 1, "layer"), {
    ...DEFAULT_LAYER_TRANSFORM, x: 50, opacity: 75, easing: "ease-in-out",
  });
  assert.notEqual(resolveLayerTransform(transformFrames, 0, "layer"), transformFrames[0].transforms.layer);
  transformFrames[0].transforms.layer.easing = "hold";
  assert.equal(resolveLayerTransform(transformFrames, 1, "layer").x, 0);
  assert.equal(easeTimelineValue(.25, "ease-in"), .0625);
  assert.equal(framePlaybackDelay(8, 2), 250);
  assert.equal(framePlaybackDelay(0, 0), 1000);
  const cameraDocument = JSON.parse(JSON.stringify(migrated));
  cameraDocument.animation.frames[0].camera = { x: 4, y: -3, zoom: 110, rotation: 5, shake: 6 };
  cameraDocument.animation.frames[0].layerData.layer = "data:image/png;base64,frame";
  assert.deepEqual(animationCameraState(cameraDocument, cameraDocument.animation.frames[0].id), {
    frame: cameraDocument.animation.frames[0], frameIndex: 0, camera: cameraDocument.animation.frames[0].camera, shakeX: 0, shakeY: 6,
  });
  assert.equal(animationLayerSourceUrl(cameraDocument, cameraDocument.animation.frames[0], "layer"), "data:image/png;base64,frame");
  cameraDocument.rig.sprites.layer = [{ name: "pose", dataUrl: "data:image/png;base64,sprite" }];
  cameraDocument.animation.frames[0].spriteExposure.layer = 0;
  assert.equal(animationLayerSourceUrl(cameraDocument, cameraDocument.animation.frames[0], "layer"), "data:image/png;base64,sprite");
  assert.throws(() => animationCameraState(cameraDocument, "missing"), /does not exist/);
  const comicPanel = { id: "panel", x: 10, y: 20, width: 40, height: 30, cropX: 12, cropY: -8, zoom: 150 };
  const comicRect = comicRectToPixels(comicPanel, 1000, 500, 20, 20);
  assert.deepEqual(comicRect, { x: 120, y: 120, width: 400, height: 150 });
  assert.deepEqual(comicPanelSourceTransform(comicPanel, comicRect), { centerX: 368, centerY: 183, scale: 1.5 });
  assert.deepEqual(wrapComicText("one two three four", 8, (value) => value.length), ["one two", "three", "four"]);
  assert.deepEqual(wrapComicText("one two three four five", 3, (value) => value.length, 2), ["one", "two"]);
  const comicText = { ...comicPanel, type: "caption", text: "Title", tailX: 50, tailY: 120, fontFamily: "sans", fontSize: 28, align: "right" };
  assert.deepEqual(comicTextPosition(comicText, comicRect, 3, 20), { x: 480, firstLineY: 175 });
  const comicDocument = { ...migrated, comic: { ...migrated.comic, panels: [comicPanel], text: [comicText] } };
  const renderedPages = pagesWithActiveComicState(comicDocument);
  assert.deepEqual(renderedPages[0].panels, [comicPanel]);
  assert.deepEqual(renderedPages[0].text, [comicText]);
  assert.notEqual(renderedPages[0].panels[0], comicPanel);
  const createdCanvases = [];
  const makeFakeCanvas = () => {
    const calls = [];
    const gradientStops = [];
    const context = {
      calls, gradientStops, globalAlpha: 1, globalCompositeOperation: "source-over", fillStyle: "",
      drawImage: (...values) => calls.push(["drawImage", ...values]),
      save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
      translate: (...values) => calls.push(["translate", ...values]),
      rotate: (...values) => calls.push(["rotate", ...values]),
      scale: (...values) => calls.push(["scale", ...values]),
      fillRect: (...values) => calls.push(["fillRect", ...values]),
      getImageData: (...values) => ({ values, data: new Uint8ClampedArray(4) }),
      createLinearGradient: (...values) => ({ addColorStop: (...stop) => gradientStops.push(stop), values }),
    };
    const canvas = { width: 0, height: 0, getContext: () => context, context };
    createdCanvases.push(canvas);
    return canvas;
  };
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => makeFakeCanvas() };
  try {
    const sourceCanvas = makeFakeCanvas(); sourceCanvas.width = 80; sourceCanvas.height = 60;
    assert.deepEqual([resizeCanvasLayer(sourceCanvas, 160, 90).width, resizeCanvasLayer(undefined, 40, 30).height], [160, 30]);
    const croppedCanvas = cropCanvasLayer(sourceCanvas, { x: 4, y: 5, width: 20.4, height: 10.6 });
    assert.deepEqual([croppedCanvas.width, croppedCanvas.height], [20, 11]);
    const flippedCanvas = flipCanvasLayer(sourceCanvas, 80, 60, true);
    assert.deepEqual(flippedCanvas.context.calls.slice(0, 2), [["translate", 0, 60], ["scale", 1, -1]]);
    const mergedCanvas = mergeCanvasLayers(80, 60, [{ canvas: sourceCanvas, opacity: .5, blendMode: "multiply" }]);
    assert.equal(mergedCanvas.context.calls.filter(([kind]) => kind === "drawImage").length, 1);
    fillCanvasLinearGradient(sourceCanvas, "#000", "#fff");
    assert.deepEqual(sourceCanvas.context.gradientStops, [[0, "#000"], [1, "#fff"]]);
    const flattenedCanvas = flattenCanvas(sourceCanvas, "#f1ede3");
    assert.deepEqual(flattenedCanvas.context.calls.map(([kind]) => kind), ["fillRect", "drawImage"]);
    const animationCanvas = await renderAnimationFrame(cameraDocument, cameraDocument.animation.frames[0].id, { resolveLayerSource: async () => sourceCanvas });
    assert.deepEqual([animationCanvas.width, animationCanvas.height], [cameraDocument.width, cameraDocument.height]);
    assert.ok(animationCanvas.context.calls.some(([kind]) => kind === "rotate"));
    const animationImages = await renderAnimationImageData(cameraDocument, 32, 18, { resolveLayerSource: async () => sourceCanvas });
    assert.equal(animationImages.length, 1);
    assert.deepEqual(animationImages[0].values, [0, 0, 32, 18]);
    await assert.rejects(() => renderAnimationImageData(cameraDocument, 0, 18), /positive integers/);
  } finally {
    globalThis.document = originalDocument;
  }
  const marker = BRUSHES.find((brush) => brush.id === "marker");
  assert.ok(marker.opacity >= 0.9);
  assert.ok(marker.flow >= 0.9);
  assert.ok(marker.grain <= 0.02);
  assert.equal(safeExportStem('Study: Night/Day?'), "Study- Night-Day-");
  assert.equal(safeExportStem("CON"), "Untitled");
  assert.deepEqual(planRasterExport("Cover", "jpeg", "transparent"), {
    mediaType: "image/jpeg", quality: .92, flattenColor: "#f1ede3", filename: "Cover.jpg",
  });
  assert.equal(planRasterExport("Cover", "png", "transparent").flattenColor, undefined);
  assert.deepEqual(planGifExport(1920, 1080), { width: 480, height: 270, scale: .25 });
  assert.deepEqual(planGifExport(320, 200), { width: 320, height: 200, scale: 1 });
  const a4PdfPlan = planComicPdfExport("a4", 3, 1240);
  assert.ok(Math.abs(a4PdfPlan.pageWidth - 612.287874) < .001);
  assert.equal(a4PdfPlan.bleedPixels, 18);
  const largeWorkload = profileRasterWorkload({ width: 4096, height: 4096, layerCount: 16, frameCount: 24, pageCount: 12 });
  assert.deepEqual({ columns: largeWorkload.tileColumns, rows: largeWorkload.tileRows, perLayer: largeWorkload.tilesPerLayer }, { columns: 16, rows: 16, perLayer: 256 });
  assert.equal(largeWorkload.maximumTileCount, 4096);
  assert.equal(largeWorkload.rawLayerBytes, 1_073_741_824);
  assert.equal(largeWorkload.tier, "heavy");
  assert.throws(() => profileRasterWorkload({ width: 0, height: 100, layerCount: 1 }), /positive integer/);
  const seededA = seededRandom(9182), seededB = seededRandom(9182), seededC = seededRandom(9183);
  const seededSequenceA = Array.from({ length: 12 }, () => seededA());
  assert.deepEqual(seededSequenceA, Array.from({ length: 12 }, () => seededB()));
  assert.notDeepEqual(seededSequenceA, Array.from({ length: 12 }, () => seededC()));
  const recordProcedural = (seed) => {
    const operations = [];
    const context = new Proxy({
      canvas: { width: 640, height: 360 },
      save: () => operations.push(["save"]), restore: () => operations.push(["restore"]),
      beginPath: () => operations.push(["beginPath"]), closePath: () => operations.push(["closePath"]),
      moveTo: (...values) => operations.push(["moveTo", ...values]), lineTo: (...values) => operations.push(["lineTo", ...values]),
      fill: () => operations.push(["fill"]), stroke: () => operations.push(["stroke"]),
    }, {
      set(target, property, value) { operations.push(["set", String(property), value]); target[property] = value; return true; },
    });
    renderProceduralStroke(context, { x: 40, y: 90 }, { x: 240, y: 130 }, PROCEDURAL_BRUSHES.find((preset) => preset.id === "stars"), {
      density: .65, scale: 14, wind: .2, colorVariation: .35, color: "#65734d", seed, mirror: true, canvasWidth: 640,
    });
    return operations;
  };
  assert.deepEqual(recordProcedural(77), recordProcedural(77));
  assert.notDeepEqual(recordProcedural(77), recordProcedural(78));
  const gifFrame = { data: Uint8ClampedArray.from([255, 0, 0, 255, 0, 255, 0, 255]) };
  const firstGif = new Uint8Array(await encodeGif([gifFrame], 2, 1, 8, true, [2]).arrayBuffer());
  const secondGif = new Uint8Array(await encodeGif([gifFrame], 2, 1, 8, true, [2]).arrayBuffer());
  assert.deepEqual(firstGif, secondGif);
  assert.equal(new TextDecoder().decode(firstGif.slice(0, 6)), "GIF89a");
  assert.equal(firstGif[firstGif.length - 1], 0x3b);
  assert.equal(clampEditorZoom(5), 35);
  assert.equal(clampEditorZoom(200), 160);
  const baseSize = getPaperBaseSize(1920, 1080, 1280, 720);
  assert.equal(baseSize.width, 900);
  assert.equal(baseSize.height, 506.25);
  const zoomed = getCanvasViewportGeometry(baseSize, 160, 100, 0);
  assert.equal(zoomed.paperWidth, 1440);
  assert.equal(zoomed.paperHeight, 810);
  assert.equal(zoomed.viewportWidth, 1520);
  const rotated = getCanvasViewportGeometry(baseSize, 160, 100, 90);
  assert.ok(Math.abs(rotated.viewportWidth - 890) < 0.0001);
  assert.ok(Math.abs(rotated.viewportHeight - 1520) < 0.0001);
  const paperRatio = clientPointToPaperRatio(480, 360, 400, 300, 640, 360, 30);
  const restoredClientPoint = paperRatioToClientPoint(paperRatio.x, paperRatio.y, 400, 300, 640, 360, 30);
  assert.ok(Math.abs(restoredClientPoint.x - 480) < 0.0001);
  assert.ok(Math.abs(restoredClientPoint.y - 360) < 0.0001);
  const rotatedPaperSpace = { centerX: 400, centerY: 300, paperWidth: 640, paperHeight: 360, rotationDegrees: 90 };
  const rotatedClientPoint = paperRatioToClientPoint(.75, .6, rotatedPaperSpace.centerX, rotatedPaperSpace.centerY, rotatedPaperSpace.paperWidth, rotatedPaperSpace.paperHeight, rotatedPaperSpace.rotationDegrees);
  const rotatedPaperRatio = clientPointToPaperRatioInSpace(rotatedClientPoint.x, rotatedClientPoint.y, rotatedPaperSpace);
  assert.ok(Math.abs(rotatedPaperRatio.x - .75) < 0.0001);
  assert.ok(Math.abs(rotatedPaperRatio.y - .6) < 0.0001);
  const documentPoint = clientPointToDocumentPoint(rotatedClientPoint.x, rotatedClientPoint.y, rotatedPaperSpace, { width: 1600, height: 900 });
  assert.ok(Math.abs(documentPoint.x - 1200) < 0.0001);
  assert.ok(Math.abs(documentPoint.y - 540) < 0.0001);
  const movedClientPoint = paperRatioToClientPoint(.85, .7, rotatedPaperSpace.centerX, rotatedPaperSpace.centerY, rotatedPaperSpace.paperWidth, rotatedPaperSpace.paperHeight, rotatedPaperSpace.rotationDegrees);
  const movedPaperRatio = clientPointToPaperRatioInSpace(movedClientPoint.x, movedClientPoint.y, rotatedPaperSpace);
  const comicPatch = getComicTransformPatch({ x: 15, y: 20, width: 30, height: 25 }, "move", (movedPaperRatio.x - rotatedPaperRatio.x) * 100, (movedPaperRatio.y - rotatedPaperRatio.y) * 100);
  assert.ok(Math.abs(comicPatch.x - 25) < 0.0001);
  assert.ok(Math.abs(comicPatch.y - 30) < 0.0001);
  assert.deepEqual(getComicTransformPatch({ x: 80, y: 85, width: 20, height: 15 }, "move", 15, 12), { x: 80, y: 85 });
  assert.deepEqual(getComicTransformPatch({ x: 90, y: 90, width: 8, height: 8 }, "resize", 20, -20), { width: 10, height: 5 });
  assert.deepEqual(getComicTransformPatch({ x: 0, y: 0, width: 20, height: 20, cropX: 4, cropY: -3 }, "crop", 6, 8), { cropX: 10, cropY: 5 });
  const endpointEdit = getBoneEndpointEdit({ x: 100, y: 100 }, { x: 100, y: 200 }, 30, 10);
  assert.ok(Math.abs(endpointEdit.length - 100) < 0.0001);
  assert.ok(Math.abs(endpointEdit.restRotation - 50) < 0.0001);
  const formatFixtures = join(process.cwd(), "fixtures", "art-room-formats");
  const studioManifest = JSON.parse(readFileSync(join(formatFixtures, "pmstudio-v1.json"), "utf8"));
  const assetManifest = JSON.parse(readFileSync(join(formatFixtures, "pmasset-v1.json"), "utf8"));
  assert.equal(parsePmStudioManifest(studioManifest).projectId, "project-demo");
  assert.equal(parsePmAssetManifest(assetManifest).assetId, "spectral-arcade-cabinet");
  assert.equal(isSafePackagePath("binary/layers/paint.png"), true);
  assert.equal(isSafePackagePath("../outside.png"), false);
  assert.equal(isSafePackagePath("binary\\outside.png"), false);
  const unsafeManifest = JSON.parse(JSON.stringify(studioManifest));
  unsafeManifest.binaries[0].location.path = "../outside.png";
  assert.throws(() => parsePmStudioManifest(unsafeManifest), /safe relative package path/);
  const nmlFixture = JSON.parse(readFileSync(join(formatFixtures, "nml-v1-minimal.json"), "utf8"));
  const expectedMigration = JSON.parse(readFileSync(join(formatFixtures, "nml-v1-migration-expected.json"), "utf8"));
  const migrationPlan = planNmlBinaryMigration(nmlFixture).map(({ dataUrl, ...entry }) => entry);
  assert.deepEqual(migrationPlan, expectedMigration);
  const checkpointOptions = { sequence: 0, createdAt: "2026-08-31T03:00:00.000Z" };
  const migratedCheckpoint = await createNmlBinaryCheckpoint(nmlFixture, checkpointOptions);
  const repeatedCheckpoint = await createNmlBinaryCheckpoint(nmlFixture, checkpointOptions);
  assert.deepEqual(repeatedCheckpoint.checkpoint, migratedCheckpoint.checkpoint);
  assert.equal(parseArtRoomCheckpoint(migratedCheckpoint.checkpoint).sequence, 0);
  assert.equal(migratedCheckpoint.payloads.length, 5);
  assert.equal(migratedCheckpoint.checkpoint.document.layers[0].dataUrl.kind, "binary-handle");
  assert.equal(migratedCheckpoint.checkpoint.document.animation.frames[0].layerData["paint layer/1"].handleId, "nml-frame-frame-1-paint-layer-1");
  assert.equal(migratedCheckpoint.checkpoint.document.rig.sprites["paint layer/1"][0].dataUrl.handleId, "nml-sprite-paint-layer-1-1");
  assert.match(migratedCheckpoint.payloads[0].handle.sha256, /^[a-f\d]{64}$/);
  const binaryStore = createMemoryBinaryStore();
  for (const payload of migratedCheckpoint.payloads) await binaryStore.put(payload.handle, payload.bytes);
  let binaryReads = 0;
  const countingStore = { ...binaryStore, async get(handleId) { binaryReads += 1; return binaryStore.get(handleId); } };
  const lazyResolver = createLazyBinaryResolver(migratedCheckpoint.checkpoint.binaries, countingStore);
  const pixelHandleId = migratedCheckpoint.checkpoint.document.layers[0].dataUrl.handleId;
  const [firstResolution, secondResolution] = await Promise.all([lazyResolver.resolve(pixelHandleId), lazyResolver.resolve(pixelHandleId)]);
  assert.equal(firstResolution, "data:image/png;base64,AA==");
  assert.equal(secondResolution, firstResolution);
  assert.equal(binaryReads, 1);
  const missingHandleCheckpoint = JSON.parse(JSON.stringify(migratedCheckpoint.checkpoint));
  missingHandleCheckpoint.binaries = missingHandleCheckpoint.binaries.filter((handle) => handle.id !== pixelHandleId);
  assert.throws(() => parseArtRoomCheckpoint(missingHandleCheckpoint), /unknown binary handle/);
  const corruptedStore = createMemoryBinaryStore();
  const pixelPayload = migratedCheckpoint.payloads.find((payload) => payload.handle.id === pixelHandleId);
  await corruptedStore.put(pixelPayload.handle, Uint8Array.of(255));
  await assert.rejects(() => createLazyBinaryResolver(migratedCheckpoint.checkpoint.binaries, corruptedStore).resolve(pixelHandleId), /integrity verification/);
  const textPayload = decodeDataUrl("data:text/plain,Art%20Room");
  assert.equal(new TextDecoder().decode(textPayload.bytes), "Art Room");
  assert.equal(encodeDataUrl(textPayload.mediaType, textPayload.bytes), "data:text/plain;base64,QXJ0IFJvb20=");
  assert.deepEqual(parseTileSetDescriptor({ format: "art-room-tile-set", version: 1, width: 1024, height: 768, tileSize: 256, tiles: [{ column: 3, row: 2, handleId: pixelHandleId }] }).tiles[0], { column: 3, row: 2, handleId: pixelHandleId });
  assert.throws(() => parseTileSetDescriptor({ format: "art-room-tile-set", version: 1, width: 1024, height: 768, tileSize: 256, tiles: [{ column: 4, row: 0, handleId: pixelHandleId }] }), /outside the canvas/);
  assert.throws(() => parseTileSetDescriptor({ format: "art-room-tile-set", version: 1, width: 1024, height: 768, tileSize: 256, tiles: [{ column: 0, row: 0, handleId: "one" }, { column: 0, row: 0, handleId: "two" }] }), /duplicate coordinate/);
  assert.deepEqual(clipRasterRect({ x: -10, y: 20, width: 40, height: 30 }, 100, 100), { x: 0, y: 20, width: 30, height: 30 });
  assert.deepEqual(unionRasterRects({ x: 10, y: 10, width: 20, height: 20 }, { x: 25, y: 5, width: 10, height: 10 }), { x: 10, y: 5, width: 25, height: 25 });
  assert.deepEqual(dirtyRectForSegment({ x: 250, y: 10 }, { x: 270, y: 20 }, 10, 512, 512, false), { x: 240, y: 0, width: 40, height: 30 });
  assert.deepEqual(tilesForRasterRect({ x: 250, y: 10, width: 20, height: 20 }, 512, 512, 256), [{ column: 0, row: 0 }, { column: 1, row: 0 }]);
  const tileStore = createMemoryBinaryStore();
  let tileEncodes = 0, tileId = 0;
  const rasterSource = {
    width: 512,
    height: 512,
    async encodeRegion(region) {
      tileEncodes += 1;
      return { mediaType: "image/png", bytes: Uint8Array.of(region.x / 256, region.y / 256, region.width === 256 ? 255 : region.width) };
    },
  };
  const firstTileWrite = await persistDirtyRasterTiles({ layerId: "paint", source: rasterSource, dirty: { x: 250, y: 10, width: 20, height: 20 }, store: tileStore, createId: () => `revision-${++tileId}` });
  assert.equal(firstTileWrite.writtenTiles, 2);
  assert.equal(tileEncodes, 2);
  const originalLeftHandle = firstTileWrite.descriptor.tiles.find((tile) => tile.column === 0).handleId;
  const originalRightHandle = firstTileWrite.descriptor.tiles.find((tile) => tile.column === 1).handleId;
  const secondTileWrite = await persistDirtyRasterTiles({ layerId: "paint", source: rasterSource, dirty: { x: 20, y: 20, width: 10, height: 10 }, store: tileStore, previous: firstTileWrite.descriptor, createId: () => `revision-${++tileId}` });
  assert.equal(secondTileWrite.writtenTiles, 1);
  assert.equal(tileEncodes, 3);
  assert.equal(secondTileWrite.descriptor.tiles.length, 2);
  assert.deepEqual(secondTileWrite.replacedHandleIds, [originalLeftHandle]);
  assert.equal(await tileStore.has(originalLeftHandle), false);
  assert.equal(await tileStore.has(originalRightHandle), true);
  let benchmarkTileId = 0;
  const benchmarkStartedAt = performance.now();
  const largeTileWrite = await persistDirtyRasterTiles({
    layerId: "large-paint",
    source: {
      width: 4096,
      height: 4096,
      async encodeRegion(region) { return { mediaType: "image/png", bytes: Uint8Array.of(region.x / 256, region.y / 256, 255) }; },
    },
    dirty: { x: 0, y: 0, width: 4096, height: 4096 },
    store: createMemoryBinaryStore(),
    createId: () => `large-tile-${++benchmarkTileId}`,
  });
  const largeTileBenchmarkMs = Math.round(performance.now() - benchmarkStartedAt);
  assert.equal(largeTileWrite.writtenTiles, 256);
  assert.equal(largeTileWrite.descriptor.tiles.length, 256);
  const sessionDeletes = [];
  const sessionStoreFactory = () => {
    const store = createMemoryBinaryStore();
    return { ...store, async delete(ids) { sessionDeletes.push(...ids); await store.delete(ids); } };
  };
  let sessionId = 0;
  const rasterSession = new RasterSession({ createStore: sessionStoreFactory, createId: () => `session-${++sessionId}`, now: () => "2026-09-02T01:00:00.000Z" });
  const sessionFirstRevision = await rasterSession.persist({ layerId: "paint", source: rasterSource, dirty: { x: 250, y: 10, width: 20, height: 20 } });
  assert.equal(sessionFirstRevision.before, null);
  assert.equal(sessionFirstRevision.after.tiles.length, 2);
  const sessionSecondRevision = await rasterSession.persist({ layerId: "paint", source: rasterSource, dirty: { x: 20, y: 20, width: 10, height: 10 } });
  assert.deepEqual(sessionSecondRevision.before, sessionFirstRevision.after);
  assert.equal(rasterSession.layerDescriptor("paint").tiles.length, 2);
  rasterSession.applyRevision(sessionSecondRevision, "undo");
  assert.deepEqual(rasterSession.layerDescriptor("paint"), sessionFirstRevision.after);
  rasterSession.applyRevision(sessionSecondRevision, "redo");
  assert.deepEqual(rasterSession.layerDescriptor("paint"), sessionSecondRevision.after);
  const sessionRecovery = await rasterSession.createRecovery();
  assert.equal(sessionRecovery.payloads.length, 2);
  await rasterSession.prune();
  assert.ok(sessionSecondRevision.replacedHandleIds.every((handleId) => sessionDeletes.includes(handleId)));
  const reopenedSession = new RasterSession({ createId: () => "reopened" });
  assert.equal(await reopenedSession.restore(structuredClone(sessionRecovery)), true);
  assert.deepEqual(reopenedSession.layerDescriptor("paint"), sessionSecondRevision.after);
  assert.match(await reopenedSession.createResolver().resolve(sessionSecondRevision.after.tiles[0].handleId), /^data:image\/png;base64,/);
  const cancelledSession = new RasterSession({ createId: () => "cancelled" });
  const cancelledWrite = cancelledSession.persist({ layerId: "paint", source: rasterSource, dirty: { x: 0, y: 0, width: 10, height: 10 } });
  cancelledSession.reset();
  assert.equal(await cancelledWrite, undefined);
  assert.equal(cancelledSession.hasRaster(), false);
  const currentTileHandles = [
    firstTileWrite.handles.find((handle) => handle.id === originalRightHandle),
    ...secondTileWrite.handles,
  ];
  const rasterRecovery = await createRasterRecoverySnapshot({ paint: secondTileWrite.descriptor }, currentTileHandles, tileStore);
  assert.equal(parseRasterRecoverySnapshot(rasterRecovery).payloads.length, 2);
  const reopenedTileStore = createMemoryBinaryStore();
  const reopenedRaster = await restoreRasterRecoverySnapshot(structuredClone(rasterRecovery), reopenedTileStore);
  assert.deepEqual(reopenedRaster.layers.paint, secondTileWrite.descriptor);
  assert.equal(await reopenedTileStore.has(originalRightHandle), true);
  assert.equal(await reopenedTileStore.has(secondTileWrite.handles[0].id), true);
  const corruptedRasterRecovery = structuredClone(rasterRecovery);
  corruptedRasterRecovery.payloads[0].bytes[0] ^= 255;
  await assert.rejects(() => restoreRasterRecoverySnapshot(corruptedRasterRecovery, createMemoryBinaryStore()), /integrity verification/);
  const tileRevision = {
    id: "tile-revision-1",
    createdAt: "2026-08-31T04:00:00.000Z",
    type: "raster.tiles.replace",
    layerId: "paint",
    before: firstTileWrite.descriptor,
    after: secondTileWrite.descriptor,
    createdHandleIds: secondTileWrite.handles.map((handle) => handle.id),
    replacedHandleIds: secondTileWrite.replacedHandleIds,
  };
  const redoneRaster = applyRasterTileRevision({ paint: firstTileWrite.descriptor }, tileRevision, "redo");
  assert.deepEqual(redoneRaster.paint, secondTileWrite.descriptor);
  const undoneRaster = applyRasterTileRevision(redoneRaster, tileRevision, "undo");
  assert.deepEqual(undoneRaster.paint, firstTileWrite.descriptor);
  assert.deepEqual(rasterRevisionHandlesToRetain(tileRevision, "redo"), tileRevision.createdHandleIds);
  assert.deepEqual(rasterRevisionHandlesToRetain(tileRevision, "undo"), tileRevision.replacedHandleIds);
  const firstStrokeRevision = { ...tileRevision, id: "first-stroke", before: null, after: firstTileWrite.descriptor };
  const mixedHistory = [], mixedRedo = [];
  recordHistoryEntry(mixedHistory, mixedRedo, { id: "stroke", document: { name: "blank" }, rasterCompatible: true, rasterRevision: firstStrokeRevision, commandSequence: 1 });
  recordHistoryEntry(mixedHistory, mixedRedo, { id: "metadata", document: { name: "painted" }, rasterCompatible: true, commandSequence: 2 });
  let mixedDocument = { name: "painted-hidden" };
  let mixedRaster = { paint: firstTileWrite.descriptor };
  const undoMetadata = takeHistoryStep(mixedHistory, mixedRedo, mixedDocument);
  mixedDocument = undoMetadata.document;
  assert.equal(mixedDocument.name, "painted");
  assert.deepEqual(mixedRaster.paint, firstTileWrite.descriptor);
  const undoStroke = takeHistoryStep(mixedHistory, mixedRedo, mixedDocument);
  mixedDocument = undoStroke.document;
  mixedRaster = applyRasterTileRevision(mixedRaster, undoStroke.rasterRevision, "undo");
  assert.equal(mixedDocument.name, "blank");
  assert.equal(mixedRaster.paint, undefined);
  const redoStroke = takeHistoryStep(mixedRedo, mixedHistory, mixedDocument);
  mixedDocument = redoStroke.document;
  mixedRaster = applyRasterTileRevision(mixedRaster, redoStroke.rasterRevision, "redo");
  assert.equal(mixedDocument.name, "painted");
  assert.deepEqual(mixedRaster.paint, firstTileWrite.descriptor);
  const redoMetadata = takeHistoryStep(mixedRedo, mixedHistory, mixedDocument);
  assert.equal(redoMetadata.document.name, "painted-hidden");
  const boundedHistory = [], boundedRedo = [{ id: "discard", document: {}, rasterCompatible: false }];
  recordHistoryEntry(boundedHistory, boundedRedo, { id: "one", document: {}, rasterCompatible: false }, 2);
  recordHistoryEntry(boundedHistory, boundedRedo, { id: "two", document: {}, rasterCompatible: false }, 2);
  const boundedResult = recordHistoryEntry(boundedHistory, boundedRedo, { id: "three", document: {}, rasterCompatible: false }, 2);
  assert.deepEqual(boundedHistory.map((entry) => entry.id), ["two", "three"]);
  assert.deepEqual(boundedResult.dropped.map((entry) => entry.id), ["one"]);
  assert.equal(historyEntryRequiresRasterReset({ id: "resize", document: {}, rasterCompatible: false }), true);
  assert.equal(historyEntryRequiresRasterReset({ id: "opacity", document: {}, rasterCompatible: true }), false);
  assert.equal(historyEntryRequiresRasterReset({ id: "pending-stroke", document: {}, rasterCompatible: true, rasterRevisionPending: true }), true);
  const recoveryRecords = [
    { id: "older", savedAt: "2026-08-31T00:00:00.000Z", document: oldProject },
    { id: "newest", savedAt: "2026-08-31T00:02:00.000Z", document: oldProject },
    { id: "middle", savedAt: "2026-08-31T00:01:00.000Z", document: oldProject },
  ];
  assert.deepEqual(sortRecoveryRecords(recoveryRecords).map((record) => record.id), ["newest", "middle", "older"]);
  assert.equal(latestRecoveryRecord(recoveryRecords).id, "newest");
  assert.deepEqual(recoveryRecordsToDelete(recoveryRecords, 2), ["older"]);
  const memoryRecords = [];
  const memoryStore = {
    async list() { return [...memoryRecords]; },
    async put(record) { memoryRecords.push(record); },
    async delete(ids) { for (const id of ids) { const index = memoryRecords.findIndex((record) => record.id === id); if (index >= 0) memoryRecords.splice(index, 1); } },
  };
  const recoveryTimes = ["2026-08-31T01:00:00.000Z", "2026-08-31T01:01:00.000Z", "2026-08-31T01:02:00.000Z"];
  const recoveryService = createVersionedRecoveryService(memoryStore, { maximumVersions: 2, now: () => recoveryTimes.shift(), createId: () => `id-${recoveryTimes.length}` });
  await recoveryService.save({ name: "one" });
  await recoveryService.save({ name: "two" });
  await recoveryService.save({ name: "three" });
  assert.deepEqual((await recoveryService.list()).map((record) => record.document.name), ["three", "two"]);
  const reopenedRecoveryService = createVersionedRecoveryService(memoryStore);
  assert.equal((await reopenedRecoveryService.latest()).document.name, "three");
  const restartRecords = [];
  const restartStore = {
    async list() { return structuredClone(restartRecords); },
    async put(record) { restartRecords.push(structuredClone(record)); },
    async delete(ids) { ids.forEach((id) => { const index = restartRecords.findIndex((record) => record.id === id); if (index >= 0) restartRecords.splice(index, 1); }); },
  };
  const restartTimes = ["2026-09-01T03:00:00.000Z", "2026-09-01T03:01:00.000Z"];
  const restartService = createVersionedRecoveryService(restartStore, { now: () => restartTimes.shift(), createId: () => "restart" });
  await restartService.save({ document: { name: "before resize", width: 512, height: 512 }, raster: structuredClone(rasterRecovery) });
  await restartService.save({ document: { name: "after resize", width: 256, height: 256 } });
  const reopenedAfterCrash = createVersionedRecoveryService(restartStore);
  assert.deepEqual((await reopenedAfterCrash.latest()).document, { document: { name: "after resize", width: 256, height: 256 } });
  const priorRecovery = (await reopenedAfterCrash.list())[1].document;
  assert.equal(priorRecovery.document.name, "before resize");
  assert.deepEqual((await restoreRasterRecoverySnapshot(priorRecovery.raster, createMemoryBinaryStore())).layers.paint, secondTileWrite.descriptor);
  let journal = createCommandJournal();
  journal = appendJournalEntry(journal, { id: "one", kind: "layer.add", createdAt: "2026-08-31T00:00:00.000Z", payload: { layerId: "layer-1" }, undoable: true });
  journal = appendJournalEntry(journal, { id: "two", kind: "layer.opacity", createdAt: "2026-08-31T00:01:00.000Z", payload: { opacity: .5 }, undoable: true });
  assert.equal(journal.head, 2);
  journal = moveJournalHead(journal, 1);
  assert.deepEqual(journalEntriesToReplay(journal).map((entry) => entry.id), ["one"]);
  journal = appendJournalEntry(journal, { id: "replacement", kind: "layer.rename", createdAt: "2026-08-31T00:02:00.000Z", payload: { name: "Ink" }, undoable: true });
  assert.deepEqual(journal.entries.map((entry) => entry.id), ["one", "replacement"]);
  journal = setJournalCheckpoint(journal, { sequence: 1, createdAt: "2026-08-31T00:03:00.000Z", path: "journal/checkpoints/1.json" });
  assert.deepEqual(journalEntriesToReplay(journal).map((entry) => entry.id), ["replacement"]);
  assert.equal(shouldCreateCheckpoint(journal, { maximumEntriesAfterCheckpoint: 1, maximumEstimatedBytesAfterCheckpoint: 1_000_000 }), true);
  let journalToCompact = createCommandJournal();
  for (let index = 1; index <= 4; index += 1) journalToCompact = appendJournalEntry(journalToCompact, { id: `compact-${index}`, kind: "test", createdAt: `2026-09-01T00:0${index}:00.000Z`, payload: { index }, undoable: true });
  const compacted = compactJournalAtCheckpoint(journalToCompact, { sequence: 3, createdAt: "2026-09-01T00:05:00.000Z", path: "journal/checkpoints/3.json" });
  assert.deepEqual(compacted.removedEntries.map((entry) => entry.sequence), [1, 2, 3]);
  assert.deepEqual(compacted.journal.entries.map((entry) => entry.sequence), [4]);
  assert.deepEqual(journalEntriesToReplay(compacted.journal).map((entry) => entry.sequence), [4]);
  const appendedAfterCompaction = appendJournalEntry(compacted.journal, { id: "compact-5", kind: "test", createdAt: "2026-09-01T00:06:00.000Z", payload: { index: 5 }, undoable: true });
  assert.equal(appendedAfterCompaction.head, 5);
  const secondLayer = { ...migrated.layers[0], id: "layer-2", name: "Ink" };
  const thirdLayer = { ...migrated.layers[0], id: "layer-3", name: "Color" };
  const commandBase = { ...migrated, layers: [migrated.layers[0], secondLayer], activeLayerId: "layer" };
  const layerCommands = [
    { id: "update-opacity", createdAt: "2026-08-31T02:00:00.000Z", type: "layer.update", layerId: "layer", patch: { opacity: .4 } },
    { id: "move-ink", createdAt: "2026-08-31T02:01:00.000Z", type: "layer.move", layerId: "layer-2", direction: -1 },
    { id: "add-color", createdAt: "2026-08-31T02:02:00.000Z", type: "layer.add", layer: thirdLayer, index: 1, makeActive: true },
    { id: "delete-color", createdAt: "2026-08-31T02:03:00.000Z", type: "layer.delete", layerId: "layer-3" },
  ];
  const editedDocument = layerCommands.reduce((current, command) => applyEditorCommand(current, command), commandBase);
  assert.deepEqual(editedDocument.layers.map((layer) => layer.id), ["layer-2", "layer"]);
  assert.equal(editedDocument.layers[1].opacity, .4);
  assert.equal(editedDocument.activeLayerId, "layer");
  assert.equal(editedDocument.updatedAt, "2026-08-31T02:03:00.000Z");
  let commandJournal = createCommandJournal();
  for (const command of layerCommands) commandJournal = appendJournalEntry(commandJournal, { id: command.id, kind: command.type, createdAt: command.createdAt, payload: command, undoable: true });
  const replayedDocument = journalEntriesToReplay(commandJournal).reduce((current, entry) => applyEditorCommand(current, entry.payload), commandBase);
  assert.deepEqual(replayedDocument, editedDocument);
  const onlyLayerDocument = { ...migrated, layers: [migrated.layers[0]], activeLayerId: "layer" };
  assert.equal(applyEditorCommand(onlyLayerDocument, { id: "invalid-delete", createdAt: "2026-08-31T02:04:00.000Z", type: "layer.delete", layerId: "layer" }), onlyLayerDocument);
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
  console.log(`Natural Media Lab: migration, recovery, export, and 4096px tile checks passed (${largeTileBenchmarkMs} ms tile benchmark).`);
} finally {
  rmSync(output, { recursive: true, force: true });
}
