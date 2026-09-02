import type { TileSetDescriptorV1 } from "./binaryStorage";
import type { NaturalMediaDocument } from "./documentModel";

export const ART_ROOM_WORKING_DOCUMENT_FORMAT = "art-room-working-document" as const;
export const ART_ROOM_WORKING_DOCUMENT_VERSION = 1 as const;

const cloneDescriptor = (descriptor: TileSetDescriptorV1 | undefined) => descriptor ? {
  ...descriptor,
  tiles: descriptor.tiles.map((tile) => ({ ...tile })),
} : null;

export const projectWorkingDocument = (
  source: NaturalMediaDocument,
  rasterLayers: Record<string, TileSetDescriptorV1 | undefined>,
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
    })),
  },
  rig: {
    ...source.rig,
    bones: source.rig.bones.map((bone) => ({ ...bone })),
    layerBindings: Object.fromEntries(Object.entries(source.rig.layerBindings).map(([layerId, binding]) => [layerId, { ...binding }])),
    posePresets: source.rig.posePresets.map((preset) => ({ ...preset, pose: { ...preset.pose } })),
    sprites: Object.fromEntries(Object.entries(source.rig.sprites).map(([layerId, sprites]) => [layerId, sprites.map(({ dataUrl: _dataUrl, ...sprite }) => ({ ...sprite }))])),
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
    })),
  },
  updatedAt: source.updatedAt,
});

export type WorkingDocumentV1 = ReturnType<typeof projectWorkingDocument>;

export const workingDocumentHandleIds = (source: WorkingDocumentV1) => [...new Set(
  source.layers.flatMap((layer) => layer.raster?.tiles.map((tile) => tile.handleId) ?? []),
)];
