export type JournalEntry<TPayload = unknown> = {
  id: string;
  sequence: number;
  kind: string;
  createdAt: string;
  payload: TPayload;
  undoable: boolean;
  groupId?: string;
};

export type JournalCheckpoint = {
  sequence: number;
  createdAt: string;
  path: string;
};

export type CommandJournal<TPayload = unknown> = {
  entries: JournalEntry<TPayload>[];
  head: number;
  checkpoint: JournalCheckpoint | null;
};

export type CheckpointPolicy = {
  maximumEntriesAfterCheckpoint: number;
  maximumEstimatedBytesAfterCheckpoint: number;
};

export const DEFAULT_CHECKPOINT_POLICY: CheckpointPolicy = {
  maximumEntriesAfterCheckpoint: 50,
  maximumEstimatedBytesAfterCheckpoint: 2_000_000,
};

export const createCommandJournal = <TPayload = unknown>(): CommandJournal<TPayload> => ({
  entries: [],
  head: 0,
  checkpoint: null,
});

export const appendJournalEntry = <TPayload>(
  journal: CommandJournal<TPayload>,
  entry: Omit<JournalEntry<TPayload>, "sequence">,
): CommandJournal<TPayload> => {
  const retained = journal.entries.filter((candidate) => candidate.sequence <= journal.head);
  const nextSequence = Math.max(retained[retained.length - 1]?.sequence ?? 0, journal.head, journal.checkpoint?.sequence ?? 0) + 1;
  return {
    entries: [...retained, { ...entry, sequence: nextSequence }],
    head: nextSequence,
    checkpoint: journal.checkpoint && journal.checkpoint.sequence <= nextSequence ? journal.checkpoint : null,
  };
};

export const moveJournalHead = <TPayload>(
  journal: CommandJournal<TPayload>,
  requestedHead: number,
): CommandJournal<TPayload> => {
  const maximum = journal.entries[journal.entries.length - 1]?.sequence ?? 0;
  const minimum = journal.checkpoint?.sequence ?? 0;
  return { ...journal, head: Math.max(minimum, Math.min(maximum, Math.floor(requestedHead))) };
};

export const journalEntriesToReplay = <TPayload>(journal: CommandJournal<TPayload>) => {
  const afterSequence = journal.checkpoint?.sequence ?? 0;
  return journal.entries.filter((entry) => entry.sequence > afterSequence && entry.sequence <= journal.head);
};

export const estimateJournalBytes = <TPayload>(journal: CommandJournal<TPayload>) =>
  journalEntriesToReplay(journal).reduce((total, entry) => total + JSON.stringify(entry).length, 0);

export const shouldCreateCheckpoint = <TPayload>(
  journal: CommandJournal<TPayload>,
  policy = DEFAULT_CHECKPOINT_POLICY,
) => {
  const entries = journalEntriesToReplay(journal);
  return entries.length >= policy.maximumEntriesAfterCheckpoint || estimateJournalBytes(journal) >= policy.maximumEstimatedBytesAfterCheckpoint;
};

export const setJournalCheckpoint = <TPayload>(
  journal: CommandJournal<TPayload>,
  checkpoint: JournalCheckpoint,
): CommandJournal<TPayload> => {
  if (checkpoint.sequence < 0 || checkpoint.sequence > journal.head) throw new Error("Checkpoint sequence must be within the applied journal range.");
  return { ...journal, checkpoint };
};

export const compactJournalAtCheckpoint = <TPayload>(
  journal: CommandJournal<TPayload>,
  checkpoint: JournalCheckpoint,
) => {
  if (checkpoint.sequence < 0 || checkpoint.sequence > journal.head) throw new Error("Compaction checkpoint must be within the applied journal range.");
  const removedEntries = journal.entries.filter((entry) => entry.sequence <= checkpoint.sequence);
  return {
    journal: {
      entries: journal.entries.filter((entry) => entry.sequence > checkpoint.sequence),
      head: journal.head,
      checkpoint,
    } as CommandJournal<TPayload>,
    removedEntries,
  };
};
