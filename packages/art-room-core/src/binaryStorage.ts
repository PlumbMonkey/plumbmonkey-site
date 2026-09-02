import { parseProject } from "./documentModel";
import { BinaryHandle, PlannedNmlBinary, parseBinaryHandle, planNmlBinaryMigration } from "./projectFormats";

export const ART_ROOM_CHECKPOINT_FORMAT = "art-room-checkpoint" as const;
export const ART_ROOM_CHECKPOINT_VERSION = 1 as const;
export const ART_ROOM_TILE_SET_FORMAT = "art-room-tile-set" as const;
export const ART_ROOM_TILE_SET_VERSION = 1 as const;

export type BinaryDocumentReference = {
  kind: "binary-handle";
  handleId: string;
};

export type BinaryPayload = {
  handle: BinaryHandle;
  bytes: Uint8Array;
};

export type BinaryStore = {
  put(handle: BinaryHandle, bytes: Uint8Array): Promise<void>;
  get(handleId: string): Promise<Uint8Array | undefined>;
  has(handleId: string): Promise<boolean>;
  delete(handleIds: string[]): Promise<void>;
};

export type ArtRoomCheckpointV1 = {
  format: typeof ART_ROOM_CHECKPOINT_FORMAT;
  version: typeof ART_ROOM_CHECKPOINT_VERSION;
  sequence: number;
  createdAt: string;
  document: unknown;
  binaries: BinaryHandle[];
};

export type TileReference = {
  column: number;
  row: number;
  handleId: string;
};

export type TileSetDescriptorV1 = {
  format: typeof ART_ROOM_TILE_SET_FORMAT;
  version: typeof ART_ROOM_TILE_SET_VERSION;
  width: number;
  height: number;
  tileSize: number;
  tiles: TileReference[];
};

const cloneBytes = (bytes: Uint8Array) => new Uint8Array(bytes);

export const createMemoryBinaryStore = (): BinaryStore => {
  const payloads = new Map<string, Uint8Array>();
  return {
    async put(handle, bytes) {
      if (bytes.byteLength !== handle.byteLength) throw new Error(`Binary ${handle.id} does not match its declared byte length.`);
      payloads.set(handle.id, cloneBytes(bytes));
    },
    async get(handleId) {
      const bytes = payloads.get(handleId);
      return bytes && cloneBytes(bytes);
    },
    async has(handleId) {
      return payloads.has(handleId);
    },
    async delete(handleIds) {
      handleIds.forEach((handleId) => payloads.delete(handleId));
    },
  };
};

export const decodeDataUrl = (dataUrl: string) => {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 5) throw new Error("Binary source is not a valid data URL.");
  const metadata = dataUrl.slice(5, comma).split(";").filter(Boolean);
  const payload = dataUrl.slice(comma + 1);
  const mediaType = metadata[0]?.includes("/") ? metadata[0].toLowerCase() : "text/plain";
  const isBase64 = metadata.some((part) => part.toLowerCase() === "base64");
  if (!isBase64) return { mediaType, bytes: new TextEncoder().encode(decodeURIComponent(payload)) };
  const encoded = payload.replace(/\s+/g, "");
  if (!/^(?:[a-z\d+/]{4})*(?:[a-z\d+/]{2}==|[a-z\d+/]{3}=)?$/i.test(encoded)) throw new Error("Binary source contains invalid base64 data.");
  const decoded = atob(encoded);
  return { mediaType, bytes: Uint8Array.from(decoded, (character) => character.charCodeAt(0)) };
};

export const encodeDataUrl = (mediaType: string, bytes: Uint8Array) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${mediaType};base64,${btoa(binary)}`;
};

export const sha256Hex = async (bytes: Uint8Array) => {
  const owned = new Uint8Array(bytes.byteLength);
  owned.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", owned.buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
};

export const finalizePlannedBinary = async (planned: PlannedNmlBinary): Promise<BinaryPayload> => {
  const decoded = decodeDataUrl(planned.dataUrl);
  if (decoded.mediaType !== planned.mediaType) throw new Error(`Binary ${planned.id} media type changed during decoding.`);
  return {
    handle: {
      id: planned.id,
      mediaType: decoded.mediaType,
      byteLength: decoded.bytes.byteLength,
      sha256: await sha256Hex(decoded.bytes),
      location: { kind: "embedded", path: planned.packagePath },
    },
    bytes: decoded.bytes,
  };
};

const decodePointerSegment = (segment: string) => segment.replace(/~1/g, "/").replace(/~0/g, "~");

const replaceAtJsonPointer = (root: unknown, pointer: string, value: unknown) => {
  if (!pointer.startsWith("/")) throw new Error("Binary migration pointer must be absolute.");
  const segments = pointer.slice(1).split("/").map(decodePointerSegment);
  let cursor = root as Record<string, unknown> | unknown[];
  for (const segment of segments.slice(0, -1)) {
    const next = Array.isArray(cursor) ? cursor[Number(segment)] : cursor[segment];
    if ((typeof next !== "object" || next === null) || (!Array.isArray(next) && Object.getPrototypeOf(next) !== Object.prototype)) throw new Error(`Binary migration pointer does not exist: ${pointer}`);
    cursor = next as Record<string, unknown> | unknown[];
  }
  const finalSegment = segments[segments.length - 1];
  if (Array.isArray(cursor)) {
    const index = Number(finalSegment);
    if (!Number.isInteger(index) || index < 0 || index >= cursor.length) throw new Error(`Binary migration pointer does not exist: ${pointer}`);
    cursor[index] = value;
  } else {
    if (!Object.prototype.hasOwnProperty.call(cursor, finalSegment)) throw new Error(`Binary migration pointer does not exist: ${pointer}`);
    Object.defineProperty(cursor, finalSegment, { value, enumerable: true, configurable: true, writable: true });
  }
};

export const createNmlBinaryCheckpoint = async (
  source: unknown,
  options: { sequence: number; createdAt: string },
) => {
  if (!Number.isInteger(options.sequence) || options.sequence < 0) throw new Error("Checkpoint sequence must be a non-negative integer.");
  let generatedId = 0;
  const document = JSON.parse(JSON.stringify(parseProject(source, { createId: () => `migration-${++generatedId}` }))) as unknown;
  const planned = planNmlBinaryMigration(document);
  const ids = new Set<string>();
  const paths = new Set<string>();
  planned.forEach((binary) => {
    if (ids.has(binary.id)) throw new Error(`Binary migration contains duplicate id: ${binary.id}`);
    if (paths.has(binary.packagePath)) throw new Error(`Binary migration contains duplicate package path: ${binary.packagePath}`);
    ids.add(binary.id);
    paths.add(binary.packagePath);
  });
  const payloads = await Promise.all(planned.map(finalizePlannedBinary));
  payloads.forEach(({ handle }, index) => replaceAtJsonPointer(document, planned[index].jsonPointer, { kind: "binary-handle", handleId: handle.id } satisfies BinaryDocumentReference));
  const checkpoint: ArtRoomCheckpointV1 = {
    format: ART_ROOM_CHECKPOINT_FORMAT,
    version: ART_ROOM_CHECKPOINT_VERSION,
    sequence: options.sequence,
    createdAt: options.createdAt,
    document,
    binaries: payloads.map(({ handle }) => handle),
  };
  return { checkpoint, payloads };
};

const referencedHandleIds = (value: unknown, found = new Set<string>(), visited = new WeakSet<object>()) => {
  if (typeof value !== "object" || value === null || visited.has(value)) return found;
  visited.add(value);
  if (!Array.isArray(value) && (value as Partial<BinaryDocumentReference>).kind === "binary-handle") {
    const handleId = (value as Partial<BinaryDocumentReference>).handleId;
    if (typeof handleId !== "string" || !handleId) throw new Error("Binary document reference must contain a handle id.");
    found.add(handleId);
    return found;
  }
  Object.values(value).forEach((child) => referencedHandleIds(child, found, visited));
  return found;
};

export const parseArtRoomCheckpoint = (value: unknown): ArtRoomCheckpointV1 => {
  const checkpoint = value as Partial<ArtRoomCheckpointV1>;
  if (checkpoint?.format !== ART_ROOM_CHECKPOINT_FORMAT || checkpoint.version !== ART_ROOM_CHECKPOINT_VERSION) throw new Error("This is not a supported Art Room checkpoint.");
  if (!Number.isInteger(checkpoint.sequence) || Number(checkpoint.sequence) < 0) throw new Error("Checkpoint sequence must be a non-negative integer.");
  if (typeof checkpoint.createdAt !== "string" || !checkpoint.createdAt) throw new Error("Checkpoint createdAt must be a non-empty string.");
  if (typeof checkpoint.document !== "object" || checkpoint.document === null || Array.isArray(checkpoint.document)) throw new Error("Checkpoint document must be an object.");
  if (!Array.isArray(checkpoint.binaries)) throw new Error("Checkpoint binaries must be an array.");
  const handles = checkpoint.binaries.map((handle, index) => parseBinaryHandle(handle, `Checkpoint binaries[${index}]`));
  const handleIds = new Set(handles.map((handle) => handle.id));
  if (handleIds.size !== handles.length) throw new Error("Checkpoint binaries contains duplicate ids.");
  referencedHandleIds(checkpoint.document).forEach((handleId) => {
    if (!handleIds.has(handleId)) throw new Error(`Checkpoint document references unknown binary handle: ${handleId}`);
  });
  return value as ArtRoomCheckpointV1;
};

export const createLazyBinaryResolver = (handles: BinaryHandle[], store: BinaryStore) => {
  const byId = new Map<string, BinaryHandle>();
  handles.forEach((handle) => {
    if (byId.has(handle.id)) throw new Error(`Duplicate binary handle id: ${handle.id}`);
    byId.set(handle.id, handle);
  });
  const cache = new Map<string, Promise<string>>();
  return {
    resolve(handleId: string) {
      const existing = cache.get(handleId);
      if (existing) return existing;
      const pending = (async () => {
        const handle = byId.get(handleId);
        if (!handle) throw new Error(`Unknown binary handle: ${handleId}`);
        const bytes = await store.get(handleId);
        if (!bytes) throw new Error(`Binary payload is unavailable: ${handleId}`);
        if (bytes.byteLength !== handle.byteLength || await sha256Hex(bytes) !== handle.sha256) throw new Error(`Binary payload failed integrity verification: ${handleId}`);
        return encodeDataUrl(handle.mediaType, bytes);
      })();
      cache.set(handleId, pending);
      pending.catch(() => cache.delete(handleId));
      return pending;
    },
    clear(handleId?: string) {
      if (handleId) cache.delete(handleId); else cache.clear();
    },
  };
};

const requirePositiveInteger = (value: unknown, label: string) => {
  if (!Number.isInteger(value) || Number(value) <= 0) throw new Error(`${label} must be a positive integer.`);
  return Number(value);
};

export const parseTileSetDescriptor = (value: unknown): TileSetDescriptorV1 => {
  const descriptor = value as Partial<TileSetDescriptorV1>;
  if (descriptor?.format !== ART_ROOM_TILE_SET_FORMAT || descriptor.version !== ART_ROOM_TILE_SET_VERSION) throw new Error("This is not a supported Art Room tile set.");
  const width = requirePositiveInteger(descriptor.width, "Tile set width");
  const height = requirePositiveInteger(descriptor.height, "Tile set height");
  const tileSize = requirePositiveInteger(descriptor.tileSize, "Tile size");
  if (!Array.isArray(descriptor.tiles)) throw new Error("Tile set tiles must be an array.");
  const maximumColumn = Math.ceil(width / tileSize) - 1;
  const maximumRow = Math.ceil(height / tileSize) - 1;
  const occupied = new Set<string>();
  descriptor.tiles.forEach((tile, index) => {
    if (!Number.isInteger(tile.column) || tile.column < 0 || tile.column > maximumColumn || !Number.isInteger(tile.row) || tile.row < 0 || tile.row > maximumRow) throw new Error(`Tile set tiles[${index}] is outside the canvas.`);
    if (typeof tile.handleId !== "string" || !tile.handleId) throw new Error(`Tile set tiles[${index}].handleId must be a non-empty string.`);
    const coordinate = `${tile.column}:${tile.row}`;
    if (occupied.has(coordinate)) throw new Error(`Tile set contains duplicate coordinate ${coordinate}.`);
    occupied.add(coordinate);
  });
  return value as TileSetDescriptorV1;
};
