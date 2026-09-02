export type SnapshotHistoryEntry<TDocument, TRevision = unknown> = {
  id: string;
  document: TDocument;
  rasterCompatible: boolean;
  rasterRevision?: TRevision;
  rasterRevisionPending?: boolean;
  commandSequence?: number;
};

export const recordHistoryEntry = <TDocument, TRevision>(
  history: Array<SnapshotHistoryEntry<TDocument, TRevision>>,
  redo: Array<SnapshotHistoryEntry<TDocument, TRevision>>,
  entry: SnapshotHistoryEntry<TDocument, TRevision>,
  maximumEntries = 16,
) => {
  if (!Number.isInteger(maximumEntries) || maximumEntries < 1) throw new Error("History maximum must be a positive integer.");
  history.push(entry);
  const dropped = history.length > maximumEntries ? history.splice(0, history.length - maximumEntries) : [];
  const discardedRedo = redo.splice(0, redo.length);
  return { dropped, discardedRedo };
};

export const takeHistoryStep = <TDocument, TRevision>(
  source: Array<SnapshotHistoryEntry<TDocument, TRevision>>,
  destination: Array<SnapshotHistoryEntry<TDocument, TRevision>>,
  currentDocument: TDocument,
  maximumEntries = 16,
) => {
  if (!Number.isInteger(maximumEntries) || maximumEntries < 1) throw new Error("History maximum must be a positive integer.");
  const entry = source.pop();
  if (!entry) return undefined;
  destination.push({ ...entry, document: currentDocument });
  if (destination.length > maximumEntries) destination.splice(0, destination.length - maximumEntries);
  return entry;
};

export const historyEntryRequiresRasterReset = <TDocument, TRevision>(
  entry: SnapshotHistoryEntry<TDocument, TRevision>,
) => !entry.rasterCompatible || Boolean(entry.rasterRevisionPending && !entry.rasterRevision);
