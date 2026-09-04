"use client";

import { CSSProperties, ChangeEvent, PointerEvent, WheelEvent, useCallback, useEffect, useRef, useState } from "react";
import { AnimationFrame, BlendMode, ComicPanel, ComicText, NaturalMediaDocument, PaintLayer, RigBone, createDocument, createLayer, parseProject } from "./documentModel";
import { applyEditorCommand } from "../../packages/art-room-core/src/editorCommands";
import type { EditorCommand } from "../../packages/art-room-core/src/editorCommands";
import { appendJournalEntry, compactJournalAtCheckpoint, createCommandJournal, moveJournalHead, shouldCreateCheckpoint } from "../../packages/art-room-core/src/commandJournal";
import type { CommandJournal } from "../../packages/art-room-core/src/commandJournal";
import { dirtyRectForSegment, unionRasterRects } from "../../packages/art-room-core/src/rasterSurface";
import type { RasterRect } from "../../packages/art-room-core/src/rasterSurface";
import type { RasterRecoverySnapshotV1 } from "../../packages/art-room-core/src/rasterRecovery";
import type { RasterTileRevisionCommand } from "../../packages/art-room-core/src/rasterRevision";
import { RasterSession } from "../../packages/art-room-core/src/rasterSession";
import { historyEntryRequiresRasterReset, recordHistoryEntry, takeHistoryStep } from "../../packages/art-room-core/src/historyController";
import type { SnapshotHistoryEntry } from "../../packages/art-room-core/src/historyController";
import { planComicPdfExport, planGifExport, planRasterExport, safeExportStem } from "../../packages/art-room-core/src/exportPlanning";
import { captureDocumentSnapshot } from "../../packages/art-room-core/src/documentSnapshot";
import { DEFAULT_LAYER_TRANSFORM, framePlaybackDelay, resolveLayerTransform } from "../../packages/art-room-core/src/animation";
import { renderAnimationFrame, renderAnimationImageData } from "../../packages/art-room-core/src/animationRenderer";
import { pagesWithActiveComicState, renderComicPage } from "../../packages/art-room-core/src/comicRenderer";
import { cropCanvasLayer, fillCanvasLinearGradient, flattenCanvas, flipCanvasLayer, mergeCanvasLayers, resizeCanvasLayer } from "../../packages/art-room-core/src/canvasOperations";
import { ExportJobCancelledError, ExportJobController, isExportJobCancelled } from "../../packages/art-room-core/src/exportJob";
import { BRUSHES, renderBrushStroke } from "../../packages/art-room-core/src/brushEngine";
import { PROCEDURAL_BRUSHES, renderProceduralStroke } from "../../packages/art-room-core/src/proceduralEngine";
import { createLiveDocumentState, refreshLiveDocumentRaster, restoreLiveDocumentState, updateLiveDocumentState } from "../../packages/art-room-core/src/liveDocument";
import { encodeGif } from "./gifEncoder";
import { encodeComicPdf } from "./pdfEncoder";
import { getComicTransformPatch } from "../../packages/art-room-core/src/comicLayout";
import { boneWorld, getBoneEndpointEdit, poseRotation } from "../../packages/art-room-core/src/rig";
import { loadRecovery, saveRecovery } from "./persistence";
import { DEFAULT_EDITOR_ZOOM, PaperClientSpace, clampEditorZoom, clientPointToDocumentPoint, clientPointToPaperRatio, clientPointToPaperRatioInSpace, getCanvasViewportGeometry, getPaperBaseSize, paperRatioToClientPoint } from "./viewportMath";
import { compositeCanvasLayers, createCanvasRasterSurface } from "./canvasRasterSurface";
import styles from "./natural-media-lab.module.css";

const SWATCHES = ["#1d2220", "#6c2e2a", "#bd6b3c", "#d6a95f", "#65734d", "#41636a", "#42476f", "#7a4f6b"];
type ArtRoomCommand = EditorCommand | RasterTileRevisionCommand;
type EditorHistoryEntry = SnapshotHistoryEntry<NaturalMediaDocument, RasterTileRevisionCommand>;
const PRESETS = [
  ["Landscape", 1600, 1000], ["Square", 1200, 1200],
  ["HD", 1920, 1080], ["A4 portrait", 1240, 1754],
] as const;
const TOUR = [
  ["Paint naturally", "Choose a material on the left, then draw directly on the paper with mouse, pen, or touch."],
  ["Build in layers", "Use the inspector to add layers, tune material response, animate frames, and pose puppet rigs."],
  ["Create comics", "Turn on Comic creator for panels, lettering, independent page art, page masters, and multi-page books."],
  ["Publish locally", "Export artwork, GIF animation, print-ready pages, or a complete PDF without uploading your work."],
] as const;
const clone = (value: NaturalMediaDocument): NaturalMediaDocument => JSON.parse(JSON.stringify(value));
const layerRigRotation = (document: NaturalMediaDocument, frame: AnimationFrame, layerId: string) => {
  const binding = document.rig.layerBindings[layerId];
  return binding ? poseRotation(document, frame, binding.boneId) : 0;
};
const layerPivot = (document: NaturalMediaDocument, layerId: string) => {
  const binding = document.rig.layerBindings[layerId];
  return binding ? `${binding.pivotX / document.width * 100}% ${binding.pivotY / document.height * 100}%` : "center";
};
const hexToRgb = (hex: string) => {
  const value = parseInt(hex.slice(1), 16);
  return { r: value >> 16, g: value >> 8 & 255, b: value & 255 };
};
const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0")).join("")}`;
const rgbToHsl = ({ r, g, b }: ReturnType<typeof hexToRgb>) => {
  const [red, green, blue] = [r, g, b].map((value) => value / 255);
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue), delta = max - min;
  let h = 0;
  if (delta) h = max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  h = Math.round((h * 60 + 360) % 360);
  const l = (max + min) / 2;
  const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0;
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
};
const hslToHex = (h: number, s: number, l: number) => {
  const saturation = s / 100, lightness = l / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = lightness - c / 2;
  let parts = [0, 0, 0];
  if (h < 60) parts = [c, x, 0]; else if (h < 120) parts = [x, c, 0]; else if (h < 180) parts = [0, c, x];
  else if (h < 240) parts = [0, x, c]; else if (h < 300) parts = [x, 0, c]; else parts = [c, 0, x];
  return rgbToHex(...parts.map((value) => (value + m) * 255) as [number, number, number]);
};
const rgbToHsv = ({ r, g, b }: ReturnType<typeof hexToRgb>) => {
  const [red, green, blue] = [r, g, b].map((value) => value / 255);
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue), delta = max - min;
  let h = 0;
  if (delta) h = max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  return { h: Math.round((h * 60 + 360) % 360), s: Math.round((max ? delta / max : 0) * 100), v: Math.round(max * 100) };
};
const hsvToHex = (h: number, s: number, v: number) => {
  const saturation = s / 100, value = v / 100, c = value * saturation;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = value - c;
  let parts = [0, 0, 0];
  if (h < 60) parts = [c, x, 0]; else if (h < 120) parts = [x, c, 0]; else if (h < 180) parts = [0, c, x];
  else if (h < 240) parts = [0, x, c]; else if (h < 300) parts = [x, 0, c]; else parts = [c, 0, x];
  return rgbToHex(...parts.map((channel) => (channel + m) * 255) as [number, number, number]);
};

export default function NaturalMediaLab() {
  const rasterSessionRef = useRef<RasterSession | null>(null);
  const rasterSession = rasterSessionRef.current ??= new RasterSession();
  const [liveDocument, setLiveDocument] = useState(() => createLiveDocumentState(createDocument()));
  const document = liveDocument.document;
  const setDocument = useCallback((update: NaturalMediaDocument | ((document: NaturalMediaDocument) => NaturalMediaDocument)) => {
    setLiveDocument((current) => updateLiveDocumentState(current, update, rasterSession.layerDescriptors()));
  }, [rasterSession]);
  const [tool, setTool] = useState(BRUSHES[0]);
  const [toolFamily, setToolFamily] = useState<"natural" | "procedural">("natural");
  const [proceduralTool, setProceduralTool] = useState(PROCEDURAL_BRUSHES[0]);
  const [color, setColor] = useState("#1d2220");
  const [size, setSize] = useState(12);
  const [flow, setFlow] = useState(75);
  const [wetness, setWetness] = useState(20);
  const [grain, setGrain] = useState(35);
  const [scatter, setScatter] = useState(8);
  const [pressureAmount, setPressureAmount] = useState(100);
  const [selectionMode, setSelectionMode] = useState<"paint" | "rectangle" | "ellipse">("paint");
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_EDITOR_ZOOM);
  const [view, setView] = useState({ rotation: 0 });
  const [browserViewport, setBrowserViewport] = useState({ width: 1280, height: 800 });
  const [mirror, setMirror] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [snap, setSnap] = useState(false);
  const [gridSize, setGridSize] = useState(100);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [colorSpace, setColorSpace] = useState<"hsl" | "hsv">("hsl");
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [isPlaying, setIsPlaying] = useState(false);
  const [onionSkin, setOnionSkin] = useState(true);
  const [onionUrl, setOnionUrl] = useState("");
  const [showRig, setShowRig] = useState(true);
  const [selectedBoneId, setSelectedBoneId] = useState<string | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedComicIds, setSelectedComicIds] = useState<string[]>([]);
  const [smartGuides, setSmartGuides] = useState<{ x?: number; y?: number }>({});
  const [showNew, setShowNew] = useState(false);
  const [newSize, setNewSize] = useState({ width: 1600, height: 1000, background: "paper" as "paper" | "transparent" });
  const [saveState, setSaveState] = useState("Saved on this device");
  const [performanceNote, setPerformanceNote] = useState("");
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [tourStep, setTourStep] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const canvasRefs = useRef(new Map<string, HTMLCanvasElement>());
  const simulationRefs = useRef(new Map<string, { wet: HTMLCanvasElement; height: HTMLCanvasElement }>());
  const drawingRef = useRef(false);
  const pointRef = useRef({ x: 0, y: 0 });
  const selectionOriginRef = useRef<{ x: number; y: number } | null>(null);
  const strokeSeedRef = useRef(1);
  const strokeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dirtyStrokeRef = useRef<RasterRect | null>(null);
  const historyRef = useRef<EditorHistoryEntry[]>([]);
  const redoRef = useRef<EditorHistoryEntry[]>([]);
  const pendingStrokeHistoryIdRef = useRef<string | null>(null);
  const commandJournalRef = useRef<CommandJournal<ArtRoomCommand>>(createCommandJournal<ArtRoomCommand>());
  const commandBaselineRef = useRef<{ sequence: number; document: NaturalMediaDocument } | null>(null);
  const exportJobRef = useRef<ExportJobController | null>(null);
  const exportJob = exportJobRef.current ??= new ExportJobController();
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const spaceRef = useRef(false);
  const panningRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const comicDragRef = useRef<{ kind: "panel" | "text"; id: string; mode: "move" | "resize" | "crop"; startPaperX: number; startPaperY: number; base: ComicPanel } | null>(null);
  const activeLayer = document.layers.find((layer) => layer.id === document.activeLayerId) ?? document.layers[0];
  const activeFrameIndex = document.animation.frames.findIndex((frame) => frame.id === document.animation.activeFrameId);
  const activeFrame = document.animation.frames[activeFrameIndex];
  const paperBaseSize = getPaperBaseSize(document.width, document.height, browserViewport.width, browserViewport.height);
  const viewRotation = view.rotation + activeFrame.camera.rotation;
  const viewportGeometry = getCanvasViewportGeometry(paperBaseSize, zoom, activeFrame.camera.zoom, viewRotation);
  const activeTransform = resolveLayerTransform(document.animation.frames, activeFrameIndex, activeLayer.id);
  const selectedBone = document.rig.bones.find((bone) => bone.id === selectedBoneId) ?? null;
  const selectedPanel = document.comic.panels.find((panel) => panel.id === selectedPanelId) ?? null;
  const selectedText = document.comic.text.find((item) => item.id === selectedTextId) ?? null;
  const activeComicPage = document.comic.pages.find((page) => page.id === document.comic.activePageId) ?? document.comic.pages[0]!;
  const panelPreviewUrl = (panel: ComicPanel) => {
    if (!panel.sourcePageId) return "";
    const page = document.comic.pages.find((item) => item.id === panel.sourcePageId);
    const layer = [...document.layers].reverse().find((item) => item.visible && page?.layerData[item.id]);
    return layer && page ? page.layerData[layer.id] : "";
  };
  const getPaperClientSpace = (): PaperClientSpace | null => {
    const paper = paperRef.current; if (!paper) return null;
    const bounds = paper.getBoundingClientRect();
    return {
      centerX: bounds.left + bounds.width / 2,
      centerY: bounds.top + bounds.height / 2,
      paperWidth: paper.clientWidth,
      paperHeight: paper.clientHeight,
      rotationDegrees: viewRotation,
    };
  };

  const getSimulationBuffers = useCallback((layerId: string, width: number, height: number) => {
    let buffers = simulationRefs.current.get(layerId);
    if (!buffers) {
      buffers = { wet: window.document.createElement("canvas"), height: window.document.createElement("canvas") };
      simulationRefs.current.set(layerId, buffers);
    }
    if (buffers.wet.width !== width || buffers.wet.height !== height) {
      buffers.wet.width = width; buffers.wet.height = height; buffers.height.width = width; buffers.height.height = height;
    }
    return buffers;
  }, []);

  const resetRasterTileCache = () => {
    rasterSession.reset();
    setLiveDocument((current) => refreshLiveDocumentRaster(current, {}));
    dirtyStrokeRef.current = null;
  };

  const persistCanvasTiles = (layerId: string, canvas: HTMLCanvasElement, dirty: RasterRect, historyEntryId?: string | null) => {
    void rasterSession.persist({
        layerId,
        source: createCanvasRasterSurface(canvas),
        dirty,
      }).then((revision) => {
      if (!revision) return;
      setLiveDocument((current) => refreshLiveDocumentRaster(current, rasterSession.layerDescriptors()));
      commandJournalRef.current = appendJournalEntry(commandJournalRef.current, {
        id: revision.id,
        kind: revision.type,
        createdAt: revision.createdAt,
        payload: revision,
        undoable: true,
      });
      if (historyEntryId) {
        const historyEntry = [...historyRef.current, ...redoRef.current].find((entry) => entry.id === historyEntryId);
        if (historyEntry) {
          historyEntry.rasterRevision = revision;
          historyEntry.rasterRevisionPending = false;
          historyEntry.commandSequence = commandJournalRef.current.head;
        }
      }
    }).catch(() => setPerformanceNote("Tile cache update deferred; project recovery remains available."));
  };

  const paintCanvases = useCallback((next: NaturalMediaDocument) => {
    next.layers.forEach((layer) => {
      const canvas = canvasRefs.current.get(layer.id);
      if (!canvas) return;
      const surface = createCanvasRasterSurface(canvas);
      surface.resize(next.width, next.height);
      surface.clear();
      if (layer.dataUrl) void surface.restoreDataUrl(layer.dataUrl);
      const buffers = getSimulationBuffers(layer.id, next.width, next.height);
      ([["wet", layer.simulation.wetMapUrl], ["height", layer.simulation.heightMapUrl]] as const).forEach(([kind, url]) => {
        const target = buffers[kind], targetContext = target.getContext("2d");
        targetContext?.clearRect(0, 0, next.width, next.height);
        if (targetContext && url) {
          const image = new Image(); image.onload = () => targetContext.drawImage(image, 0, 0); image.src = url;
        }
      });
    });
  }, [getSimulationBuffers]);

  const createCurrentRasterRecovery = async () => {
    return rasterSession.createRecovery();
  };

  const restoreRecoveredRaster = async (snapshot: RasterRecoverySnapshotV1, recoveredDocument: NaturalMediaDocument) => {
    if (!await rasterSession.restore(snapshot)) return;
    setLiveDocument((current) => refreshLiveDocumentRaster(current, rasterSession.layerDescriptors()));
    const resolver = rasterSession.createResolver();
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    for (const layer of recoveredDocument.layers) {
      const canvas = canvasRefs.current.get(layer.id), descriptor = rasterSession.layerDescriptor(layer.id);
      if (!canvas || !descriptor) continue;
      const surface = createCanvasRasterSurface(canvas);
      surface.resize(recoveredDocument.width, recoveredDocument.height);
      surface.clear();
      if (layer.dataUrl) await surface.restoreDataUrl(layer.dataUrl);
      await surface.restoreTileSet(descriptor, (handleId) => resolver.resolve(handleId));
    }
  };

  useEffect(() => {
    loadRecovery().then((saved) => {
      if (!saved) return;
      setLiveDocument(restoreLiveDocumentState(saved.document, "working" in saved ? saved.working : undefined));
      if ("raster" in saved && saved.raster) void restoreRecoveredRaster(saved.raster, saved.document).catch(() => setPerformanceNote("Tile recovery unavailable; restored the document snapshot instead."));
    })
      .catch(() => setSaveState("Local recovery unavailable")).finally(() => setHydrated(true));
  }, []);
  useEffect(() => {
    try { if (!localStorage.getItem("nml-tour-complete")) setTourStep(0); } catch { /* optional onboarding */ }
  }, []);
  useEffect(() => {
    const updateViewport = () => setBrowserViewport({ width: window.innerWidth, height: window.innerHeight });
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);
  useEffect(() => {
    try { setRecentColors(JSON.parse(localStorage.getItem("nml-recent-colors") || "[]")); } catch { /* optional preference */ }
    const keyDown = (event: KeyboardEvent) => { if (event.code === "Space" && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); spaceRef.current = true; } };
    const keyUp = (event: KeyboardEvent) => { if (event.code === "Space") spaceRef.current = false; };
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);
    return () => { window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); };
  }, []);
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const id = selectedPanelId ?? selectedTextId; if (!id) return;
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (arrows[event.key]) {
        event.preventDefault(); const [dx, dy] = arrows[event.key], amount = event.shiftKey ? 5 : 1;
        setDocument((current) => ({ ...current, comic: { ...current.comic,
          panels: selectedPanelId ? current.comic.panels.map((item) => item.id === id ? { ...item, x: Math.max(0, Math.min(100 - item.width, item.x + dx * amount)), y: Math.max(0, Math.min(100 - item.height, item.y + dy * amount)) } : item) : current.comic.panels,
          text: selectedTextId ? current.comic.text.map((item) => item.id === id ? { ...item, x: Math.max(0, Math.min(100 - item.width, item.x + dx * amount)), y: Math.max(0, Math.min(100 - item.height, item.y + dy * amount)) } : item) : current.comic.text,
        } })); return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        if (selectedPanelId) setDocument((current) => { const source = current.comic.panels.find((item) => item.id === id); if (!source) return current; const copy = { ...source, id: crypto.randomUUID(), x: Math.min(95 - source.width, source.x + 2), y: Math.min(95 - source.height, source.y + 2) }; setSelectedPanelId(copy.id); return { ...current, comic: { ...current.comic, panels: [...current.comic.panels, copy] } }; });
        else setDocument((current) => { const source = current.comic.text.find((item) => item.id === id); if (!source) return current; const copy = { ...source, id: crypto.randomUUID(), x: Math.min(95 - source.width, source.x + 2), y: Math.min(95 - source.height, source.y + 2) }; setSelectedTextId(copy.id); return { ...current, comic: { ...current.comic, text: [...current.comic.text, copy] } }; });
      }
    };
    window.addEventListener("keydown", keyDown); return () => window.removeEventListener("keydown", keyDown);
  }, [selectedPanelId, selectedTextId]);
  useEffect(() => {
    paintCanvases(document);
  }, [document.width, document.height, document.layers.length, document.activeLayerId, paintCanvases]);
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      createCurrentRasterRecovery().then((raster) => saveRecovery(document, liveDocument.working, raster)).then(() => setSaveState("Saved on this device"))
        .catch(() => setSaveState("Recovery save failed"));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [liveDocument, hydrated]);

  const captureDocument = useCallback((): NaturalMediaDocument => {
    return captureDocumentSnapshot(document, {
      layerDataUrl: (layer) => {
        const canvas = canvasRefs.current.get(layer.id);
        return canvas && createCanvasRasterSurface(canvas).snapshotDataUrl();
      },
      simulationDataUrl: (layer, kind) => simulationRefs.current.get(layer.id)?.[kind].toDataURL("image/png"),
    });
  }, [document]);
  const commit = useCallback(() => {
    const next = captureDocument(); setDocument(next); setSaveState("Saving…"); return next;
  }, [captureDocument]);
  const pruneRasterHistoryPayloads = () => {
    const retained = [...historyRef.current, ...redoRef.current].flatMap((entry) => [entry.rasterRevision?.before, entry.rasterRevision?.after]);
    void rasterSession.prune(retained);
  };
  const pushHistory = (rasterCompatible = false, rasterRevisionPending = false) => {
    const snapshot = clone(captureDocument());
    if (commandJournalRef.current.head > 0 && shouldCreateCheckpoint(commandJournalRef.current)) {
      const sequence = commandJournalRef.current.head;
      commandBaselineRef.current = { sequence, document: clone(snapshot) };
      commandJournalRef.current = compactJournalAtCheckpoint(commandJournalRef.current, {
        sequence,
        createdAt: new Date().toISOString(),
        path: `recovery/journal-checkpoints/${sequence}.json`,
      }).journal;
    }
    const id = crypto.randomUUID();
    recordHistoryEntry(historyRef.current, redoRef.current, { id, document: snapshot, rasterCompatible, rasterRevisionPending });
    pruneRasterHistoryPayloads();
    return id;
  };
  const dispatchEditorCommand = (command: EditorCommand) => {
    commandJournalRef.current = appendJournalEntry(commandJournalRef.current, {
      id: command.id,
      kind: command.type,
      createdAt: command.createdAt,
      payload: command,
      undoable: true,
    });
    const historyEntry = historyRef.current[historyRef.current.length - 1];
    if (historyEntry && historyEntry.commandSequence === undefined) historyEntry.commandSequence = commandJournalRef.current.head;
    setDocument((current) => applyEditorCommand(current, command));
  };
  const commandIdentity = () => ({ id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  const restoreHistory = (source: EditorHistoryEntry[], destination: EditorHistoryEntry[], direction: "undo" | "redo") => {
    const entry = takeHistoryStep(source, destination, clone(captureDocument())); if (!entry) return;
    if (entry.commandSequence !== undefined) {
      const requestedHead = direction === "undo" ? entry.commandSequence - 1 : entry.commandSequence;
      const checkpointSequence = commandJournalRef.current.checkpoint?.sequence;
      if (checkpointSequence !== undefined && requestedHead < checkpointSequence) {
        commandJournalRef.current = createCommandJournal<ArtRoomCommand>();
        commandBaselineRef.current = null;
        [...historyRef.current, ...redoRef.current].forEach((historyEntry) => delete historyEntry.commandSequence);
      } else {
        commandJournalRef.current = moveJournalHead(commandJournalRef.current, requestedHead);
      }
    } else {
      commandJournalRef.current = createCommandJournal<ArtRoomCommand>();
      commandBaselineRef.current = null;
    }
    if (!entry.rasterRevision) {
      if (historyEntryRequiresRasterReset(entry)) resetRasterTileCache();
      setDocument(entry.document);
      window.setTimeout(() => paintCanvases(entry.document));
      return;
    }
    rasterSession.applyRevision(entry.rasterRevision, direction);
    setLiveDocument((current) => refreshLiveDocumentRaster(current, rasterSession.layerDescriptors()));
    setDocument(entry.document);
    window.setTimeout(() => {
      paintCanvases(entry.document);
      void (async () => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const layer = entry.document.layers.find((item) => item.id === entry.rasterRevision!.layerId);
        const canvas = canvasRefs.current.get(entry.rasterRevision!.layerId);
        const descriptor = direction === "undo" ? entry.rasterRevision!.before : entry.rasterRevision!.after;
        if (!layer || !canvas) return;
        const surface = createCanvasRasterSurface(canvas);
        surface.resize(entry.document.width, entry.document.height);
        surface.clear();
        if (layer.dataUrl) await surface.restoreDataUrl(layer.dataUrl);
        if (descriptor) {
          const resolver = rasterSession.createResolver();
          await surface.restoreTileSet(descriptor, (handleId) => resolver.resolve(handleId));
        }
      })().catch(() => setPerformanceNote("Tile history restore used the document snapshot fallback."));
    });
    pruneRasterHistoryPayloads();
  };
  const canvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = {
      x: event.nativeEvent.offsetX * document.width / event.currentTarget.clientWidth,
      y: event.nativeEvent.offsetY * document.height / event.currentTarget.clientHeight,
    };
    if (snap) return { x: Math.round(point.x / gridSize) * gridSize, y: Math.round(point.y / gridSize) * gridSize };
    return point;
  };
  const beginStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (spaceRef.current || event.button === 1) return;
    if (selectionMode !== "paint") {
      event.currentTarget.setPointerCapture(event.pointerId);
      selectionOriginRef.current = canvasPoint(event);
      setSelection(null);
      return;
    }
    if (activeLayer.locked || !activeLayer.visible) return;
    event.currentTarget.setPointerCapture(event.pointerId); pendingStrokeHistoryIdRef.current = pushHistory(true, true);
    drawingRef.current = true; pointRef.current = canvasPoint(event); strokeCanvasRef.current = event.currentTarget; dirtyStrokeRef.current = null;
  };
  const drawStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (selectionOriginRef.current) {
      const point = canvasPoint(event), origin = selectionOriginRef.current;
      setSelection({ x: Math.min(origin.x, point.x), y: Math.min(origin.y, point.y), width: Math.abs(point.x - origin.x), height: Math.abs(point.y - origin.y) });
      return;
    }
    if (!drawingRef.current) return;
    const context = createCanvasRasterSurface(event.currentTarget).context2d();
    const point = canvasPoint(event), pressure = event.pressure || .5;
    const scaledSize = size * document.width / event.currentTarget.getBoundingClientRect().width;
    const proceduralRadius = document.procedural.scale * document.width / event.currentTarget.getBoundingClientRect().width * 3;
    const dirty = dirtyRectForSegment(pointRef.current, point, toolFamily === "procedural" ? proceduralRadius : scaledSize * 1.8, document.width, document.height, mirror);
    dirtyStrokeRef.current = unionRasterRects(dirtyStrokeRef.current, dirty);
    const buffers = getSimulationBuffers(activeLayer.id, document.width, document.height);
    if (toolFamily === "procedural") {
      renderProceduralStroke(context, pointRef.current, point, proceduralTool, {
        density: document.procedural.density / 100,
        scale: document.procedural.scale * document.width / event.currentTarget.getBoundingClientRect().width,
        wind: (document.procedural.wind - 50) / 50,
        colorVariation: document.procedural.colorVariation / 100,
        color, seed: strokeSeedRef.current++, mirror, canvasWidth: document.width,
      });
    } else {
      renderBrushStroke(context, pointRef.current, point, tool, {
        size: scaledSize, color, flow: flow / 100, wetness: wetness / 100,
        grain: grain / 100, scatter: scatter / 100,
        pressure: .5 + (pressure - .5) * pressureAmount / 100,
        mirror, canvasWidth: document.width, eraser: tool.id === "eraser",
        effects: document.effects.strength / 100, seed: strokeSeedRef.current++,
        wetContext: buffers.wet.getContext("2d") ?? undefined,
        heightContext: buffers.height.getContext("2d") ?? undefined,
        absorbency: document.effects.absorbency / 100,
        separation: document.effects.separation / 100,
      });
    }
    pointRef.current = point;
  };
  const endStroke = () => {
    selectionOriginRef.current = null;
    if (drawingRef.current) {
      drawingRef.current = false;
      const canvas = strokeCanvasRef.current;
      const historyEntryId = pendingStrokeHistoryIdRef.current;
      pendingStrokeHistoryIdRef.current = null;
      const finishStroke = () => {
        commit();
        if (canvas && dirtyStrokeRef.current) persistCanvasTiles(activeLayer.id, canvas, dirtyStrokeRef.current, historyEntryId);
        dirtyStrokeRef.current = null;
      };
      if (toolFamily === "natural" && tool.id === "watercolor" && canvas && document.effects.strength > 0) {
        dirtyStrokeRef.current = { x: 0, y: 0, width: document.width, height: document.height };
        let passes = 0;
        const settle = () => {
          const context = canvas.getContext("2d"); if (!context) return finishStroke();
          const copy = window.document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
          copy.getContext("2d")?.drawImage(canvas, 0, 0);
          context.save(); context.globalAlpha = .025 + document.effects.strength / 5000;
          context.filter = `blur(${1 + document.effects.strength / 35}px)`;
          context.drawImage(copy, -1, -1, canvas.width + 2, canvas.height + 2); context.restore();
          passes += 1;
          if (passes < 4) requestAnimationFrame(settle); else finishStroke();
        };
        requestAnimationFrame(settle);
      } else finishStroke();
    }
  };
  const updateLayer = (id: string, patch: Partial<Pick<PaintLayer, "name" | "visible" | "locked" | "opacity" | "blendMode">>) => {
    pushHistory(true);
    dispatchEditorCommand({ ...commandIdentity(), type: "layer.update", layerId: id, patch });
  };
  const addLayer = () => {
    pushHistory(true); const layer = createLayer(`Paint layer ${document.layers.length + 1}`);
    dispatchEditorCommand({ ...commandIdentity(), type: "layer.add", layer, makeActive: true });
  };
  const deleteLayer = () => {
    if (document.layers.length === 1) return; pushHistory(true);
    dispatchEditorCommand({ ...commandIdentity(), type: "layer.delete", layerId: activeLayer.id });
  };
  const moveLayer = (direction: -1 | 1) => {
    const index = document.layers.findIndex((layer) => layer.id === activeLayer.id), target = index + direction;
    if (target < 0 || target >= document.layers.length) return; pushHistory(true);
    dispatchEditorCommand({ ...commandIdentity(), type: "layer.move", layerId: activeLayer.id, direction });
  };
  const duplicateLayer = () => {
    pushHistory(true);
    const copy = { ...activeLayer, id: crypto.randomUUID(), name: `${activeLayer.name} copy`, dataUrl: canvasRefs.current.get(activeLayer.id)?.toDataURL("image/png") ?? activeLayer.dataUrl };
    const index = document.layers.findIndex((layer) => layer.id === activeLayer.id);
    dispatchEditorCommand({ ...commandIdentity(), type: "layer.add", layer: copy, index: index + 1, makeActive: true });
  };
  const mergeDown = () => {
    const index = document.layers.findIndex((layer) => layer.id === activeLayer.id);
    if (index <= 0) return;
    pushHistory();
    const lower = document.layers[index - 1], lowerCanvas = canvasRefs.current.get(lower.id), activeCanvas = canvasRefs.current.get(activeLayer.id);
    if (!lowerCanvas || !activeCanvas) return;
    const merged = mergeCanvasLayers(document.width, document.height, [
      { canvas: lowerCanvas, opacity: lower.opacity, blendMode: lower.blendMode },
      { canvas: activeCanvas, opacity: activeLayer.opacity, blendMode: activeLayer.blendMode },
    ]);
    const layers = document.layers.filter((layer) => layer.id !== activeLayer.id).map((layer) => layer.id === lower.id ? { ...layer, dataUrl: merged.toDataURL("image/png"), opacity: 1, blendMode: "source-over" as BlendMode } : layer);
    resetRasterTileCache(); persistCanvasTiles(lower.id, merged, { x: 0, y: 0, width: document.width, height: document.height });
    setDocument({ ...document, layers, activeLayerId: lower.id });
  };
  const flipLayer = (vertical = false) => {
    const canvas = canvasRefs.current.get(activeLayer.id); if (!canvas) return;
    pushHistory();
    const copy = flipCanvasLayer(canvas, document.width, document.height, vertical);
    const next = { ...document, layers: document.layers.map((layer) => layer.id === activeLayer.id ? { ...layer, dataUrl: copy.toDataURL("image/png") } : layer) };
    persistCanvasTiles(activeLayer.id, copy, { x: 0, y: 0, width: document.width, height: document.height });
    setDocument(next); window.setTimeout(() => paintCanvases(next));
  };
  const resizeProject = () => {
    const width = Number(prompt("New canvas width in pixels", String(document.width)));
    const height = Number(prompt("New canvas height in pixels", String(document.height)));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 64 || height < 64 || width > 4096 || height > 4096) return;
    pushHistory();
    const layers = document.layers.map((layer) => {
      const source = canvasRefs.current.get(layer.id), resized = resizeCanvasLayer(source, width, height);
      return { ...layer, dataUrl: resized.toDataURL("image/png") };
    });
    resetRasterTileCache();
    setDocument({ ...document, width, height, layers });
  };
  const cropToSelection = () => {
    if (!selection || selection.width < 2 || selection.height < 2) return;
    pushHistory();
    const width = Math.round(selection.width), height = Math.round(selection.height);
    const layers = document.layers.map((layer) => {
      const source = canvasRefs.current.get(layer.id), cropped = cropCanvasLayer(source, selection);
      return { ...layer, dataUrl: cropped.toDataURL("image/png") };
    });
    resetRasterTileCache();
    setDocument({ ...document, width, height, layers }); setSelection(null); setSelectionMode("paint");
  };
  const fillGradient = () => {
    const canvas = canvasRefs.current.get(activeLayer.id); if (!canvas || activeLayer.locked) return;
    pushHistory();
    const hsl = rgbToHsl(hexToRgb(color));
    fillCanvasLinearGradient(canvas, color, hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l)); commit();
    persistCanvasTiles(activeLayer.id, canvas, { x: 0, y: 0, width: document.width, height: document.height });
  };
  const composite = () => {
    return compositeCanvasLayers(document.width, document.height, document.background, document.layers.flatMap((layer) => {
      const canvas = canvasRefs.current.get(layer.id);
      return canvas ? [{ canvas, visible: layer.visible, opacity: layer.opacity, blendMode: layer.blendMode }] : [];
    }));
  };
  const chooseColor = (next: string) => {
    setColor(next);
    setRecentColors((current) => {
      const colors = [next, ...current.filter((item) => item !== next)].slice(0, 8);
      try { localStorage.setItem("nml-recent-colors", JSON.stringify(colors)); } catch { /* optional preference */ }
      return colors;
    });
  };
  const exportArtwork = () => {
    const canvas = composite();
    const plan = planRasterExport(document.name, exportFormat, document.background);
    if (plan.flattenColor) {
      const flattened = flattenCanvas(canvas, plan.flattenColor);
      download(flattened.toDataURL(plan.mediaType, plan.quality), plan.filename);
      return;
    }
    download(canvas.toDataURL(plan.mediaType, plan.quality), plan.filename);
  };
  const beginPan = (event: PointerEvent<HTMLDivElement>) => {
    if (!spaceRef.current && event.button !== 1) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    panningRef.current = { x: event.clientX, y: event.clientY, scrollLeft: event.currentTarget.scrollLeft, scrollTop: event.currentTarget.scrollTop };
  };
  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    const pan = panningRef.current; if (!pan) return;
    event.currentTarget.scrollLeft = pan.scrollLeft - (event.clientX - pan.x);
    event.currentTarget.scrollTop = pan.scrollTop - (event.clientY - pan.y);
  };
  const endPan = () => { panningRef.current = null; };
  const setEditorZoom = (nextValue: number, clientX?: number, clientY?: number) => {
    const nextZoom = clampEditorZoom(nextValue);
    if (nextZoom === zoom) return;
    const stage = stageRef.current, paper = paperRef.current;
    if (!stage || !paper) { setZoom(nextZoom); return; }
    const stageBounds = stage.getBoundingClientRect();
    const paperBounds = paper.getBoundingClientRect();
    const anchorX = clientX ?? stageBounds.left + stage.clientWidth / 2;
    const anchorY = clientY ?? stageBounds.top + stage.clientHeight / 2;
    const ratio = clientPointToPaperRatio(anchorX, anchorY, paperBounds.left + paperBounds.width / 2, paperBounds.top + paperBounds.height / 2, paper.clientWidth, paper.clientHeight, viewRotation);
    setZoom(nextZoom);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const updatedPaper = paperRef.current, updatedStage = stageRef.current;
      if (!updatedPaper || !updatedStage) return;
      const updatedBounds = updatedPaper.getBoundingClientRect();
      const target = paperRatioToClientPoint(ratio.x, ratio.y, updatedBounds.left + updatedBounds.width / 2, updatedBounds.top + updatedBounds.height / 2, updatedPaper.clientWidth, updatedPaper.clientHeight, viewRotation);
      updatedStage.scrollLeft += target.x - anchorX;
      updatedStage.scrollTop += target.y - anchorY;
    }));
  };
  const wheelZoom = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault(); setEditorZoom(zoom - Math.sign(event.deltaY) * 5, event.clientX, event.clientY);
  };
  const resetView = () => {
    setView({ rotation: 0 }); setZoom(DEFAULT_EDITOR_ZOOM);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const stage = stageRef.current; if (!stage) return;
      stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
      stage.scrollTop = Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2);
    }));
  };
  const download = (href: string, name: string) => {
    const link = window.document.createElement("a"); link.href = href; link.download = name; link.click();
  };
  const saveProject = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(captureDocument())], { type: "application/json" }));
    download(url, `${safeExportStem(document.name)}.nml`); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const loadProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const project = parseProject(JSON.parse(await file.text()));
      historyRef.current = []; redoRef.current = []; commandJournalRef.current = createCommandJournal<ArtRoomCommand>(); resetRasterTileCache(); setDocument(project);
      window.setTimeout(() => paintCanvases(project));
    } catch (error) { alert(error instanceof Error ? error.message : "Could not open this project."); }
    event.target.value = "";
  };
  const createNew = () => {
    pushHistory(); commandJournalRef.current = createCommandJournal<ArtRoomCommand>(); resetRasterTileCache(); setDocument(createDocument(newSize.width, newSize.height, newSize.background)); setShowNew(false);
  };
  const goToFrame = async (frameId: string) => {
    const captured = captureDocument();
    const target = captured.animation.frames.find((frame) => frame.id === frameId); if (!target) return;
    const targetIndex = captured.animation.frames.findIndex((frame) => frame.id === frameId);
    if (onionSkin && targetIndex > 0) setOnionUrl((await renderAnimationFrame(captured, captured.animation.frames[targetIndex - 1].id)).toDataURL("image/png")); else setOnionUrl("");
    const next = { ...captured, layers: captured.layers.map((layer) => ({ ...layer, dataUrl: target.layerData[layer.id] ?? "" })), animation: { ...captured.animation, activeFrameId: frameId } };
    setDocument(next); window.setTimeout(() => paintCanvases(next));
  };
  const addFrame = (duplicate = false) => {
    const captured = captureDocument(), active = captured.animation.frames.find((frame) => frame.id === captured.animation.activeFrameId)!;
    const frame = { id: crypto.randomUUID(), name: `Frame ${captured.animation.frames.length + 1}`, layerData: duplicate ? { ...active.layerData } : Object.fromEntries(captured.layers.map((layer) => [layer.id, ""])), hold: 1, transforms: duplicate ? JSON.parse(JSON.stringify(active.transforms)) : {}, bonePose: duplicate ? { ...active.bonePose } : {}, spriteExposure: duplicate ? { ...active.spriteExposure } : {}, mouthCue: duplicate ? active.mouthCue : "rest" as const, camera: duplicate ? { ...active.camera } : { x: 0, y: 0, zoom: 100, rotation: 0, shake: 0 } };
    const next = { ...captured, layers: captured.layers.map((layer) => ({ ...layer, dataUrl: frame.layerData[layer.id] ?? "" })), animation: { ...captured.animation, activeFrameId: frame.id, frames: [...captured.animation.frames, frame] } };
    pushHistory(); setDocument(next); window.setTimeout(() => paintCanvases(next));
  };
  const deleteFrame = () => {
    if (document.animation.frames.length === 1) return;
    pushHistory(); const index = document.animation.frames.findIndex((frame) => frame.id === document.animation.activeFrameId);
    const frames = document.animation.frames.filter((frame) => frame.id !== document.animation.activeFrameId), target = frames[Math.max(0, index - 1)];
    const next = { ...document, layers: document.layers.map((layer) => ({ ...layer, dataUrl: target.layerData[layer.id] ?? "" })), animation: { ...document.animation, frames, activeFrameId: target.id } };
    setDocument(next); window.setTimeout(() => paintCanvases(next));
  };
  const moveFrame = (direction: -1 | 1) => {
    const index = document.animation.frames.findIndex((frame) => frame.id === document.animation.activeFrameId), target = index + direction;
    if (target < 0 || target >= document.animation.frames.length) return;
    const frames = [...document.animation.frames]; [frames[index], frames[target]] = [frames[target], frames[index]];
    setDocument({ ...document, animation: { ...document.animation, frames } });
  };
  const updateTransform = (patch: Partial<typeof DEFAULT_LAYER_TRANSFORM>) => {
    setDocument((current) => ({ ...current, animation: { ...current.animation, frames: current.animation.frames.map((frame) => frame.id === current.animation.activeFrameId ? { ...frame, transforms: { ...frame.transforms, [current.activeLayerId]: { ...DEFAULT_LAYER_TRANSFORM, ...resolveLayerTransform(current.animation.frames, current.animation.frames.findIndex((item) => item.id === frame.id), current.activeLayerId), ...patch } } } : frame) } }));
  };
  const addBone = () => {
    const parent = selectedBone;
    const bone: RigBone = { id: crypto.randomUUID(), name: `Bone ${document.rig.bones.length + 1}`, parentId: parent?.id ?? null, x: parent ? 0 : document.width / 2, y: parent ? 0 : document.height / 2, length: Math.max(40, Math.round(document.width * .12)), restRotation: parent ? 0 : -90 };
    setDocument((current) => ({ ...current, rig: { ...current.rig, bones: [...current.rig.bones, bone] } }));
    setSelectedBoneId(bone.id); setShowRig(true);
  };
  const updateBone = (patch: Partial<RigBone>) => {
    if (!selectedBone) return;
    setDocument((current) => ({ ...current, rig: { ...current.rig, bones: current.rig.bones.map((bone) => bone.id === selectedBone.id ? { ...bone, ...patch } : bone) } }));
  };
  const dragBoneEndpoint = (event: PointerEvent<HTMLButtonElement>, bone: RigBone) => {
    if (!(event.buttons & 1)) return;
    const paperSpace = getPaperClientSpace(); if (!paperSpace) return;
    const target = clientPointToDocumentPoint(event.clientX, event.clientY, paperSpace, document);
    const world = boneWorld(document, activeFrame, bone.id);
    const parentRotation = bone.parentId ? boneWorld(document, activeFrame, bone.parentId).rotation : 0;
    const edit = getBoneEndpointEdit(world, target, parentRotation, activeFrame.bonePose[bone.id] ?? 0);
    setDocument((current) => ({ ...current, rig: { ...current.rig, bones: current.rig.bones.map((item) => item.id === bone.id ? { ...item, ...edit } : item) } }));
  };
  const deleteBone = () => {
    if (!selectedBone) return;
    setDocument((current) => ({ ...current, rig: { ...current.rig, bones: current.rig.bones.filter((bone) => bone.id !== selectedBone.id).map((bone) => bone.parentId === selectedBone.id ? { ...bone, parentId: null } : bone), layerBindings: Object.fromEntries(Object.entries(current.rig.layerBindings).filter(([, binding]) => binding.boneId !== selectedBone.id)) } }));
    setSelectedBoneId(null);
  };
  const bindLayer = () => {
    if (!selectedBone) return;
    const world = boneWorld(document, activeFrame, selectedBone.id);
    setDocument((current) => ({ ...current, rig: { ...current.rig, layerBindings: { ...current.rig.layerBindings, [current.activeLayerId]: { boneId: selectedBone.id, pivotX: world.x, pivotY: world.y } } } }));
  };
  const updateBonePose = (rotation: number) => {
    if (!selectedBone) return;
    setDocument((current) => ({ ...current, animation: { ...current.animation, frames: current.animation.frames.map((frame) => frame.id === current.animation.activeFrameId ? { ...frame, bonePose: { ...frame.bonePose, [selectedBone.id]: rotation } } : frame) } }));
  };
  const solveIk = () => {
    if (!selectedBone?.parentId) return;
    const parent = document.rig.bones.find((bone) => bone.id === selectedBone.parentId); if (!parent) return;
    const targetX = Number(prompt("IK target X", String(Math.round(document.width * .65))));
    const targetY = Number(prompt("IK target Y", String(Math.round(document.height * .5))));
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
    const parentStart = boneWorld(document, activeFrame, parent.id);
    const dx = targetX - parentStart.x, dy = targetY - parentStart.y;
    const distance = Math.min(parent.length + selectedBone.length - .001, Math.max(Math.abs(parent.length - selectedBone.length) + .001, Math.hypot(dx, dy)));
    const elbow = Math.acos((parent.length ** 2 + selectedBone.length ** 2 - distance ** 2) / (2 * parent.length * selectedBone.length));
    const shoulder = Math.atan2(dy, dx) - Math.acos((parent.length ** 2 + distance ** 2 - selectedBone.length ** 2) / (2 * parent.length * distance));
    setDocument((current) => ({ ...current, animation: { ...current.animation, frames: current.animation.frames.map((frame) => frame.id === current.animation.activeFrameId ? { ...frame, bonePose: { ...frame.bonePose, [parent.id]: shoulder * 180 / Math.PI - parent.restRotation, [selectedBone.id]: 180 - elbow * 180 / Math.PI - selectedBone.restRotation } } : frame) } }));
  };
  const savePosePreset = () => {
    const name = prompt("Pose preset name", `Pose ${document.rig.posePresets.length + 1}`); if (!name) return;
    setDocument((current) => ({ ...current, rig: { ...current.rig, posePresets: [...current.rig.posePresets, { id: crypto.randomUUID(), name, pose: { ...activeFrame.bonePose } }] } }));
  };
  const applyPosePreset = (id: string) => {
    const preset = document.rig.posePresets.find((item) => item.id === id); if (!preset) return;
    setDocument((current) => ({ ...current, animation: { ...current.animation, frames: current.animation.frames.map((frame) => frame.id === current.animation.activeFrameId ? { ...frame, bonePose: { ...preset.pose } } : frame) } }));
  };
  const captureSprite = () => {
    const canvas = canvasRefs.current.get(activeLayer.id); if (!canvas) return;
    const variants = document.rig.sprites[activeLayer.id] ?? [];
    const name = prompt("Sprite name", `Sprite ${variants.length + 1}`); if (!name) return;
    setDocument((current) => ({ ...current, rig: { ...current.rig, sprites: { ...current.rig.sprites, [activeLayer.id]: [...variants, { name, dataUrl: canvas.toDataURL("image/png") }] } } }));
  };
  const setSpriteExposure = (index: number) => {
    setDocument((current) => ({ ...current, animation: { ...current.animation, frames: current.animation.frames.map((frame) => frame.id === current.animation.activeFrameId ? { ...frame, spriteExposure: { ...frame.spriteExposure, [current.activeLayerId]: index } } : frame) } }));
  };
  const updateCamera = (patch: Partial<AnimationFrame["camera"]>) => {
    setDocument((current) => ({ ...current, animation: { ...current.animation, frames: current.animation.frames.map((frame) => frame.id === current.animation.activeFrameId ? { ...frame, camera: { ...frame.camera, ...patch } } : frame) } }));
  };
  const goToComicPage = (id: string) => {
    const captured = captureDocument(), target = captured.comic.pages.find((page) => page.id === id); if (!target) return;
    const next = { ...captured, layers: captured.layers.map((layer) => ({ ...layer, dataUrl: target.layerData[layer.id] ?? "" })), comic: { ...captured.comic, activePageId: id, panels: target.panels, text: target.text } };
    setDocument(next); window.setTimeout(() => paintCanvases(next));
    setSelectedPanelId(null); setSelectedTextId(null); setSelectedComicIds([]);
  };
  const addComicPage = (duplicate = false) => {
    pushHistory(); const id = crypto.randomUUID(), captured = captureDocument();
    const layerData = Object.fromEntries(captured.layers.map((layer) => [layer.id, duplicate ? layer.dataUrl : ""]));
    const page = { id, name: `Page ${captured.comic.pages.length + 1}`, panels: duplicate ? captured.comic.panels.map((panel) => ({ ...panel, id: crypto.randomUUID() })) : [], text: duplicate ? captured.comic.text.map((item) => ({ ...item, id: crypto.randomUUID() })) : [], layerData };
    const next = { ...captured, layers: captured.layers.map((layer) => ({ ...layer, dataUrl: layerData[layer.id] })), comic: { ...captured.comic, enabled: true, activePageId: id, pages: [...captured.comic.pages, page], panels: page.panels, text: page.text } };
    setDocument(next); window.setTimeout(() => paintCanvases(next));
    setSelectedPanelId(null); setSelectedTextId(null); setSelectedComicIds([]);
  };
  const deleteComicPage = () => {
    if (document.comic.pages.length === 1) return; pushHistory();
    setDocument((current) => {
      const index = current.comic.pages.findIndex((page) => page.id === current.comic.activePageId);
      const pages = current.comic.pages.filter((page) => page.id !== current.comic.activePageId), target = pages[Math.max(0, index - 1)];
      const layers = current.layers.map((layer) => ({ ...layer, dataUrl: target.layerData[layer.id] ?? "" }));
      const next = { ...current, layers, comic: { ...current.comic, activePageId: target.id, pages, panels: target.panels, text: target.text } }; window.setTimeout(() => paintCanvases(next)); return next;
    });
  };
  const moveComicPage = (direction: -1 | 1) => {
    const index = document.comic.pages.findIndex((page) => page.id === document.comic.activePageId), target = index + direction;
    if (target < 0 || target >= document.comic.pages.length) return; pushHistory();
    setDocument((current) => { const layerData = Object.fromEntries(current.layers.map((layer) => [layer.id, canvasRefs.current.get(layer.id)?.toDataURL("image/png") ?? layer.dataUrl])); const pages = current.comic.pages.map((page) => page.id === current.comic.activePageId ? { ...page, panels: current.comic.panels, text: current.comic.text, layerData } : page); [pages[index], pages[target]] = [pages[target], pages[index]]; return { ...current, comic: { ...current.comic, pages } }; });
  };
  const renameComicPage = () => {
    const active = document.comic.pages.find((page) => page.id === document.comic.activePageId), name = prompt("Page name", active?.name ?? "Page"); if (!name) return;
    setDocument((current) => ({ ...current, comic: { ...current.comic, pages: current.comic.pages.map((page) => page.id === current.comic.activePageId ? { ...page, name } : page) } }));
  };
  const applyComicTemplate = (template: "strip" | "grid" | "feature") => {
    pushHistory();
    const layouts: Record<typeof template, Array<Omit<ComicPanel, "id">>> = {
      strip: [{ x: 5, y: 5, width: 90, height: 27 }, { x: 5, y: 36.5, width: 90, height: 27 }, { x: 5, y: 68, width: 90, height: 27 }],
      grid: [{ x: 5, y: 5, width: 43, height: 43 }, { x: 52, y: 5, width: 43, height: 43 }, { x: 5, y: 52, width: 43, height: 43 }, { x: 52, y: 52, width: 43, height: 43 }],
      feature: [{ x: 5, y: 5, width: 90, height: 55 }, { x: 5, y: 64, width: 43, height: 31 }, { x: 52, y: 64, width: 43, height: 31 }],
    };
    setDocument((current) => ({ ...current, comic: { ...current.comic, enabled: true, panels: layouts[template].map((panel) => ({ ...panel, id: crypto.randomUUID() })) } }));
    setSelectedPanelId(null);
  };
  const addComicPanel = () => {
    const panel = { id: crypto.randomUUID(), x: 10, y: 10, width: 40, height: 35 };
    pushHistory(); setDocument((current) => ({ ...current, comic: { ...current.comic, enabled: true, panels: [...current.comic.panels, panel] } })); setSelectedPanelId(panel.id);
  };
  const updateComicPanel = (patch: Partial<ComicPanel>) => {
    if (!selectedPanelId) return;
    setDocument((current) => ({ ...current, comic: { ...current.comic, panels: current.comic.panels.map((panel) => panel.id === selectedPanelId ? { ...panel, ...patch } : panel) } }));
  };
  const deleteComicPanel = () => {
    if (!selectedPanelId) return; pushHistory();
    setDocument((current) => ({ ...current, comic: { ...current.comic, panels: current.comic.panels.filter((panel) => panel.id !== selectedPanelId) } })); setSelectedPanelId(null);
  };
  const beginComicTransform = (event: PointerEvent<HTMLElement>, kind: "panel" | "text", id: string, mode: "move" | "resize" | "crop") => {
    event.stopPropagation(); event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    const item = kind === "panel" ? document.comic.panels.find((panel) => panel.id === id) : document.comic.text.find((text) => text.id === id);
    const paperSpace = getPaperClientSpace(); if (!item || !paperSpace) return;
    const start = clientPointToPaperRatioInSpace(event.clientX, event.clientY, paperSpace);
    pushHistory(); comicDragRef.current = { kind, id, mode, startPaperX: start.x * 100, startPaperY: start.y * 100, base: item };
    setSelectedComicIds((current) => event.shiftKey ? current.includes(id) ? current.filter((item) => item !== id) : [...current, id] : [id]);
    if (kind === "panel") { setSelectedPanelId(id); setSelectedTextId(null); } else { setSelectedTextId(id); setSelectedPanelId(null); }
  };
  const moveComicTransform = (event: PointerEvent<HTMLElement>) => {
    const drag = comicDragRef.current; if (!drag) return; event.stopPropagation();
    const paperSpace = getPaperClientSpace(); if (!paperSpace) return;
    const current = clientPointToPaperRatioInSpace(event.clientX, event.clientY, paperSpace);
    const dx = current.x * 100 - drag.startPaperX, dy = current.y * 100 - drag.startPaperY;
    let patch: Partial<ComicPanel> = getComicTransformPatch(drag.base, drag.mode, dx, dy);
    if (snap && drag.mode === "move") {
      const snapValue = (value: number, size: number) => { const candidates = [document.comic.margin, 50 - size / 2, 100 - document.comic.margin - size]; const target = candidates.find((candidate) => Math.abs(candidate - value) < 1.5); return { value: target ?? value, guide: target === undefined ? undefined : target + size / 2 }; };
      const sx = snapValue(patch.x ?? drag.base.x, drag.base.width), sy = snapValue(patch.y ?? drag.base.y, drag.base.height);
      patch = { ...patch, x: sx.value, y: sy.value }; setSmartGuides({ x: sx.guide, y: sy.guide });
    }
    setDocument((current) => ({ ...current, comic: { ...current.comic,
      panels: drag.kind === "panel" ? current.comic.panels.map((item) => item.id === drag.id ? { ...item, ...patch } : item) : current.comic.panels,
      text: drag.kind === "text" ? current.comic.text.map((item) => item.id === drag.id ? { ...item, ...patch } : item) : current.comic.text,
    } }));
  };
  const endComicTransform = (event: PointerEvent<HTMLElement>) => { event.stopPropagation(); comicDragRef.current = null; setSmartGuides({}); };
  const addComicText = (type: ComicText["type"]) => {
    const text = prompt(`${type[0].toUpperCase()}${type.slice(1)} text`, type === "caption" ? "Meanwhile…" : "Your dialogue here.");
    if (!text) return;
    const item: ComicText = { id: crypto.randomUUID(), type, text, x: 15, y: 12, width: type === "caption" ? 35 : 30, height: 13, tailX: 50, tailY: 125, fontFamily: "sans", fontSize: 18, align: "center" };
    pushHistory(); setDocument((current) => ({ ...current, comic: { ...current.comic, enabled: true, text: [...current.comic.text, item] } })); setSelectedTextId(item.id);
  };
  const updateComicText = (patch: Partial<ComicText>) => {
    if (!selectedTextId) return;
    setDocument((current) => ({ ...current, comic: { ...current.comic, text: current.comic.text.map((item) => item.id === selectedTextId ? { ...item, ...patch } : item) } }));
  };
  const deleteComicText = () => {
    if (!selectedTextId) return; pushHistory();
    setDocument((current) => ({ ...current, comic: { ...current.comic, text: current.comic.text.filter((item) => item.id !== selectedTextId) } })); setSelectedTextId(null);
  };
  const alignComicSelection = (axis: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    if (!selectedComicIds.length) return;
    const place = <T extends ComicPanel>(item: T): T => ({ ...item,
      x: axis === "left" ? document.comic.margin : axis === "center" ? 50 - item.width / 2 : axis === "right" ? 100 - document.comic.margin - item.width : item.x,
      y: axis === "top" ? document.comic.margin : axis === "middle" ? 50 - item.height / 2 : axis === "bottom" ? 100 - document.comic.margin - item.height : item.y,
    });
    pushHistory(); setDocument((current) => ({ ...current, comic: { ...current.comic, panels: current.comic.panels.map((item) => selectedComicIds.includes(item.id) ? place(item) : item), text: current.comic.text.map((item) => selectedComicIds.includes(item.id) ? place(item) : item) } }));
  };
  const distributeComicSelection = (axis: "x" | "y") => {
    const items = [...document.comic.panels, ...document.comic.text].filter((item) => selectedComicIds.includes(item.id)).sort((a, b) => a[axis] - b[axis]); if (items.length < 3) return;
    const first = items[0][axis], last = items[items.length - 1][axis], positions = new Map(items.map((item, index) => [item.id, first + (last - first) * index / (items.length - 1)]));
    pushHistory(); setDocument((current) => ({ ...current, comic: { ...current.comic, panels: current.comic.panels.map((item) => positions.has(item.id) ? { ...item, [axis]: positions.get(item.id)! } : item), text: current.comic.text.map((item) => positions.has(item.id) ? { ...item, [axis]: positions.get(item.id)! } : item) } }));
  };
  const saveLetteringStyle = () => {
    if (!selectedText) return; const name = prompt("Lettering style name", `Style ${document.comic.letteringStyles.length + 1}`); if (!name) return;
    setDocument((current) => ({ ...current, comic: { ...current.comic, letteringStyles: [...current.comic.letteringStyles, { id: crypto.randomUUID(), name, fontFamily: selectedText.fontFamily, fontSize: selectedText.fontSize, align: selectedText.align }] } }));
  };
  const applyLetteringStyle = (id: string) => {
    const style = document.comic.letteringStyles.find((item) => item.id === id); if (!style) return;
    setDocument((current) => ({ ...current, comic: { ...current.comic, text: current.comic.text.map((item) => selectedComicIds.includes(item.id) || item.id === selectedTextId ? { ...item, fontFamily: style.fontFamily, fontSize: style.fontSize, align: style.align } : item) } }));
  };
  const savePageMaster = () => {
    const name = prompt("Page master name", `Master ${document.comic.pageMasters.length + 1}`); if (!name) return;
    setDocument((current) => ({ ...current, comic: { ...current.comic, pageMasters: [...current.comic.pageMasters, { id: crypto.randomUUID(), name, panels: current.comic.panels.map((panel) => ({ ...panel, id: crypto.randomUUID(), sourcePageId: "" })) }] } }));
  };
  const applyPageMaster = (id: string) => {
    const master = document.comic.pageMasters.find((item) => item.id === id); if (!master) return; pushHistory();
    setDocument((current) => ({ ...current, comic: { ...current.comic, panels: master.panels.map((panel) => ({ ...panel, id: crypto.randomUUID() })) } }));
  };
  const exportComicPage = async (format: "png" | "jpeg") => {
    const page = { ...activeComicPage, panels: document.comic.panels, text: document.comic.text };
    const output = await renderComicPage(document, page, { activeCanvas: (layerId) => canvasRefs.current.get(layerId) });
    const plan = planRasterExport(document.name, format, document.background, "-comic");
    if (plan.flattenColor) {
      const flattened = flattenCanvas(output, plan.flattenColor);
      download(flattened.toDataURL(plan.mediaType, .94), plan.filename);
    } else download(output.toDataURL(plan.mediaType, .94), plan.filename);
  };
  const printComicPage = async () => {
    const page = { ...activeComicPage, panels: document.comic.panels, text: document.comic.text };
    const output = await renderComicPage(document, page, { activeCanvas: (layerId) => canvasRefs.current.get(layerId) });
    const dataUrl = output.toDataURL("image/png"), popup = window.open("", "_blank");
    if (!popup) { alert("Allow pop-ups to open the print-ready page."); return; }
    popup.document.write(`<title>${document.name} — print page</title><style>@page{margin:0}html,body{margin:0;background:#fff}img{display:block;width:100%;height:auto}</style><img src="${dataUrl}" onload="print()">`); popup.document.close();
  };
  const printComicBook = async () => {
    const pages = pagesWithActiveComicState(document);
    const images = await Promise.all(pages.map(async (page) => (await renderComicPage(document, page, { activeCanvas: (layerId) => canvasRefs.current.get(layerId) })).toDataURL("image/jpeg", .94)));
    const popup = window.open("", "_blank"); if (!popup) { alert("Allow pop-ups to open the print-ready book."); return; }
    popup.document.write(`<title>${document.name} — comic book</title><style>@page{margin:0}html,body{margin:0}.page{break-after:page}.page:last-child{break-after:auto}img{display:block;width:100%;height:auto}</style>${images.map((url, index) => `<div class="page"><img src="${url}" alt="Page ${index + 1}"></div>`).join("")}<script>Promise.all([...document.images].map(i=>i.complete?Promise.resolve():new Promise(r=>i.onload=r))).then(()=>print())</script>`); popup.document.close();
  };
  const exportComicPdf = async () => {
    if (exportJob.running) return;
    setIsPdfExporting(true);
    const startedAt = performance.now();
    setSaveState("Building PDF…");
    try {
      const result = await exportJob.run("comic-pdf", async (job) => {
        const pages = pagesWithActiveComicState(document);
        const pdfPlan = planComicPdfExport(document.comic.print.profile, document.comic.print.bleedMm, document.width);
        const rendered = [];
        for (const page of pages) {
          job.throwIfCancelled();
          const output = await renderComicPage(document, page, {
            activeCanvas: (layerId) => canvasRefs.current.get(layerId),
            bleedPixels: pdfPlan.bleedPixels,
            cropMarks: document.comic.print.cropMarks,
          });
          rendered.push({ jpegDataUrl: output.toDataURL("image/jpeg", .96), pixelWidth: output.width, pixelHeight: output.height });
        }
        job.throwIfCancelled();
        const pageWidth = pdfPlan.pageWidth, pageHeight = pdfPlan.pageHeight;
        let blob: Blob;
        let usedWorker = false;
        try {
          const worker = new Worker(new URL("./pdf.worker.ts", import.meta.url), { type: "module" });
          job.defer(() => worker.terminate());
          const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const timer = window.setTimeout(() => reject(new Error("PDF worker timed out")), 30000);
            job.defer(() => window.clearTimeout(timer));
            job.onCancel(() => { worker.terminate(); reject(new ExportJobCancelledError()); });
            worker.onmessage = (event: MessageEvent<{ buffer?: ArrayBuffer; error?: string }>) => { window.clearTimeout(timer); event.data.buffer ? resolve(event.data.buffer) : reject(new Error(event.data.error)); };
            worker.onerror = () => { window.clearTimeout(timer); reject(new Error("PDF worker unavailable")); };
            worker.postMessage({ pages: rendered, pageWidth, pageHeight, title: document.name });
          });
          job.throwIfCancelled();
          blob = new Blob([buffer], { type: "application/pdf" });
          usedWorker = true;
        } catch (error) {
          job.throwIfCancelled();
          if (isExportJobCancelled(error)) throw error;
          blob = encodeComicPdf(rendered, pageWidth, pageHeight, document.name);
        }
        return { blob, rendered, usedWorker };
      });
      const url = URL.createObjectURL(result.blob);
      download(url, `${safeExportStem(document.name)}.pdf`); window.setTimeout(() => URL.revokeObjectURL(url), 1000); setSaveState("PDF exported");
      const elapsed = Math.round(performance.now() - startedAt), megapixels = Math.round(result.rendered.reduce((sum, page) => sum + page.pixelWidth * page.pixelHeight, 0) / 1_000_000);
      setPerformanceNote(`${result.rendered.length} pages · ${megapixels} MP · ${elapsed} ms · ${result.usedWorker ? "worker" : "safe fallback"}`);
    } catch (error) {
      if (isExportJobCancelled(error)) {
        setSaveState("PDF export cancelled");
        setPerformanceNote("Export cancelled safely");
      } else {
        setSaveState("PDF export failed");
        setPerformanceNote(error instanceof Error ? error.message : "PDF export failed");
      }
    } finally {
      setIsPdfExporting(false);
    }
  };
  const cancelPdfExport = () => {
    exportJob.cancel();
    setSaveState("PDF export cancelled"); setPerformanceNote("Export cancelled safely");
  };
  const exportGif = async () => {
    if (exportJob.running) return;
    setSaveState("Building GIF…");
    try {
      const result = await exportJob.run("animation-gif", async (job) => {
        const gifPlan = planGifExport(document.width, document.height);
        const captured = captureDocument();
        const images = await renderAnimationImageData(captured, gifPlan.width, gifPlan.height);
        job.throwIfCancelled();
        return { blob: encodeGif(images, gifPlan.width, gifPlan.height, captured.animation.fps, captured.animation.loop, captured.animation.frames.map((frame) => frame.hold)), captured };
      });
      const url = URL.createObjectURL(result.blob);
      download(url, `${safeExportStem(result.captured.name)}.gif`); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSaveState("GIF exported");
    } catch (error) {
      setSaveState(isExportJobCancelled(error) ? "GIF export cancelled" : "GIF export failed");
    }
  };

  useEffect(() => {
    if (!isPlaying || document.animation.frames.length < 2) return;
    const active = document.animation.frames.find((frame) => frame.id === document.animation.activeFrameId);
    const timer = window.setTimeout(() => {
      const frames = document.animation.frames, index = frames.findIndex((frame) => frame.id === document.animation.activeFrameId);
      const next = index + 1;
      if (next >= frames.length && !document.animation.loop) { setIsPlaying(false); return; }
      void goToFrame(frames[next % frames.length].id);
    }, framePlaybackDelay(document.animation.fps, active?.hold));
    return () => window.clearTimeout(timer);
  }, [isPlaying, document.animation.activeFrameId, document.animation.fps, document.animation.loop, document.animation.frames.length]);

  return (
    <main className={styles.studio}>
      <header className={styles.titlebar}>
        <div><span className={styles.eyebrow}>Plumbmonkey presents</span><h1>Natural Media Lab <span>v0.8.1 · Phase 8B</span></h1></div>
        <div className={styles.actions}>
          {/* The studio's own room: the 3D atelier, whose easel leads back here.
              Styled apart from the nine tool buttons beside it — as one of ten
              identical controls it went unnoticed. */}
          <a className={styles.roomDoor} href="/artroom/viewer.html">Enter the room <span aria-hidden="true">→</span></a>
          <button onClick={() => setShowNew(true)}>New</button><button onClick={() => fileRef.current?.click()}>Open</button>
          <button className={styles.tourButton} onClick={() => setTourStep(0)}>Tour</button>
          <button className={styles.helpButton} onClick={() => setShowHelp(true)}>Help</button>
          <input ref={fileRef} type="file" accept=".nml,application/json" hidden onChange={loadProject} />
          <button onClick={saveProject}>Save .nml</button>
          <button onClick={() => restoreHistory(historyRef.current, redoRef.current, "undo")} disabled={!historyRef.current.length} aria-label="Undo">↶ <span>Undo</span></button>
          <button onClick={() => restoreHistory(redoRef.current, historyRef.current, "redo")} disabled={!redoRef.current.length} aria-label="Redo">↷ <span>Redo</span></button>
          <select className={styles.formatSelect} value={exportFormat} onChange={(event) => setExportFormat(event.target.value as typeof exportFormat)} aria-label="Export format"><option value="png">PNG</option><option value="jpeg">JPG</option><option value="webp">WEBP</option></select>
          <button className={styles.export} onClick={exportArtwork}>Export</button>
        </div>
      </header>
      <div className={styles.workspace}>
        <aside className={styles.toolrail} aria-label="Natural media tools">
          <p>Natural media</p>{BRUSHES.map((item) => <button key={item.id} className={toolFamily === "natural" && item.id === tool.id ? styles.activeTool : ""} onClick={() => { setToolFamily("natural"); setTool(item); setSelectionMode("paint"); setFlow(Math.round(item.flow * 100)); setWetness(Math.round(item.wetness * 100)); setGrain(Math.round(item.grain * 100)); setScatter(Math.round(item.scatter * 100)); }} aria-pressed={toolFamily === "natural" && item.id === tool.id}><span>{item.mark}</span>{item.name}</button>)}
          <p className={styles.proceduralLabel}>Procedural</p>{PROCEDURAL_BRUSHES.map((item) => <button key={item.id} className={toolFamily === "procedural" && item.id === proceduralTool.id ? styles.activeTool : ""} onClick={() => { setToolFamily("procedural"); setProceduralTool(item); setSelectionMode("paint"); }} aria-pressed={toolFamily === "procedural" && item.id === proceduralTool.id}><span>{item.mark}</span>{item.name}</button>)}
        </aside>
        <section className={styles.canvasArea}>
          <div className={styles.canvasMeta}><span>{document.name}{document.comic.enabled ? ` · ${activeComicPage.name}` : ""}</span><span>{document.width} × {document.height} · {document.background}</span></div>
          <div ref={stageRef} className={styles.canvasStage} onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onWheel={wheelZoom}>
            <div className={styles.canvasViewport} style={{ width: `${viewportGeometry.viewportWidth}px`, height: `${viewportGeometry.viewportHeight}px` }}>
            <div ref={paperRef} className={`${styles.paper} ${document.background === "transparent" ? styles.transparent : ""}`} style={{ width: `${viewportGeometry.paperWidth}px`, height: `${viewportGeometry.paperHeight}px`, transform: `translate(-50%, -50%) translate(${activeFrame.camera.x}px, ${activeFrame.camera.y}px) rotate(${viewRotation}deg)` }}>
              {showGrid && <div className={styles.grid} style={{ backgroundSize: `${gridSize / document.width * 100}% ${gridSize / document.height * 100}%` }} aria-hidden="true" />}
              {mirror && <div className={styles.mirrorLine} aria-hidden="true" />}
              {onionUrl && onionSkin && <img className={styles.onionSkin} src={onionUrl} alt="" aria-hidden="true" />}
              {showRig && document.rig.bones.map((bone) => { const world = boneWorld(document, activeFrame, bone.id); return <button key={bone.id} className={`${styles.bone} ${bone.id === selectedBoneId ? styles.selectedBone : ""}`} style={{ left: `${world.x / document.width * 100}%`, top: `${world.y / document.height * 100}%`, width: `${bone.length / document.width * 100}%`, transform: `rotate(${world.rotation}deg)` }} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelectedBoneId(bone.id); }} onPointerMove={(event) => dragBoneEndpoint(event, bone)} onClick={(event) => event.stopPropagation()} aria-label={`Select and drag ${bone.name}`}><span /></button>; })}
              {selection && <div className={`${styles.selection} ${selectionMode === "ellipse" ? styles.ellipse : ""}`} style={{ left: `${selection.x / document.width * 100}%`, top: `${selection.y / document.height * 100}%`, width: `${selection.width / document.width * 100}%`, height: `${selection.height / document.height * 100}%` }} aria-hidden="true" />}
              {document.layers.map((layer) => <canvas key={layer.id}
                ref={(node) => { if (node) canvasRefs.current.set(layer.id, node); else canvasRefs.current.delete(layer.id); }}
                width={document.width} height={document.height}
                className={layer.id === activeLayer.id ? styles.activeCanvas : ""}
                style={{ opacity: layer.visible ? layer.opacity * resolveLayerTransform(document.animation.frames, activeFrameIndex, layer.id).opacity / 100 : 0, mixBlendMode: layer.blendMode === "source-over" ? "normal" : layer.blendMode, transformOrigin: layerPivot(document, layer.id), transform: `translate(${resolveLayerTransform(document.animation.frames, activeFrameIndex, layer.id).x / document.width * 100}%, ${resolveLayerTransform(document.animation.frames, activeFrameIndex, layer.id).y / document.height * 100}%) rotate(${resolveLayerTransform(document.animation.frames, activeFrameIndex, layer.id).rotation + layerRigRotation(document, activeFrame, layer.id)}deg) scale(${resolveLayerTransform(document.animation.frames, activeFrameIndex, layer.id).scale / 100})` }}
                aria-label={`${layer.name} drawing canvas`}
                onPointerDown={layer.id === activeLayer.id ? beginStroke : undefined} onPointerMove={layer.id === activeLayer.id ? drawStroke : undefined}
                onPointerUp={layer.id === activeLayer.id ? endStroke : undefined} onPointerCancel={layer.id === activeLayer.id ? endStroke : undefined} />)}
              {document.comic.enabled && <div className={styles.comicOverlay}>
                <div className={styles.comicSafeArea} style={{ inset: `${document.comic.margin}%` }} aria-hidden="true" />
                {smartGuides.x !== undefined && <div className={styles.smartGuideX} style={{ left: `${smartGuides.x}%` }} aria-hidden="true" />}
                {smartGuides.y !== undefined && <div className={styles.smartGuideY} style={{ top: `${smartGuides.y}%` }} aria-hidden="true" />}
                {selectedPanel?.sourcePageId && <button className={styles.focalPoint} style={{ left: `${selectedPanel.x + selectedPanel.width / 2}%`, top: `${selectedPanel.y + selectedPanel.height / 2}%` }} onPointerDown={(event) => beginComicTransform(event, "panel", selectedPanel.id, "crop")} onPointerMove={moveComicTransform} onPointerUp={endComicTransform} onPointerCancel={endComicTransform} aria-label="Drag panel artwork focal point" title="Drag artwork focal point" />}
                {document.comic.panels.map((panel) => <button key={panel.id} className={`${styles.comicPanel} ${panel.sourcePageId ? styles.sourcedPanel : ""} ${selectedPanelId === panel.id ? styles.selectedComicItem : ""}`} style={{ left: `${panel.x}%`, top: `${panel.y}%`, width: `${panel.width}%`, height: `${panel.height}%`, borderWidth: `${Math.max(2, document.comic.gutter / 2)}px`, backgroundImage: panelPreviewUrl(panel) ? `url(${panelPreviewUrl(panel)})` : undefined, backgroundPosition: `${50 + (panel.cropX ?? 0)}% ${50 + (panel.cropY ?? 0)}%`, backgroundSize: `${panel.zoom ?? 100}%` }} onPointerDown={(event) => beginComicTransform(event, "panel", panel.id, "move")} onPointerMove={moveComicTransform} onPointerUp={endComicTransform} onPointerCancel={endComicTransform} aria-label="Move comic panel"><span className={styles.resizeHandle} onPointerDown={(event) => beginComicTransform(event, "panel", panel.id, "resize")} /></button>)}
                {document.comic.text.map((item) => <button key={item.id} className={`${styles.comicText} ${styles[item.type]} ${selectedTextId === item.id ? styles.selectedComicItem : ""}`} style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.width}%`, height: `${item.height}%`, "--tail-x": `${item.tailX}%`, "--tail-y": `${item.tailY}%`, "--comic-font-size": `${item.fontSize}px`, "--comic-align": item.align, "--comic-font": item.fontFamily === "serif" ? "Georgia,serif" : item.fontFamily === "hand" ? "'Comic Sans MS',cursive" : "Arial,sans-serif" } as CSSProperties} onPointerDown={(event) => beginComicTransform(event, "text", item.id, "move")} onPointerMove={moveComicTransform} onPointerUp={endComicTransform} onPointerCancel={endComicTransform} onDoubleClick={() => { const text = prompt("Edit text", item.text); if (text !== null) { setSelectedTextId(item.id); setDocument((current) => ({ ...current, comic: { ...current.comic, text: current.comic.text.map((entry) => entry.id === item.id ? { ...entry, text } : entry) } })); } }}>{item.text}<span className={styles.resizeHandle} onPointerDown={(event) => beginComicTransform(event, "text", item.id, "resize")} /></button>)}
              </div>}
            </div>
            </div>
          </div>
          <div className={styles.statusbar}><span>{toolFamily === "procedural" ? proceduralTool.name : tool.name} · {activeLayer.locked ? "Layer locked" : saveState}</span><div className={styles.viewControls}><button onClick={() => setView((current) => ({ ...current, rotation: current.rotation - 15 }))}>−15°</button><button onClick={resetView}>Reset view</button><button onClick={() => setView((current) => ({ ...current, rotation: current.rotation + 15 }))}>+15°</button><button onClick={() => setEditorZoom(zoom - 5)} aria-label="Zoom out">−</button><label>View zoom <input type="range" min="35" max="160" value={zoom} onChange={(e) => setEditorZoom(Number(e.target.value))} /> {zoom}%</label><button onClick={() => setEditorZoom(zoom + 5)} aria-label="Zoom in">+</button></div></div>
        </section>
        <aside className={styles.inspector}>
          <section><div className={styles.panelHeading}><p className={styles.panelLabel}>Colour</p><select className={styles.miniSelect} value={colorSpace} onChange={(event) => setColorSpace(event.target.value as "hsl" | "hsv")} aria-label="Color model"><option value="hsl">HSL</option><option value="hsv">HSV</option></select></div><div className={styles.colorRow}><input type="color" value={color} onChange={(e) => chooseColor(e.target.value)} aria-label="Brush colour" /><div><strong>{color.toUpperCase()}</strong><span>{Object.values(hexToRgb(color)).join(" · ")} RGB</span></div></div>{colorSpace === "hsl" ? <div className={styles.hslControls}>{(["h", "s", "l"] as const).map((channel) => { const hsl = rgbToHsl(hexToRgb(color)); return <label key={channel}>{channel.toUpperCase()}<input type="number" min="0" max={channel === "h" ? 359 : 100} value={hsl[channel]} onChange={(event) => chooseColor(hslToHex(channel === "h" ? Number(event.target.value) : hsl.h, channel === "s" ? Number(event.target.value) : hsl.s, channel === "l" ? Number(event.target.value) : hsl.l))} /></label>; })}</div> : <div className={styles.hslControls}>{(["h", "s", "v"] as const).map((channel) => { const hsv = rgbToHsv(hexToRgb(color)); return <label key={channel}>{channel.toUpperCase()}<input type="number" min="0" max={channel === "h" ? 359 : 100} value={hsv[channel]} onChange={(event) => chooseColor(hsvToHex(channel === "h" ? Number(event.target.value) : hsv.h, channel === "s" ? Number(event.target.value) : hsv.s, channel === "v" ? Number(event.target.value) : hsv.v))} /></label>; })}</div>}<div className={styles.swatches}>{SWATCHES.map((swatch) => <button key={swatch} style={{ background: swatch }} onClick={() => chooseColor(swatch)} aria-label={`Use ${swatch}`} />)}</div><p className={styles.subLabel}>Harmony</p><div className={styles.harmony}>{[-30, 30, 180].map((offset) => { const hsl = rgbToHsl(hexToRgb(color)), swatch = hslToHex((hsl.h + offset + 360) % 360, hsl.s, hsl.l); return <button key={offset} style={{ background: swatch }} onClick={() => chooseColor(swatch)} aria-label="Use harmony color" />; })}<button className={styles.gradientButton} onClick={fillGradient}>Fill gradient</button></div>{recentColors.length > 0 && <><p className={styles.subLabel}>Recent</p><div className={styles.swatches}>{recentColors.map((swatch) => <button key={swatch} style={{ background: swatch }} onClick={() => chooseColor(swatch)} aria-label={`Reuse ${swatch}`} />)}</div></>}</section>
          {toolFamily === "natural" ? <><section><p className={styles.panelLabel}>Brush character</p>{[["Size", size, setSize, 1, 160, "px"], ["Flow", flow, setFlow, 1, 100, "%"], ["Wetness", wetness, setWetness, 0, 100, "%"], ["Grain", grain, setGrain, 0, 100, "%"], ["Scatter", scatter, setScatter, 0, 100, "%"], ["Pressure", pressureAmount, setPressureAmount, 0, 100, "%"]].map(([label, value, setter, min, max, suffix]) => <div key={label as string}><label className={styles.sliderLabel}><span>{label as string}</span><output>{value as number}{suffix as string}</output></label><input className={styles.slider} type="range" min={min as number} max={max as number} value={value as number} onChange={(event) => (setter as (value: number) => void)(Number(event.target.value))} /></div>)}</section><section><p className={styles.panelLabel}>Natural effects</p>{([["Simulation", "strength"], ["Paper absorbency", "absorbency"], ["Pigment separation", "separation"]] as const).map(([label, key]) => <div key={key}><label className={styles.sliderLabel}><span>{label}</span><output>{document.effects[key]}%</output></label><input className={styles.slider} type="range" min="0" max="100" value={document.effects[key]} onChange={(event) => setDocument((current) => ({ ...current, effects: { ...current.effects, [key]: Number(event.target.value) } }))} /></div>)}<div className={styles.effectCard}><strong>{tool.id === "watercolor" ? "Wet pigment" : tool.id === "oil" || tool.id === "palette-knife" ? "Loaded paint" : tool.id === "ink" || tool.id === "calligraphy" ? "Ink pooling" : tool.id === "charcoal" || tool.id === "chalk" || tool.id === "pastel" ? "Dry particles" : tool.id === "smudge" ? "Finger blending" : "Material response"}</strong><p>{tool.id === "watercolor" ? "Pigment separates, diffuses after release, and settles according to paper absorbency." : tool.id === "oil" || tool.id === "palette-knife" ? "Paint height is recorded while bristles and the knife build or drag ridges." : tool.id === "ink" || tool.id === "calligraphy" ? "Wet marks feather softly and pool where the nib slows." : tool.id === "charcoal" || tool.id === "chalk" || tool.id === "pastel" ? "Loose pigment accumulates around a grainy central mark." : tool.id === "smudge" ? "Existing pigment is lifted, softened, and moved across the layer." : "The engine applies pressure, grain, flow, and surface response."}</p></div></section></> : <section><p className={styles.panelLabel}>Procedural emitter</p>{([["Density", "density"], ["Scale", "scale"], ["Wind", "wind"], ["Colour variation", "colorVariation"]] as const).map(([label, key]) => <div key={key}><label className={styles.sliderLabel}><span>{label}</span><output>{document.procedural[key]}{key === "scale" ? "px" : "%"}</output></label><input className={styles.slider} type="range" min={key === "scale" ? 3 : 0} max={key === "scale" ? 60 : 100} value={document.procedural[key]} onChange={(event) => setDocument((current) => ({ ...current, procedural: { ...current.procedural, [key]: Number(event.target.value) } }))} /></div>)}<div className={styles.effectCard}><strong>{proceduralTool.name}</strong><p>{proceduralTool.description} Marks are seeded, layer-aware, and saved as ordinary pixels.</p></div></section>}
          <section><div className={styles.panelHeading}><p className={styles.panelLabel}>Comic creator</p><button className={styles.keyButton} onClick={() => setDocument((current) => ({ ...current, comic: { ...current.comic, enabled: !current.comic.enabled } }))}>{document.comic.enabled ? "Hide" : "Show"}</button></div>
            <div className={styles.pageStrip}>{document.comic.pages.map((page, index) => <button key={page.id} className={page.id === document.comic.activePageId ? styles.activePage : ""} onClick={() => goToComicPage(page.id)}><span>{index + 1}</span><small>{page.name}</small></button>)}</div>
            <div className={styles.pageActions}><button onClick={() => moveComicPage(-1)}>←</button><button onClick={() => moveComicPage(1)}>→</button><button onClick={() => addComicPage(false)}>+ Page</button><button onClick={() => addComicPage(true)}>Duplicate</button><button onClick={renameComicPage}>Rename</button><button onClick={deleteComicPage} disabled={document.comic.pages.length === 1}>Delete</button></div>
            <p className={styles.hint}>Each page keeps its own painted layers. Arrow keys nudge a selected item; Shift moves 5%; Ctrl/Cmd+D duplicates it.</p>
            <div className={styles.comicTemplates}><button onClick={() => applyComicTemplate("strip")}>3 strip</button><button onClick={() => applyComicTemplate("grid")}>4 grid</button><button onClick={() => applyComicTemplate("feature")}>Feature</button></div>
            <div className={styles.selectionTools}><strong>{selectedComicIds.length} selected</strong><button onClick={() => alignComicSelection("left")}>Left</button><button onClick={() => alignComicSelection("center")}>Center</button><button onClick={() => alignComicSelection("right")}>Right</button><button onClick={() => alignComicSelection("top")}>Top</button><button onClick={() => alignComicSelection("middle")}>Middle</button><button onClick={() => alignComicSelection("bottom")}>Bottom</button><button onClick={() => distributeComicSelection("x")} disabled={selectedComicIds.length < 3}>Space X</button><button onClick={() => distributeComicSelection("y")} disabled={selectedComicIds.length < 3}>Space Y</button></div>
            <div className={styles.masterTools}><button onClick={savePageMaster}>Save master</button><select defaultValue="" onChange={(event) => { applyPageMaster(event.target.value); event.target.value = ""; }}><option value="">Apply page master…</option>{document.comic.pageMasters.map((master) => <option key={master.id} value={master.id}>{master.name}</option>)}</select></div>
            <div className={styles.masterTools}><button onClick={saveLetteringStyle} disabled={!selectedText}>Save lettering</button><select defaultValue="" disabled={!selectedText} onChange={(event) => { applyLetteringStyle(event.target.value); event.target.value = ""; }}><option value="">Apply lettering…</option>{document.comic.letteringStyles.map((style) => <option key={style.id} value={style.id}>{style.name}</option>)}</select></div>
            <div className={styles.rigActions}><button onClick={addComicPanel}>+ Panel</button><button onClick={() => addComicText("speech")}>Speech</button><button onClick={() => addComicText("thought")}>Thought</button><button onClick={() => addComicText("caption")}>Caption</button></div>
            <label className={styles.sliderLabel}><span>Safe margin</span><output>{document.comic.margin}%</output></label><input className={styles.slider} type="range" min="2" max="12" value={document.comic.margin} onChange={(event) => setDocument((current) => ({ ...current, comic: { ...current.comic, margin: Number(event.target.value) } }))} />
            <label className={styles.sliderLabel}><span>Gutter weight</span><output>{document.comic.gutter}</output></label><input className={styles.slider} type="range" min="1" max="12" value={document.comic.gutter} onChange={(event) => setDocument((current) => ({ ...current, comic: { ...current.comic, gutter: Number(event.target.value) } }))} />
            {selectedPanel && <div className={styles.comicEditor}><strong>Selected panel</strong><label className={styles.fullField}>Artwork source<select value={selectedPanel.sourcePageId ?? ""} onChange={(event) => updateComicPanel({ sourcePageId: event.target.value })}><option value="">Current page underneath</option>{document.comic.pages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}</select></label>{([["X", "x"], ["Y", "y"], ["Width", "width"], ["Height", "height"]] as const).map(([label, key]) => <label key={key}>{label}<input type="number" min="0" max="100" value={Math.round(selectedPanel[key])} onChange={(event) => updateComicPanel({ [key]: Math.max(1, Math.min(100, Number(event.target.value))) })} /></label>)}{selectedPanel.sourcePageId && <><label>Crop X<input type="number" min="-100" max="100" value={selectedPanel.cropX ?? 0} onChange={(event) => updateComicPanel({ cropX: Number(event.target.value) })} /></label><label>Crop Y<input type="number" min="-100" max="100" value={selectedPanel.cropY ?? 0} onChange={(event) => updateComicPanel({ cropY: Number(event.target.value) })} /></label><label>Zoom<input type="number" min="25" max="400" value={selectedPanel.zoom ?? 100} onChange={(event) => updateComicPanel({ zoom: Number(event.target.value) })} /></label></>}<div className={styles.alignGrid}><button onClick={() => updateComicPanel({ x: document.comic.margin })}>Left</button><button onClick={() => updateComicPanel({ x: 50 - selectedPanel.width / 2 })}>Center</button><button onClick={() => updateComicPanel({ x: 100 - document.comic.margin - selectedPanel.width })}>Right</button><button onClick={() => updateComicPanel({ y: document.comic.margin })}>Top</button><button onClick={() => updateComicPanel({ y: 50 - selectedPanel.height / 2 })}>Middle</button><button onClick={() => updateComicPanel({ y: 100 - document.comic.margin - selectedPanel.height })}>Bottom</button></div><button onClick={deleteComicPanel}>Delete panel</button></div>}
            {selectedText && <div className={styles.comicEditor}><strong>Selected {selectedText.type}</strong><textarea value={selectedText.text} onChange={(event) => updateComicText({ text: event.target.value })} />{([["X", "x"], ["Y", "y"], ["Width", "width"], ["Height", "height"]] as const).map(([label, key]) => <label key={key}>{label}<input type="number" min="0" max="100" value={Math.round(selectedText[key])} onChange={(event) => updateComicText({ [key]: Math.max(1, Math.min(100, Number(event.target.value))) })} /></label>)}<label>Typeface<select value={selectedText.fontFamily} onChange={(event) => updateComicText({ fontFamily: event.target.value as ComicText["fontFamily"] })}><option value="sans">Bold sans</option><option value="serif">Editorial serif</option><option value="hand">Hand lettered</option></select></label><label>Size<input type="number" min="8" max="48" value={selectedText.fontSize} onChange={(event) => updateComicText({ fontSize: Number(event.target.value) })} /></label><label>Align<select value={selectedText.align} onChange={(event) => updateComicText({ align: event.target.value as ComicText["align"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label>Tail X<input type="number" min="-50" max="150" value={selectedText.tailX} onChange={(event) => updateComicText({ tailX: Number(event.target.value) })} /></label><label>Tail Y<input type="number" min="-50" max="175" value={selectedText.tailY} onChange={(event) => updateComicText({ tailY: Number(event.target.value) })} /></label><button onClick={deleteComicText}>Delete text</button></div>}
            <div className={styles.printProfile}><label>Print profile<select value={document.comic.print.profile} onChange={(event) => setDocument((current) => ({ ...current, comic: { ...current.comic, print: { ...current.comic.print, profile: event.target.value as "a4" | "letter" } } }))}><option value="a4">A4</option><option value="letter">US Letter</option></select></label><label>Bleed mm<input type="number" min="0" max="12" value={document.comic.print.bleedMm} onChange={(event) => setDocument((current) => ({ ...current, comic: { ...current.comic, print: { ...current.comic.print, bleedMm: Number(event.target.value) } } }))} /></label><label>DPI<input type="number" min="72" max="600" value={document.comic.print.dpi} onChange={(event) => setDocument((current) => ({ ...current, comic: { ...current.comic, print: { ...current.comic.print, dpi: Number(event.target.value) } } }))} /></label><label className={styles.cropCheck}><input type="checkbox" checked={document.comic.print.cropMarks} onChange={(event) => setDocument((current) => ({ ...current, comic: { ...current.comic, print: { ...current.comic.print, cropMarks: event.target.checked } } }))} /> Crop marks</label></div>
            <div className={styles.comicExports}><button onClick={() => exportComicPage("png")}>Page PNG</button><button onClick={() => exportComicPage("jpeg")}>Page JPG</button>{isPdfExporting ? <button onClick={cancelPdfExport}>Cancel PDF</button> : <button onClick={() => void exportComicPdf()}>Book PDF</button>}</div>
            <div className={styles.performanceCard} role="status" aria-live="polite"><strong>Publishing diagnostics</strong><span>{performanceNote || `${document.comic.pages.length} pages · ${Math.round(document.width * document.height * document.comic.pages.length / 1_000_000)} MP estimated`}</span>{document.width * document.height * document.comic.pages.length > 80_000_000 && <em>Large book: export may use substantial memory.</em>}</div>
          </section>
          <section><p className={styles.panelLabel}>Canvas guides</p><div className={styles.toggleRow}><button className={mirror ? styles.on : ""} onClick={() => setMirror((value) => !value)}>Mirror</button><button className={showGrid ? styles.on : ""} onClick={() => setShowGrid((value) => !value)}>Grid</button><button className={snap ? styles.on : ""} onClick={() => setSnap((value) => !value)}>Snap</button></div><label className={styles.sliderLabel}><span>Grid size</span><output>{gridSize}px</output></label><input className={styles.slider} type="range" min="20" max="300" step="10" value={gridSize} onChange={(event) => setGridSize(Number(event.target.value))} /><p className={styles.hint}>Hold Space and drag to pan. Ctrl + wheel zooms.</p></section>
          <section><p className={styles.panelLabel}>Selection</p><div className={styles.toggleRow}><button className={selectionMode === "paint" ? styles.on : ""} onClick={() => { setSelectionMode("paint"); setSelection(null); }}>Paint</button><button className={selectionMode === "rectangle" ? styles.on : ""} onClick={() => setSelectionMode("rectangle")}>Rectangle</button><button className={selectionMode === "ellipse" ? styles.on : ""} onClick={() => setSelectionMode("ellipse")}>Ellipse</button></div><button className={styles.cropButton} onClick={cropToSelection} disabled={!selection}>Crop to selection</button></section>
          <section><div className={styles.panelHeading}><p className={styles.panelLabel}>Motion keyframe</p><button className={styles.keyButton} onClick={() => updateTransform({})}>◆ Key</button></div>{([["X", "x", -document.width, document.width], ["Y", "y", -document.height, document.height], ["Scale", "scale", 10, 300], ["Rotation", "rotation", -180, 180], ["Opacity", "opacity", 0, 100]] as const).map(([label, key, min, max]) => <div key={key}><label className={styles.sliderLabel}><span>{label}</span><output>{Math.round(activeTransform[key])}{key === "scale" || key === "opacity" ? "%" : key === "rotation" ? "°" : "px"}</output></label><input className={styles.slider} type="range" min={min} max={max} value={activeTransform[key]} onChange={(event) => updateTransform({ [key]: Number(event.target.value) })} /></div>)}<select className={styles.select} value={activeTransform.easing} onChange={(event) => updateTransform({ easing: event.target.value as typeof activeTransform.easing })}><option value="linear">Linear</option><option value="hold">Hold</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="ease-in-out">Ease in/out</option></select></section>
          <section><div className={styles.panelHeading}><p className={styles.panelLabel}>Puppet rig</p><button className={styles.keyButton} onClick={() => setShowRig((value) => !value)}>{showRig ? "Hide" : "Show"}</button></div><div className={styles.rigActions}><button onClick={addBone}>+ Bone</button><button onClick={bindLayer} disabled={!selectedBone}>Bind layer</button><button onClick={solveIk} disabled={!selectedBone?.parentId}>IK target</button><button onClick={deleteBone} disabled={!selectedBone}>Delete</button></div>{selectedBone ? <><label className={styles.sliderLabel}><span>Selected</span><output>{selectedBone.name}</output></label><label className={styles.sliderLabel}><span>Parent</span><select className={styles.inlineSelect} value={selectedBone.parentId ?? ""} onChange={(event) => updateBone({ parentId: event.target.value || null })}><option value="">None</option>{document.rig.bones.filter((bone) => bone.id !== selectedBone.id).map((bone) => <option key={bone.id} value={bone.id}>{bone.name}</option>)}</select></label>{([["X", "x", 0, document.width], ["Y", "y", 0, document.height], ["Length", "length", 20, document.width], ["Rest", "restRotation", -180, 180]] as const).map(([label, key, min, max]) => <div key={key}><label className={styles.sliderLabel}><span>{label}</span><output>{Math.round(selectedBone[key])}</output></label><input className={styles.slider} type="range" min={min} max={max} value={selectedBone[key]} onChange={(event) => updateBone({ [key]: Number(event.target.value) })} /></div>)}<label className={styles.sliderLabel}><span>Pose rotation</span><output>{Math.round(activeFrame.bonePose[selectedBone.id] ?? 0)}°</output></label><input className={styles.slider} type="range" min="-180" max="180" value={activeFrame.bonePose[selectedBone.id] ?? 0} onChange={(event) => updateBonePose(Number(event.target.value))} /></> : <p className={styles.hint}>Add a root bone, then add child bones to build a chain. Select a bone on the canvas to pose it.</p>}</section>
          <section><div className={styles.panelHeading}><p className={styles.panelLabel}>Performance</p><button className={styles.keyButton} onClick={savePosePreset}>Save pose</button></div>{document.rig.posePresets.length > 0 && <select className={styles.select} defaultValue="" onChange={(event) => { applyPosePreset(event.target.value); event.target.value = ""; }}><option value="">Apply pose…</option>{document.rig.posePresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select>}<div className={styles.rigActions}><button onClick={captureSprite}>Capture sprite</button><select className={styles.inlineSelect} value={activeFrame.spriteExposure[activeLayer.id] ?? -1} onChange={(event) => setSpriteExposure(Number(event.target.value))}><option value="-1">Frame art</option>{(document.rig.sprites[activeLayer.id] ?? []).map((sprite, index) => <option key={sprite.name} value={index}>{sprite.name}</option>)}</select></div><label className={styles.sliderLabel}><span>Mouth cue</span><select className={styles.inlineSelect} value={activeFrame.mouthCue} onChange={(event) => setDocument((current) => ({ ...current, animation: { ...current.animation, frames: current.animation.frames.map((frame) => frame.id === current.animation.activeFrameId ? { ...frame, mouthCue: event.target.value as AnimationFrame["mouthCue"] } : frame) } }))}>{["rest", "A", "E", "O", "M"].map((cue) => <option key={cue}>{cue}</option>)}</select></label></section>
          <section><p className={styles.panelLabel}>Camera keyframe</p>{([["Pan X", "x", -document.width, document.width], ["Pan Y", "y", -document.height, document.height], ["Zoom", "zoom", 25, 300], ["Rotation", "rotation", -180, 180], ["Shake", "shake", 0, 50]] as const).map(([label, key, min, max]) => <div key={key}><label className={styles.sliderLabel}><span>{label}</span><output>{Math.round(activeFrame.camera[key])}</output></label><input className={styles.slider} type="range" min={min} max={max} value={activeFrame.camera[key]} onChange={(event) => updateCamera({ [key]: Number(event.target.value) })} /></div>)}</section>
          <section>
            <div className={styles.panelHeading}><p className={styles.panelLabel}>Layers</p><div><button onClick={() => moveLayer(1)} aria-label="Move layer up">↑</button><button onClick={() => moveLayer(-1)} aria-label="Move layer down">↓</button><button onClick={deleteLayer} disabled={document.layers.length === 1} aria-label="Delete layer">−</button><button onClick={addLayer} aria-label="Add layer">+</button></div></div>
            <div className={styles.layerList}>{[...document.layers].reverse().map((layer) => <button key={layer.id} className={`${styles.layer} ${layer.id === activeLayer.id ? styles.activeLayer : ""}`} onClick={() => setDocument((current) => ({ ...current, activeLayerId: layer.id }))}><span onClick={(event) => { event.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }}>{layer.visible ? "●" : "○"}</span><div><strong>{layer.name}</strong><small>{layer.blendMode === "source-over" ? "Normal" : layer.blendMode} · {Math.round(layer.opacity * 100)}%</small></div><span onClick={(event) => { event.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }); }}>{layer.locked ? "◆" : "◇"}</span></button>)}</div>
            <label className={styles.sliderLabel}><span>Layer opacity</span><output>{Math.round(activeLayer.opacity * 100)}%</output></label><input className={styles.slider} type="range" min="0" max="100" value={activeLayer.opacity * 100} onChange={(e) => updateLayer(activeLayer.id, { opacity: Number(e.target.value) / 100 })} />
            <select className={styles.select} value={activeLayer.blendMode} onChange={(e) => updateLayer(activeLayer.id, { blendMode: e.target.value as BlendMode })} aria-label="Layer blend mode"><option value="source-over">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option></select>
            <div className={styles.operationGrid}><button onClick={duplicateLayer}>Duplicate</button><button onClick={mergeDown} disabled={document.layers.findIndex((layer) => layer.id === activeLayer.id) === 0}>Merge down</button><button onClick={() => flipLayer(false)}>Flip H</button><button onClick={() => flipLayer(true)}>Flip V</button><button onClick={resizeProject}>Resize</button></div>
          </section>
        </aside>
      </div>
      <section className={styles.timeline} aria-label="Animation timeline">
        <div className={styles.playback}>
          <button onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? "Pause" : "Play"}</button>
          <label>FPS <input type="number" min="1" max="24" value={document.animation.fps} onChange={(event) => setDocument((current) => ({ ...current, animation: { ...current.animation, fps: Number(event.target.value) } }))} /></label>
          <label><input type="checkbox" checked={document.animation.loop} onChange={(event) => setDocument((current) => ({ ...current, animation: { ...current.animation, loop: event.target.checked } }))} /> Loop</label>
          <label><input type="checkbox" checked={onionSkin} onChange={(event) => { setOnionSkin(event.target.checked); if (!event.target.checked) setOnionUrl(""); }} /> Onion skin</label>
          <label>Hold <input type="number" min="1" max="24" value={activeFrame.hold} onChange={(event) => setDocument((current) => ({ ...current, animation: { ...current.animation, frames: current.animation.frames.map((frame) => frame.id === current.animation.activeFrameId ? { ...frame, hold: Number(event.target.value) } : frame) } }))} /></label>
        </div>
        <div className={styles.frames}>
          {document.animation.frames.map((frame, index) => <button key={frame.id} className={frame.id === document.animation.activeFrameId ? styles.activeFrame : ""} onClick={() => void goToFrame(frame.id)}><span>{index + 1}</span><small>{frame.name}</small></button>)}
        </div>
        <div className={styles.frameActions}><button onClick={() => moveFrame(-1)}>←</button><button onClick={() => moveFrame(1)}>→</button><button onClick={() => addFrame(false)}>+ Blank</button><button onClick={() => addFrame(true)}>Duplicate</button><button onClick={deleteFrame} disabled={document.animation.frames.length === 1}>Delete</button><button className={styles.gifButton} onClick={() => void exportGif()}>Export GIF</button></div>
      </section>
      {showNew && <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setShowNew(false)}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="new-title" onMouseDown={(event) => event.stopPropagation()}><span className={styles.eyebrow}>Fresh paper</span><h2 id="new-title">Create a new study</h2><div className={styles.presets}>{PRESETS.map(([label, width, height]) => <button key={label} onClick={() => setNewSize({ ...newSize, width, height })}>{label}<small>{width} × {height}</small></button>)}</div><div className={styles.dimensions}><label>Width <input type="number" min="64" max="4096" value={newSize.width} onChange={(e) => setNewSize({ ...newSize, width: Number(e.target.value) })} /></label><label>Height <input type="number" min="64" max="4096" value={newSize.height} onChange={(e) => setNewSize({ ...newSize, height: Number(e.target.value) })} /></label></div><label className={styles.backgroundChoice}>Background <select value={newSize.background} onChange={(e) => setNewSize({ ...newSize, background: e.target.value as "paper" | "transparent" })}><option value="paper">Warm paper</option><option value="transparent">Transparent</option></select></label><div className={styles.modalActions}><button onClick={() => setShowNew(false)}>Cancel</button><button onClick={createNew}>Create canvas</button></div></section></div>}
      {tourStep >= 0 && <div className={styles.tourBackdrop} role="dialog" aria-modal="true" aria-labelledby="tour-title"><section className={styles.tourCard}><span className={styles.eyebrow}>Quick studio tour · {tourStep + 1}/{TOUR.length}</span><h2 id="tour-title">{TOUR[tourStep][0]}</h2><p>{TOUR[tourStep][1]}</p><div className={styles.tourDots}>{TOUR.map((_, index) => <span key={index} className={index === tourStep ? styles.currentDot : ""} />)}</div><div className={styles.modalActions}><button onClick={() => { setTourStep(-1); try { localStorage.setItem("nml-tour-complete", "1"); } catch { /* optional onboarding */ } }}>Skip</button>{tourStep > 0 && <button onClick={() => setTourStep((step) => step - 1)}>Back</button>}<button autoFocus onClick={() => { if (tourStep < TOUR.length - 1) setTourStep((step) => step + 1); else { setTourStep(-1); try { localStorage.setItem("nml-tour-complete", "1"); } catch { /* optional onboarding */ } } }}>{tourStep === TOUR.length - 1 ? "Start creating" : "Next"}</button></div></section></div>}
      {showHelp && <div className={styles.tourBackdrop} role="dialog" aria-modal="true" aria-labelledby="help-title"><section className={styles.helpCard}><span className={styles.eyebrow}>Natural Media Lab v0.8.0</span><h2 id="help-title">Studio help & examples</h2><div className={styles.helpGrid}><article><strong>Paint & navigate</strong><p>Choose a brush, draw on the active layer, hold Space to pan, and use Ctrl/Cmd + wheel to zoom.</p></article><article><strong>Animate</strong><p>Create or duplicate frames, enable onion skinning, set holds and FPS, then export a looping GIF.</p></article><article><strong>Build comics</strong><p>Show Comic creator, choose a page template, add lettering, and use Shift-click for grouped layouts.</p></article><article><strong>Publish safely</strong><p>Save the editable .nml file first. PNG, JPG, GIF, and PDF exports are flattened delivery copies.</p></article></div><h3>Starter projects</h3><div className={styles.exampleLinks}><a href="/examples/natural-media-sketchbook.nml" download>Natural media sketchbook <span>Blank layered study</span></a><a href="/examples/three-panel-comic.nml" download>Three-panel comic <span>A4 page with starter lettering</span></a></div><p className={styles.shortcutLine}><strong>Shortcuts:</strong> Space pan · Ctrl/Cmd+wheel zoom · arrows nudge · Shift+arrows move 5% · Ctrl/Cmd+D duplicate</p><div className={styles.modalActions}><button autoFocus onClick={() => setShowHelp(false)}>Close</button></div></section></div>}
    </main>
  );
}
