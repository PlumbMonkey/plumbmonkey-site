import { parseTileSetDescriptor } from "./binaryStorage";
import type { BinaryDocumentReference, TileSetDescriptorV1 } from "./binaryStorage";
import type { NaturalMediaDocument } from "./documentModel";

export const ART_ROOM_WORKING_DOCUMENT_FORMAT = "art-room-working-document" as const;
export const ART_ROOM_WORKING_DOCUMENT_VERSION = 1 as const;

const cloneDescriptor = (descriptor: TileSetDescriptorV1 | undefined) => descriptor ? {
  ...descriptor,
  tiles: descriptor.tiles.map((tile) => ({ ...tile })),
} : null;

export type WorkingSnapshotReferences = {
  animationFrames?: Record<string, Record<string, BinaryDocumentReference>>;
  comicPages?: Record<string, Record<string, BinaryDocumentReference>>;
  sprites?: Record<string, Array<BinaryDocumentReference | undefined>>;
};

const cloneReferences = (references: Record<string, BinaryDocumentReference> | undefined) => Object.fromEntries(
  Object.entries(references ?? {}).map(([layerId, reference]) => [layerId, { ...reference }]),
);

export const projectWorkingDocument = (
  source: NaturalMediaDocument,
  rasterLayers: Record<string, TileSetDescriptorV1 | undefined>,
  snapshotReferences: WorkingSnapshotReferences = {},
) => ({
  format: ART_ROOM_WORKING_DOCUMENT_FORMAT,
  version: ART_ROOM_WORKING_DOCUMENT_VERSION,
  sourceFormat: source.format,
  sourceVersion: source.version,
  name: source.name,
  width: source.width,
  height: source.height,
  background: source.background,
  activeLayerId: source.activeLayerId,
  effects: { ...source.effects },
  procedural: { ...source.procedural },
  layers: source.layers.map(({ dataUrl: _dataUrl, simulation: _simulation, ...layer }) => ({
    ...layer,
    raster: cloneDescriptor(rasterLayers[layer.id]),
    simulation: { wet: "ephemeral" as const, height: "ephemeral" as const },
  })),
  animation: {
    ...source.animation,
    frames: source.animation.frames.map(({ layerData, ...frame }) => ({
      ...frame,
      populatedLayerIds: Object.entries(layerData).filter(([, value]) => Boolean(value)).map(([layerId]) => layerId),
      layerReferences: cloneReferences(snapshotReferences.animationFrames?.[frame.id]),
    })),
  },
  rig: {
    ...source.rig,
    bones: source.rig.bones.map((bone) => ({ ...bone })),
    layerBindings: Object.fromEntries(Object.entries(source.rig.layerBindings).map(([layerId, binding]) => [layerId, { ...binding }])),
    posePresets: source.rig.posePresets.map((preset) => ({ ...preset, pose: { ...preset.pose } })),
    sprites: Object.fromEntries(Object.entries(source.rig.sprites).map(([layerId, sprites]) => [layerId, sprites.map(({ dataUrl: _dataUrl, ...sprite }, index) => ({ ...sprite, reference: snapshotReferences.sprites?.[layerId]?.[index] ? { ...snapshotReferences.sprites[layerId][index]! } : null }))])),
  },
  comic: {
    ...source.comic,
    panels: source.comic.panels.map((panel) => ({ ...panel })),
    text: source.comic.text.map((item) => ({ ...item })),
    pages: source.comic.pages.map(({ layerData, ...page }) => ({
      ...page,
      panels: page.panels.map((panel) => ({ ...panel })),
      text: page.text.map((item) => ({ ...item })),
      populatedLayerIds: Object.entries(layerData).filter(([, value]) => Boolean(value)).map(([layerId]) => layerId),
      layerReferences: cloneReferences(snapshotReferences.comicPages?.[page.id]),
    })),
  },
  updatedAt: source.updatedAt,
});

export type WorkingDocumentV1 = ReturnType<typeof projectWorkingDocument>;

const assertNoCompatibilityDataUrls = (value: unknown, path = "workingDocument") => {
  if (typeof value !== "object" || value === null) return;
  Object.entries(value).forEach(([key, child]) => {
    if (key.toLowerCase().endsWith("dataurl")) throw new Error(`${path}.${key} is a compatibility data URL field.`);
    assertNoCompatibilityDataUrls(child, `${path}.${key}`);
  });
};

const assertBinaryReference = (value: unknown, path: string) => {
  const reference = value as Partial<BinaryDocumentReference>;
  if (reference?.kind !== "binary-handle" || typeof reference.handleId !== "string" || !reference.handleId) throw new Error(`${path} must be a binary handle reference.`);
};

export const parseWorkingDocument = (value: unknown): WorkingDocumentV1 => {
  const source = value as Partial<WorkingDocumentV1>;
  if (source?.format !== ART_ROOM_WORKING_DOCUMENT_FORMAT || source.version !== ART_ROOM_WORKING_DOCUMENT_VERSION) throw new Error("This is not a supported Art Room working document.");
  if (!Number.isInteger(source.width) || Number(source.width) < 1 || !Number.isInteger(source.height) || Number(source.height) < 1) throw new Error("Working document dimensions must be positive integers.");
  if (!Array.isArray(source.layers) || source.layers.length < 1) throw new Error("Working document must contain at least one layer.");
  source.layers.forEach((layer, index) => {
    if (!layer || typeof layer.id !== "string" || !layer.id) throw new Error(`Working document layers[${index}] must have an id.`);
    if (layer.raster) parseTileSetDescriptor(layer.raster);
  });
  source.animation?.frames?.forEach((frame, frameIndex) => Object.values(frame.layerReferences ?? {}).forEach((reference, referenceIndex) => assertBinaryReference(reference, `Working document animation.frames[${frameIndex}].layerReferences[${referenceIndex}]`)));
  source.comic?.pages?.forEach((page, pageIndex) => Object.values(page.layerReferences ?? {}).forEach((reference, referenceIndex) => assertBinaryReference(reference, `Working document comic.pages[${pageIndex}].layerReferences[${referenceIndex}]`)));
  Object.values(source.rig?.sprites ?? {}).forEach((sprites, layerIndex) => sprites.forEach((sprite, spriteIndex) => {
    if (sprite.reference) assertBinaryReference(sprite.reference, `Working document rig.sprites[${layerIndex}][${spriteIndex}].reference`);
  }));
  assertNoCompatibilityDataUrls(source);
  return value as WorkingDocumentV1;
};

export const workingDocumentHandleIds = (source: WorkingDocumentV1) => [...new Set(
  [
    ...source.layers.flatMap((layer) => layer.raster?.tiles.map((tile) => tile.handleId) ?? []),
    ...source.animation.frames.flatMap((frame) => Object.values(frame.layerReferences ?? {}).map((reference) => reference.handleId)),
    ...source.comic.pages.flatMap((page) => Object.values(page.layerReferences ?? {}).map((reference) => reference.handleId)),
    ...Object.values(source.rig.sprites).flatMap((sprites) => sprites.flatMap((sprite) => sprite.reference ? [sprite.reference.handleId] : [])),
  ],
)];
