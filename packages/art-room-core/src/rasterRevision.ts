import { TileSetDescriptorV1, parseTileSetDescriptor } from "./binaryStorage";

export type RasterRevisionState = Record<string, TileSetDescriptorV1>;

export type RasterTileRevisionCommand = {
  id: string;
  createdAt: string;
  type: "raster.tiles.replace";
  layerId: string;
  before: TileSetDescriptorV1 | null;
  after: TileSetDescriptorV1;
  createdHandleIds: string[];
  replacedHandleIds: string[];
};

const cloneDescriptor = (descriptor: TileSetDescriptorV1) => ({
  ...descriptor,
  tiles: descriptor.tiles.map((tile) => ({ ...tile })),
});

export const applyRasterTileRevision = (
  state: RasterRevisionState,
  command: RasterTileRevisionCommand,
  direction: "redo" | "undo" = "redo",
): RasterRevisionState => {
  if (!command.layerId) throw new Error("Raster revision layer id must be non-empty.");
  parseTileSetDescriptor(command.after);
  if (command.before) parseTileSetDescriptor(command.before);
  const target = direction === "redo" ? command.after : command.before;
  const next = { ...state };
  if (target) next[command.layerId] = cloneDescriptor(target); else delete next[command.layerId];
  return next;
};

export const rasterRevisionHandlesToRetain = (command: RasterTileRevisionCommand, direction: "redo" | "undo") =>
  direction === "redo" ? command.createdHandleIds : command.replacedHandleIds;

