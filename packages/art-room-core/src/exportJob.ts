export type ExportJobStatus = "idle" | "running" | "succeeded" | "cancelled" | "failed";

export type ExportJobState = {
  id: string | null;
  kind: string | null;
  status: ExportJobStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
};

export type ExportJobContext = {
  id: string;
  kind: string;
  signal: AbortSignal;
  defer(cleanup: () => void): void;
  onCancel(cleanup: () => void): void;
  throwIfCancelled(): void;
};

export class ExportJobCancelledError extends Error {
  constructor(message = "Export job cancelled.") {
    super(message);
    this.name = "ExportJobCancelledError";
  }
}

export const isExportJobCancelled = (error: unknown) => error instanceof ExportJobCancelledError;

export class ExportJobController {
  private active?: { id: string; kind: string; abort: AbortController; cleanups: Array<() => void> };
  private currentState: ExportJobState = { id: null, kind: null, status: "idle" };

  constructor(
    private readonly options: { createId?: () => string; now?: () => string; onState?: (state: ExportJobState) => void } = {},
  ) {}

  get state() {
    return { ...this.currentState };
  }

  get running() {
    return Boolean(this.active);
  }

  private publish(state: ExportJobState) {
    this.currentState = state;
    this.options.onState?.({ ...state });
  }

  async run<T>(kind: string, operation: (context: ExportJobContext) => Promise<T>): Promise<T> {
    if (this.active) throw new Error(`Export job already running: ${this.active.kind}`);
    const id = this.options.createId?.() ?? crypto.randomUUID();
    const now = this.options.now ?? (() => new Date().toISOString());
    const abort = new AbortController();
    const active = { id, kind, abort, cleanups: [] as Array<() => void> };
    this.active = active;
    const startedAt = now();
    this.publish({ id, kind, status: "running", startedAt });
    const context: ExportJobContext = {
      id,
      kind,
      signal: abort.signal,
      defer: (cleanup) => active.cleanups.push(cleanup),
      onCancel: (cleanup) => {
        if (abort.signal.aborted) cleanup();
        else abort.signal.addEventListener("abort", cleanup, { once: true });
      },
      throwIfCancelled: () => {
        if (abort.signal.aborted) throw new ExportJobCancelledError();
      },
    };
    try {
      const result = await operation(context);
      context.throwIfCancelled();
      this.publish({ id, kind, status: "succeeded", startedAt, finishedAt: now() });
      return result;
    } catch (error) {
      if (abort.signal.aborted || isExportJobCancelled(error)) {
        const cancelled = isExportJobCancelled(error) ? error : new ExportJobCancelledError();
        this.publish({ id, kind, status: "cancelled", startedAt, finishedAt: now() });
        throw cancelled;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.publish({ id, kind, status: "failed", startedAt, finishedAt: now(), error: message });
      throw error;
    } finally {
      [...active.cleanups].reverse().forEach((cleanup) => {
        try { cleanup(); } catch { /* cleanup must not mask the job result */ }
      });
      if (this.active === active) this.active = undefined;
    }
  }

  cancel() {
    if (!this.active) return false;
    this.active.abort.abort();
    return true;
  }
}
