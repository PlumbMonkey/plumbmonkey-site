import { NaturalMediaDocument, PaintLayer } from "./documentModel";

export type DocumentSnapshotSources = {
  layerDataUrl(layer: PaintLayer): string | undefined;
  simulationDataUrl(layer: PaintLayer, kind: "wet" | "height"): string | undefined;
  now?: () => string;
};

export const captureDocumentSnapshot = (
  document: NaturalMediaDocument,
  sources: DocumentSnapshotSources,
): NaturalMediaDocument => {
  const layers = document.layers.map((layer) => ({
    ...layer,
    dataUrl: sources.layerDataUrl(layer) ?? layer.dataUrl,
    simulation: {
      wetMapUrl: sources.simulationDataUrl(layer, "wet") ?? layer.simulation.wetMapUrl,
      heightMapUrl: sources.simulationDataUrl(layer, "height") ?? layer.simulation.heightMapUrl,
    },
  }));
  const layerData = Object.fromEntries(layers.map((layer) => [layer.id, layer.dataUrl]));
  return {
    ...document,
    layers,
    animation: {
      ...document.animation,
      frames: document.animation.frames.map((frame) => frame.id === document.animation.activeFrameId ? { ...frame, layerData: { ...layerData } } : frame),
    },
    comic: {
      ...document.comic,
      pages: document.comic.pages.map((page) => page.id === document.comic.activePageId ? {
        ...page,
        panels: document.comic.panels.map((panel) => ({ ...panel })),
        text: document.comic.text.map((item) => ({ ...item })),
        layerData: { ...layerData },
      } : page),
    },
    updatedAt: (sources.now ?? (() => new Date().toISOString()))(),
  };
};
