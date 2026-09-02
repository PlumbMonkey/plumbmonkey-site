export const NATURAL_MEDIA_FORMAT = "natural-media-lab" as const;
export const NATURAL_MEDIA_VERSION = 1 as const;

export type BlendMode = "source-over" | "multiply" | "screen" | "overlay";

export type PaintLayer = {
  id: string;
  name: string;
  dataUrl: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  simulation: {
    wetMapUrl: string;
    heightMapUrl: string;
  };
};

export type AnimationFrame = {
  id: string;
  name: string;
  layerData: Record<string, string>;
  hold: number;
  transforms: Record<string, {
    x: number;
    y: number;
    scale: number;
    rotation: number;
    opacity: number;
    easing: "linear" | "hold" | "ease-in" | "ease-out" | "ease-in-out";
  }>;
  bonePose: Record<string, number>;
  spriteExposure: Record<string, number>;
  mouthCue: "rest" | "A" | "E" | "O" | "M";
  camera: { x: number; y: number; zoom: number; rotation: number; shake: number };
};

export type RigBone = {
  id: string;
  name: string;
  parentId: string | null;
  x: number;
  y: number;
  length: number;
  restRotation: number;
};

export type ComicPanel = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourcePageId?: string;
  cropX?: number;
  cropY?: number;
  zoom?: number;
};

export type ComicText = ComicPanel & {
  type: "speech" | "thought" | "caption";
  text: string;
  tailX: number;
  tailY: number;
  fontFamily: "sans" | "serif" | "hand";
  fontSize: number;
  align: "left" | "center" | "right";
};

export type ComicPage = {
  id: string;
  name: string;
  panels: ComicPanel[];
  text: ComicText[];
  layerData: Record<string, string>;
};

export type NaturalMediaDocument = {
  format: "natural-media-lab";
  version: 1;
  name: string;
  width: number;
  height: number;
  background: "transparent" | "paper";
  layers: PaintLayer[];
  activeLayerId: string;
  effects: { strength: number; absorbency: number; separation: number };
  procedural: { density: number; scale: number; wind: number; colorVariation: number };
  animation: {
    fps: number;
    loop: boolean;
    activeFrameId: string;
    frames: AnimationFrame[];
  };
  rig: {
    bones: RigBone[];
    layerBindings: Record<string, { boneId: string; pivotX: number; pivotY: number }>;
    posePresets: Array<{ id: string; name: string; pose: Record<string, number> }>;
    sprites: Record<string, Array<{ name: string; dataUrl: string }>>;
  };
  comic: {
    enabled: boolean;
    margin: number;
    gutter: number;
    activePageId: string;
    pages: ComicPage[];
    panels: ComicPanel[];
    text: ComicText[];
    letteringStyles: Array<{ id: string; name: string; fontFamily: ComicText["fontFamily"]; fontSize: number; align: ComicText["align"] }>;
    pageMasters: Array<{ id: string; name: string; panels: ComicPanel[] }>;
    print: { profile: "a4" | "letter"; dpi: number; bleedMm: number; cropMarks: boolean };
  };
  updatedAt: string;
};

export const createLayer = (name: string): PaintLayer => ({
  id: crypto.randomUUID(), name, dataUrl: "", visible: true, locked: false,
  opacity: 1, blendMode: "source-over",
  simulation: { wetMapUrl: "", heightMapUrl: "" },
});

export const createDocument = (
  width = 1600, height = 1000,
  background: NaturalMediaDocument["background"] = "paper",
): NaturalMediaDocument => {
  const layer = createLayer("Paint layer 1");
  const frameId = crypto.randomUUID();
  const pageId = crypto.randomUUID();
  return {
    format: "natural-media-lab", version: 1, name: "Untitled study",
    width, height, background, layers: [layer], activeLayerId: layer.id,
    effects: { strength: 70, absorbency: 55, separation: 30 },
    procedural: { density: 55, scale: 18, wind: 10, colorVariation: 20 },
    animation: { fps: 8, loop: true, activeFrameId: frameId, frames: [{ id: frameId, name: "Frame 1", layerData: { [layer.id]: "" }, hold: 1, transforms: {}, bonePose: {}, spriteExposure: {}, mouthCue: "rest", camera: { x: 0, y: 0, zoom: 100, rotation: 0, shake: 0 } }] },
    rig: { bones: [], layerBindings: {}, posePresets: [], sprites: {} },
    comic: { enabled: false, margin: 5, gutter: 2, activePageId: pageId, pages: [{ id: pageId, name: "Page 1", panels: [], text: [], layerData: { [layer.id]: "" } }], panels: [], text: [], letteringStyles: [], pageMasters: [], print: { profile: "a4", dpi: 300, bleedMm: 3, cropMarks: true } },
    updatedAt: new Date().toISOString(),
  };
};

export type ProjectParseOptions = {
  createId?: () => string;
};

export const parseProject = (value: unknown, options: ProjectParseOptions = {}): NaturalMediaDocument => {
  const project = value as Partial<NaturalMediaDocument>;
  if (
    project?.format !== "natural-media-lab" || project.version !== 1 ||
    !Number.isFinite(project.width) || !Number.isFinite(project.height) ||
    !Array.isArray(project.layers) || project.layers.length === 0
  ) throw new Error("This is not a supported Natural Media Lab project.");
  const createId = options.createId ?? (() => crypto.randomUUID());
  const initialFrameId = createId();
  const frames = project.animation?.frames?.length ? project.animation.frames : [{
    id: initialFrameId,
    name: "Frame 1",
    layerData: Object.fromEntries(project.layers.map((layer) => [layer.id, layer.dataUrl || ""])),
    hold: 1,
    transforms: {},
    bonePose: {},
    spriteExposure: {},
    mouthCue: "rest" as const,
    camera: { x: 0, y: 0, zoom: 100, rotation: 0, shake: 0 },
  }];
  const migratedFrames = frames.map((frame) => ({ ...frame, hold: frame.hold ?? 1, transforms: frame.transforms ?? {}, bonePose: frame.bonePose ?? {}, spriteExposure: frame.spriteExposure ?? {}, mouthCue: frame.mouthCue ?? "rest", camera: frame.camera ?? { x: 0, y: 0, zoom: 100, rotation: 0, shake: 0 } }));
  const migrateText = (items: ComicText[] = []) => items.map((item) => ({
    ...item,
    tailX: item.tailX ?? 50,
    tailY: item.tailY ?? 125,
    fontFamily: item.fontFamily ?? "sans",
    fontSize: item.fontSize ?? 18,
    align: item.align ?? "center",
  }));
  const migratePanels = (items: ComicPanel[] = []) => items.map((item) => ({ ...item, sourcePageId: item.sourcePageId ?? "", cropX: item.cropX ?? 0, cropY: item.cropY ?? 0, zoom: item.zoom ?? 100 }));
  const fallbackPageId = createId();
  const migratedPages = project.comic?.pages?.length ? project.comic.pages.map((page, index) => ({ ...page, panels: migratePanels(page.panels), text: migrateText(page.text), layerData: page.layerData ?? (index === 0 ? Object.fromEntries(project.layers!.map((layer) => [layer.id, layer.dataUrl || ""])) : {}) })) : [{
    id: fallbackPageId,
    name: "Page 1",
    panels: migratePanels(project.comic?.panels),
    text: migrateText(project.comic?.text),
    layerData: Object.fromEntries(project.layers.map((layer) => [layer.id, layer.dataUrl || ""])),
  }];
  const activePageId = project.comic?.activePageId && migratedPages.some((page) => page.id === project.comic?.activePageId) ? project.comic.activePageId : migratedPages[0].id;
  const activePage = migratedPages.find((page) => page.id === activePageId) ?? migratedPages[0];
  return {
    ...project,
    effects: {
      strength: project.effects?.strength ?? 70,
      absorbency: project.effects?.absorbency ?? 55,
      separation: project.effects?.separation ?? 30,
    },
    procedural: {
      density: project.procedural?.density ?? 55,
      scale: project.procedural?.scale ?? 18,
      wind: project.procedural?.wind ?? 10,
      colorVariation: project.procedural?.colorVariation ?? 20,
    },
    animation: {
      fps: project.animation?.fps ?? 8,
      loop: project.animation?.loop ?? true,
      activeFrameId: project.animation?.activeFrameId && migratedFrames.some((frame) => frame.id === project.animation?.activeFrameId) ? project.animation.activeFrameId : migratedFrames[0].id,
      frames: migratedFrames,
    },
    rig: {
      bones: project.rig?.bones ?? [],
      layerBindings: project.rig?.layerBindings ?? {},
      posePresets: project.rig?.posePresets ?? [],
      sprites: project.rig?.sprites ?? {},
    },
    comic: {
      enabled: project.comic?.enabled ?? false,
      margin: project.comic?.margin ?? 5,
      gutter: project.comic?.gutter ?? 2,
      activePageId,
      pages: migratedPages,
      panels: activePage.panels,
      text: activePage.text,
      letteringStyles: project.comic?.letteringStyles ?? [],
      pageMasters: (project.comic?.pageMasters ?? []).map((master) => ({ ...master, panels: migratePanels(master.panels) })),
      print: {
        profile: project.comic?.print?.profile ?? "a4",
        dpi: project.comic?.print?.dpi ?? 300,
        bleedMm: project.comic?.print?.bleedMm ?? 3,
        cropMarks: project.comic?.print?.cropMarks ?? true,
      },
    },
    layers: project.layers.map((layer) => ({
      ...layer,
      simulation: layer.simulation ?? { wetMapUrl: "", heightMapUrl: "" },
    })),
  } as NaturalMediaDocument;
};
