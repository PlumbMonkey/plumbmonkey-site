import { BinaryPayload, BinaryStore, TileSetDescriptorV1, parseTileSetDescriptor, sha256Hex } from "./binaryStorage";
import { BinaryHandle, parseBinaryHandle } from "./projectFormats";

export const RASTER_RECOVERY_FORMAT = "art-room-raster-recovery" as const;
export const RASTER_RECOVERY_VERSION = 1 as const;

export type RasterRecoverySnapshotV1 = {
  format: typeof RASTER_RECOVERY_FORMAT;
  version: typeof RASTER_RECOVERY_VERSION;
  layers: Record<string, TileSetDescriptorV1>;
  payloads: BinaryPayload[];
};

const cloneBytes = (bytes: Uint8Array) => new Uint8Array(bytes);

const normalizeBytes = (value: unknown, label: string) => {
  if (value instanceof Uint8Array) return cloneBytes(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  throw new Error(`${label} must contain binary bytes.`);
};

export const parseRasterRecoverySnapshot = (value: unknown): RasterRecoverySnapshotV1 => {
  const snapshot = value as Partial<RasterRecoverySnapshotV1>;
  if (snapshot?.format !== RASTER_RECOVERY_FORMAT || snapshot.version !== RASTER_RECOVERY_VERSION) throw new Error("This is not a supported raster recovery snapshot.");
  if (!snapshot.layers || typeof snapshot.layers !== "object" || Array.isArray(snapshot.layers)) throw new Error("Raster recovery layers must be an object.");
  if (!Array.isArray(snapshot.payloads)) throw new Error("Raster recovery payloads must be an array.");
  const handles = new Map<string, BinaryHandle>();
  snapshot.payloads.forEach((payload, index) => {
    if (!payload || typeof payload !== "object") throw new Error(`Raster recovery payloads[${index}] must be an object.`);
    const handle = parseBinaryHandle(payload.handle, `Raster recovery payloads[${index}].handle`);
    if (handles.has(handle.id)) throw new Error(`Raster recovery contains duplicate handle: ${handle.id}`);
    normalizeBytes(payload.bytes, `Raster recovery payloads[${index}].bytes`);
    handles.set(handle.id, handle);
  });
  Object.entries(snapshot.layers).forEach(([layerId, descriptor]) => {
    if (!layerId) throw new Error("Raster recovery layer ids must be non-empty.");
    parseTileSetDescriptor(descriptor);
    descriptor.tiles.forEach((tile) => {
      if (!handles.has(tile.handleId)) throw new Error(`Raster recovery layer ${layerId} references unavailable handle: ${tile.handleId}`);
    });
  });
  return value as RasterRecoverySnapshotV1;
};

export const createRasterRecoverySnapshot = async (
  layers: Record<string, TileSetDescriptorV1>,
  handles: BinaryHandle[],
  store: BinaryStore,
): Promise<RasterRecoverySnapshotV1> => {
  const requiredIds = new Set<string>();
  Object.values(layers).forEach((descriptor) => {
    parseTileSetDescriptor(descriptor);
    descriptor.tiles.forEach((tile) => requiredIds.add(tile.handleId));
  });
  const handlesById = new Map(handles.map((handle) => [handle.id, parseBinaryHandle(handle)]));
  const payloads: BinaryPayload[] = [];
  for (const handleId of [...requiredIds].sort()) {
    const handle = handlesById.get(handleId);
    if (!handle) throw new Error(`Raster recovery is missing handle metadata: ${handleId}`);
    const bytes = await store.get(handleId);
    if (!bytes) throw new Error(`Raster recovery is missing payload bytes: ${handleId}`);
    if (bytes.byteLength !== handle.byteLength || await sha256Hex(bytes) !== handle.sha256) throw new Error(`Raster recovery payload failed integrity verification: ${handleId}`);
    payloads.push({ handle, bytes: cloneBytes(bytes) });
  }
  return {
    format: RASTER_RECOVERY_FORMAT,
    version: RASTER_RECOVERY_VERSION,
    layers: Object.fromEntries(Object.entries(layers).map(([layerId, descriptor]) => [layerId, { ...descriptor, tiles: descriptor.tiles.map((tile) => ({ ...tile })) }])),
    payloads,
  };
};

export const restoreRasterRecoverySnapshot = async (snapshotValue: unknown, store: BinaryStore) => {
  const snapshot = parseRasterRecoverySnapshot(snapshotValue);
  const handles: BinaryHandle[] = [];
  for (let index = 0; index < snapshot.payloads.length; index += 1) {
    const payload = snapshot.payloads[index];
    const bytes = normalizeBytes(payload.bytes, `Raster recovery payloads[${index}].bytes`);
    if (bytes.byteLength !== payload.handle.byteLength || await sha256Hex(bytes) !== payload.handle.sha256) throw new Error(`Raster recovery payload failed integrity verification: ${payload.handle.id}`);
    await store.put(payload.handle, bytes);
    handles.push(payload.handle);
  }
  return {
    layers: Object.fromEntries(Object.entries(snapshot.layers).map(([layerId, descriptor]) => [layerId, { ...descriptor, tiles: descriptor.tiles.map((tile) => ({ ...tile })) }])),
    handles,
  };
};
