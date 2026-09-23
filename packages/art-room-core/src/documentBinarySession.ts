import { createLazyBinaryResolver, createMemoryBinaryStore, createNmlBinaryCheckpoint } from "./binaryStorage";
import type { ArtRoomCheckpointV1, BinaryDocumentReference, BinaryPayload, BinaryStore } from "./binaryStorage";
import type { NaturalMediaDocument } from "./documentModel";
import type { WorkingSnapshotReferences } from "./workingDocument";

type BinaryBackedDocument = {
  animation?: { frames?: Array<{ id?: string; layerData?: Record<string, unknown> }> };
  comic?: { pages?: Array<{ id?: string; layerData?: Record<string, unknown> }> };
  rig?: { sprites?: Record<string, Array<{ dataUrl?: unknown }>> };
};

export type DocumentBinarySnapshot = {
  checkpoint: ArtRoomCheckpointV1;
  payloads: BinaryPayload[];
};

const asReference = (value: unknown): BinaryDocumentReference | undefined => {
  const reference = value as Partial<BinaryDocumentReference>;
  return reference?.kind === "binary-handle" && typeof reference.handleId === "string" && reference.handleId ? reference as BinaryDocumentReference : undefined;
};

export class DocumentBinarySession {
  private readonly store: BinaryStore;
  private sequence = 0;
  private generation = 0;
  private snapshot?: DocumentBinarySnapshot;
  private resolver?: ReturnType<typeof createLazyBinaryResolver>;

  constructor(
    options: { createStore?: () => BinaryStore; now?: () => string } = {},
  ) {
    this.store = (options.createStore ?? createMemoryBinaryStore)();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  private readonly now: () => string;

  get current() {
    return this.snapshot;
  }

  async capture(source: NaturalMediaDocument) {
    const generation = ++this.generation;
    const created = await createNmlBinaryCheckpoint(source, { sequence: ++this.sequence, createdAt: this.now() });
    if (generation !== this.generation) return undefined;
    for (const payload of created.payloads) await this.store.put(payload.handle, payload.bytes);
    if (generation !== this.generation) return undefined;
    this.snapshot = created;
    this.resolver = createLazyBinaryResolver(created.checkpoint.binaries, this.store);
    return created;
  }

  private document() {
    return this.snapshot?.checkpoint.document as BinaryBackedDocument | undefined;
  }

  frameLayerReference(frameId: string, layerId: string) {
    return asReference(this.document()?.animation?.frames?.find((frame) => frame.id === frameId)?.layerData?.[layerId]);
  }

  comicPageLayerReference(pageId: string, layerId: string) {
    return asReference(this.document()?.comic?.pages?.find((page) => page.id === pageId)?.layerData?.[layerId]);
  }

  spriteReference(layerId: string, index: number) {
    return asReference(this.document()?.rig?.sprites?.[layerId]?.[index]?.dataUrl);
  }

  workingReferences(): WorkingSnapshotReferences {
    const document = this.document();
    return {
      animationFrames: Object.fromEntries((document?.animation?.frames ?? []).map((frame) => [frame.id ?? "", Object.fromEntries(Object.entries(frame.layerData ?? {}).flatMap(([layerId, value]) => {
        const reference = asReference(value);
        return reference ? [[layerId, reference]] : [];
      }))]).filter(([frameId]) => Boolean(frameId))),
      comicPages: Object.fromEntries((document?.comic?.pages ?? []).map((page) => [page.id ?? "", Object.fromEntries(Object.entries(page.layerData ?? {}).flatMap(([layerId, value]) => {
        const reference = asReference(value);
        return reference ? [[layerId, reference]] : [];
      }))]).filter(([pageId]) => Boolean(pageId))),
      sprites: Object.fromEntries(Object.entries(document?.rig?.sprites ?? {}).map(([layerId, sprites]) => [layerId, sprites.map((sprite) => asReference(sprite.dataUrl))])),
    };
  }

  async resolve(reference: BinaryDocumentReference | undefined) {
    if (!reference || !this.resolver) return undefined;
    return this.resolver.resolve(reference.handleId);
  }

  resolveFrameLayer(frameId: string, layerId: string) {
    return this.resolve(this.frameLayerReference(frameId, layerId));
  }

  resolveComicPageLayer(pageId: string, layerId: string) {
    return this.resolve(this.comicPageLayerReference(pageId, layerId));
  }

  resolveSprite(layerId: string, index: number) {
    return this.resolve(this.spriteReference(layerId, index));
  }

  reset() {
    this.generation += 1;
    this.snapshot = undefined;
    this.resolver = undefined;
  }
}
