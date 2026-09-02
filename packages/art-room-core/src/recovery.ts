export const DEFAULT_MAXIMUM_RECOVERY_VERSIONS = 5;

export type RecoveryRecord<TDocument> = {
  id: string;
  savedAt: string;
  document: TDocument;
};

export type RecoveryStore<TDocument> = {
  list(): Promise<Array<RecoveryRecord<TDocument>>>;
  put(record: RecoveryRecord<TDocument>): Promise<void>;
  delete(ids: string[]): Promise<void>;
};

export type RecoveryServiceOptions = {
  maximumVersions?: number;
  now?: () => string;
  createId?: () => string;
};

export const sortRecoveryRecords = <TDocument>(records: Array<RecoveryRecord<TDocument>>) =>
  [...records].sort((left, right) => right.savedAt.localeCompare(left.savedAt) || right.id.localeCompare(left.id));

export const recoveryRecordsToDelete = <TDocument>(
  records: Array<RecoveryRecord<TDocument>>,
  maximum = DEFAULT_MAXIMUM_RECOVERY_VERSIONS,
) => sortRecoveryRecords(records).slice(Math.max(0, maximum)).map((record) => record.id);

export const latestRecoveryRecord = <TDocument>(records: Array<RecoveryRecord<TDocument>>) =>
  sortRecoveryRecords(records)[0];

export const createVersionedRecoveryService = <TDocument>(
  store: RecoveryStore<TDocument>,
  options: RecoveryServiceOptions = {},
) => {
  const maximumVersions = options.maximumVersions ?? DEFAULT_MAXIMUM_RECOVERY_VERSIONS;
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? (() => crypto.randomUUID());

  return {
    async save(document: TDocument) {
      const savedAt = now();
      const record: RecoveryRecord<TDocument> = { id: `${savedAt}:${createId()}`, savedAt, document };
      await store.put(record);
      const expired = recoveryRecordsToDelete(await store.list(), maximumVersions);
      if (expired.length) await store.delete(expired);
      return record;
    },
    async list() {
      return sortRecoveryRecords(await store.list());
    },
    async latest() {
      return latestRecoveryRecord(await store.list());
    },
  };
};
