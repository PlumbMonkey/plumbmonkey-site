import { NaturalMediaDocument, parseProject } from "./documentModel";
import { DEFAULT_MAXIMUM_RECOVERY_VERSIONS, RecoveryRecord, RecoveryStore, createVersionedRecoveryService } from "../../packages/art-room-core/src/recovery";
import { RasterRecoverySnapshotV1, parseRasterRecoverySnapshot } from "../../packages/art-room-core/src/rasterRecovery";

export const NATURAL_MEDIA_RECOVERY_FORMAT = "natural-media-recovery" as const;
export const NATURAL_MEDIA_RECOVERY_VERSION = 1 as const;

export type NaturalMediaRecoveryEnvelope = {
  format: typeof NATURAL_MEDIA_RECOVERY_FORMAT;
  version: typeof NATURAL_MEDIA_RECOVERY_VERSION;
  document: NaturalMediaDocument;
  raster?: RasterRecoverySnapshotV1;
};

type StoredRecoveryValue = NaturalMediaDocument | NaturalMediaRecoveryEnvelope;

const DATABASE_NAME = "natural-media-lab";
const DATABASE_VERSION = 2;
const LEGACY_PROJECT_STORE = "projects";
const RECOVERY_STORE = "recovery-versions";
export const MAX_RECOVERY_VERSIONS = DEFAULT_MAXIMUM_RECOVERY_VERSIONS;

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(LEGACY_PROJECT_STORE)) database.createObjectStore(LEGACY_PROJECT_STORE);
    if (!database.objectStoreNames.contains(RECOVERY_STORE)) database.createObjectStore(RECOVERY_STORE, { keyPath: "id" });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const readAllRecoveryRecords = (database: IDBDatabase) => new Promise<Array<RecoveryRecord<StoredRecoveryValue>>>((resolve, reject) => {
  const request = database.transaction(RECOVERY_STORE).objectStore(RECOVERY_STORE).getAll();
  request.onsuccess = () => resolve(request.result as Array<RecoveryRecord<StoredRecoveryValue>>);
  request.onerror = () => reject(request.error);
});

const readLegacyRecovery = (database: IDBDatabase) => new Promise<NaturalMediaDocument | undefined>((resolve, reject) => {
  if (!database.objectStoreNames.contains(LEGACY_PROJECT_STORE)) return resolve(undefined);
  const request = database.transaction(LEGACY_PROJECT_STORE).objectStore(LEGACY_PROJECT_STORE).get("autosave");
  request.onsuccess = () => resolve(request.result as NaturalMediaDocument | undefined);
  request.onerror = () => reject(request.error);
});

const recoveryStore: RecoveryStore<StoredRecoveryValue> = {
  async list() {
    const database = await openDatabase();
    try { return await readAllRecoveryRecords(database); } finally { database.close(); }
  },
  async put(record) {
    const database = await openDatabase();
    try { await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(RECOVERY_STORE, "readwrite");
      transaction.objectStore(RECOVERY_STORE).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    }); } finally { database.close(); }
  },
  async delete(ids) {
    const database = await openDatabase();
    try { await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(RECOVERY_STORE, "readwrite");
      const store = transaction.objectStore(RECOVERY_STORE);
      ids.forEach((id) => store.delete(id));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    }); } finally { database.close(); }
  },
};

const recoveryService = createVersionedRecoveryService(recoveryStore, { maximumVersions: MAX_RECOVERY_VERSIONS });

export const saveRecovery = (document: NaturalMediaDocument, raster?: RasterRecoverySnapshotV1) => recoveryService.save({
  format: NATURAL_MEDIA_RECOVERY_FORMAT,
  version: NATURAL_MEDIA_RECOVERY_VERSION,
  document,
  ...(raster ? { raster } : {}),
});

export const listRecoveryVersions = () => recoveryService.list();

export const loadRecovery = async () => {
  const latest = await recoveryService.latest();
  if (latest) {
    const stored = latest.document;
    if ((stored as Partial<NaturalMediaRecoveryEnvelope>).format === NATURAL_MEDIA_RECOVERY_FORMAT) {
      const envelope = stored as NaturalMediaRecoveryEnvelope;
      return { document: parseProject(envelope.document), raster: envelope.raster ? parseRasterRecoverySnapshot(envelope.raster) : undefined };
    }
    return { document: parseProject(stored) };
  }
  const database = await openDatabase();
  try {
    const legacy = await readLegacyRecovery(database);
    return legacy ? { document: parseProject(legacy) } : undefined;
  } finally {
    database.close();
  }
};
