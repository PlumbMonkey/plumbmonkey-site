import { BinaryStore, TileSetDescriptorV1, sha256Hex } from "./binaryStorage";
import { BinaryHandle } from "./projectFormats";

export type RasterPoint = { x: number; y: number };
export type RasterRect = { x: number; y: number; width: number; height: number };
export type RasterTileCoordinate = { column: number; row: number };

export type EncodedRasterRegion = {
  mediaType: string;
  bytes: Uint8Array;
};

export type RasterRegionSource = {
  width: number;
  height: number;
  encodeRegion(region: RasterRect): Promise<EncodedRasterRegion>;
};

const finite = (value: number) => Number.isFinite(value) ? value : 0;

export const clipRasterRect = (rect: RasterRect, width: number, height: number): RasterRect | null => {
  const left = Math.max(0, Math.floor(finite(rect.x)));
  const top = Math.max(0, Math.floor(finite(rect.y)));
  const right = Math.min(width, Math.ceil(finite(rect.x) + Math.max(0, finite(rect.width))));
  const bottom = Math.min(height, Math.ceil(finite(rect.y) + Math.max(0, finite(rect.height))));
  return right > left && bottom > top ? { x: left, y: top, width: right - left, height: bottom - top } : null;
};

export const unionRasterRects = (left: RasterRect | null, right: RasterRect | null): RasterRect | null => {
  if (!left) return right && { ...right };
  if (!right) return { ...left };
  const x = Math.min(left.x, right.x), y = Math.min(left.y, right.y);
  const maximumX = Math.max(left.x + left.width, right.x + right.width);
  const maximumY = Math.max(left.y + left.height, right.y + right.height);
  return { x, y, width: maximumX - x, height: maximumY - y };
};

export const dirtyRectForSegment = (
  from: RasterPoint,
  to: RasterPoint,
  radius: number,
  canvasWidth: number,
  canvasHeight: number,
  mirror = false,
) => {
  const padding = Math.max(1, finite(radius));
  const segment = clipRasterRect({
    x: Math.min(from.x, to.x) - padding,
    y: Math.min(from.y, to.y) - padding,
    width: Math.abs(to.x - from.x) + padding * 2,
    height: Math.abs(to.y - from.y) + padding * 2,
  }, canvasWidth, canvasHeight);
  if (!mirror) return segment;
  const mirrored = clipRasterRect({
    x: canvasWidth - Math.max(from.x, to.x) - padding,
    y: Math.min(from.y, to.y) - padding,
    width: Math.abs(to.x - from.x) + padding * 2,
    height: Math.abs(to.y - from.y) + padding * 2,
  }, canvasWidth, canvasHeight);
  return unionRasterRects(segment, mirrored);
};

export const tilesForRasterRect = (
  dirty: RasterRect,
  width: number,
  height: number,
  tileSize: number,
): RasterTileCoordinate[] => {
  if (!Number.isInteger(tileSize) || tileSize <= 0) throw new Error("Tile size must be a positive integer.");
  const clipped = clipRasterRect(dirty, width, height);
  if (!clipped) return [];
  const firstColumn = Math.floor(clipped.x / tileSize);
  const lastColumn = Math.floor((clipped.x + clipped.width - 1) / tileSize);
  const firstRow = Math.floor(clipped.y / tileSize);
  const lastRow = Math.floor((clipped.y + clipped.height - 1) / tileSize);
  const coordinates: RasterTileCoordinate[] = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) coordinates.push({ column, row });
  }
  return coordinates;
};

export const persistDirtyRasterTiles = async (options: {
  layerId: string;
  source: RasterRegionSource;
  dirty: RasterRect;
  store: BinaryStore;
  previous?: TileSetDescriptorV1;
  tileSize?: number;
  createId?: () => string;
  deleteReplaced?: boolean;
}) => {
  const tileSize = options.tileSize ?? 256;
  const createId = options.createId ?? (() => crypto.randomUUID());
  const coordinates = tilesForRasterRect(options.dirty, options.source.width, options.source.height, tileSize);
  const previousTiles = options.previous?.width === options.source.width && options.previous.height === options.source.height && options.previous.tileSize === tileSize ? options.previous.tiles : [];
  const retained = new Map(previousTiles.map((tile) => [`${tile.column}:${tile.row}`, tile]));
  const handles: BinaryHandle[] = [];
  const replacedHandleIds: string[] = [];
  for (const coordinate of coordinates) {
    const region = {
      x: coordinate.column * tileSize,
      y: coordinate.row * tileSize,
      width: Math.min(tileSize, options.source.width - coordinate.column * tileSize),
      height: Math.min(tileSize, options.source.height - coordinate.row * tileSize),
    };
    const encoded = await options.source.encodeRegion(region);
    const handle: BinaryHandle = {
      id: `tile-${options.layerId}-${coordinate.column}-${coordinate.row}-${createId()}`,
      mediaType: encoded.mediaType,
      byteLength: encoded.bytes.byteLength,
      sha256: await sha256Hex(encoded.bytes),
      location: { kind: "cache", key: `raster/${options.layerId}/${coordinate.column}/${coordinate.row}` },
    };
    await options.store.put(handle, encoded.bytes);
    const coordinateKey = `${coordinate.column}:${coordinate.row}`;
    const replaced = retained.get(coordinateKey);
    if (replaced && replaced.handleId !== handle.id) replacedHandleIds.push(replaced.handleId);
    retained.set(coordinateKey, { ...coordinate, handleId: handle.id });
    handles.push(handle);
  }
  if (replacedHandleIds.length && options.deleteReplaced !== false) await options.store.delete(replacedHandleIds);
  return {
    descriptor: {
      format: "art-room-tile-set",
      version: 1,
      width: options.source.width,
      height: options.source.height,
      tileSize,
      tiles: [...retained.values()].sort((left, right) => left.row - right.row || left.column - right.column),
    } as TileSetDescriptorV1,
    handles,
    replacedHandleIds,
    writtenTiles: coordinates.length,
  };
};
