import { BinaryStore, TileSetDescriptorV1, createLazyBinaryResolver, createMemoryBinaryStore } from "./binaryStorage";
import { BinaryHandle } from "./projectFormats";
import { RasterRecoverySnapshotV1, createRasterRecoverySnapshot, restoreRasterRecoverySnapshot } from "./rasterRecovery";
import { RasterRegionSource, RasterRect, persistDirtyRasterTiles } from "./rasterSurface";
import { RasterTileRevisionCommand, applyRasterTileRevision } from "./rasterRevision";
import type { NaturalMediaDocument } from "./documentModel";
import { projectWorkingDocument } from "./workingDocument";

export type RasterSessionOptions = {
  createStore?: () => BinaryStore;
  createId?: () => string;
  now?: () => string;
};

export type RasterSessionPersistRequest = {
  layerId: string;
  source: RasterRegionSource;
  dirty: RasterRect;
};

const cloneDescriptor = (descriptor: TileSetDescriptorV1) => ({
  ...descriptor,
  tiles: descriptor.tiles.map((tile) => ({ ...tile })),
});

export class RasterSession {
  private readonly createStore: () => BinaryStore;
  private readonly createId: () => string;
  private readonly now: () => string;
  private store: BinaryStore;
  private generation = 0;
  private readonly descriptors = new Map<string, TileSetDescriptorV1>();
  private readonly handles = new Map<string, BinaryHandle>();
  private readonly queues = new Map<string, Promise<RasterTileRevisionCommand | undefined>>();

  constructor(options: RasterSessionOptions = {}) {
    this.createStore = options.createStore ?? createMemoryBinaryStore;
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => new Date().toISOString());
    this.store = this.createStore();
  }

  reset() {
    this.generation += 1;
    this.store = this.createStore();
    this.descriptors.clear();
    this.handles.clear();
    this.queues.clear();
  }

  hasRaster() {
    return this.descriptors.size > 0;
  }

  layerDescriptor(layerId: string) {
    const descriptor = this.descriptors.get(layerId);
    return descriptor && cloneDescriptor(descriptor);
  }

  layerDescriptors() {
    return Object.fromEntries([...this.descriptors].map(([layerId, descriptor]) => [layerId, cloneDescriptor(descriptor)]));
  }

  createResolver() {
    return createLazyBinaryResolver([...this.handles.values()], this.store);
  }

  createWorkingDocument(source: NaturalMediaDocument) {
    return projectWorkingDocument(source, this.layerDescriptors());
  }

  persist(request: RasterSessionPersistRequest) {
    const generation = this.generation;
    const store = this.store;
    const prior = this.queues.get(request.layerId) ?? Promise.resolve(undefined);
    const queued = prior.catch(() => undefined).then(async () => {
      if (generation !== this.generation) return undefined;
      const previous = this.descriptors.get(request.layerId);
      const result = await persistDirtyRasterTiles({
        ...request,
        store,
        previous,
        createId: this.createId,
        deleteReplaced: false,
      });
      if (generation !== this.generation) return undefined;
      result.handles.forEach((handle) => this.handles.set(handle.id, handle));
      this.descriptors.set(request.layerId, result.descriptor);
      return {
        id: this.createId(),
        createdAt: this.now(),
        type: "raster.tiles.replace" as const,
        layerId: request.layerId,
        before: previous ? cloneDescriptor(previous) : null,
        after: cloneDescriptor(result.descriptor),
        createdHandleIds: result.handles.map((handle) => handle.id),
        replacedHandleIds: result.replacedHandleIds,
      };
    });
    this.queues.set(request.layerId, queued);
    const removeQueue = () => {
      if (this.queues.get(request.layerId) === queued) this.queues.delete(request.layerId);
    };
    void queued.then(removeQueue, removeQueue);
    return queued;
  }

  async createRecovery() {
    const generation = this.generation;
    await Promise.all([...this.queues.values()].map((queue) => queue.catch(() => undefined)));
    if (generation !== this.generation || !this.hasRaster()) return undefined;
    return createRasterRecoverySnapshot(this.layerDescriptors(), [...this.handles.values()], this.store);
  }

  async restore(snapshot: RasterRecoverySnapshotV1) {
    this.reset();
    const generation = this.generation;
    const store = this.store;
    const restored = await restoreRasterRecoverySnapshot(snapshot, store);
    if (generation !== this.generation || store !== this.store) return false;
    Object.entries(restored.layers).forEach(([layerId, descriptor]) => this.descriptors.set(layerId, cloneDescriptor(descriptor)));
    restored.handles.forEach((handle) => this.handles.set(handle.id, handle));
    return true;
  }

  applyRevision(command: RasterTileRevisionCommand, direction: "redo" | "undo") {
    const next = applyRasterTileRevision(this.layerDescriptors(), command, direction);
    this.descriptors.clear();
    Object.entries(next).forEach(([layerId, descriptor]) => this.descriptors.set(layerId, cloneDescriptor(descriptor)));
    return this.layerDescriptor(command.layerId);
  }

  async prune(retainedDescriptors: Array<TileSetDescriptorV1 | null | undefined> = []) {
    const retained = new Set<string>();
    this.descriptors.forEach((descriptor) => descriptor.tiles.forEach((tile) => retained.add(tile.handleId)));
    retainedDescriptors.forEach((descriptor) => descriptor?.tiles.forEach((tile) => retained.add(tile.handleId)));
    const obsolete = [...this.handles.keys()].filter((handleId) => !retained.has(handleId));
    obsolete.forEach((handleId) => this.handles.delete(handleId));
    if (obsolete.length) await this.store.delete(obsolete);
    return obsolete;
  }
}
