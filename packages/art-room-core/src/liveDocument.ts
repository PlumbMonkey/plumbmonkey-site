import type { NaturalMediaDocument } from "./documentModel";
import type { TileSetDescriptorV1 } from "./binaryStorage";
import { parseWorkingDocument, projectWorkingDocument } from "./workingDocument";
import type { WorkingDocumentV1 } from "./workingDocument";

export type RasterLayerDescriptors = Record<string, TileSetDescriptorV1 | undefined>;

export type LiveDocumentState = {
  document: NaturalMediaDocument;
  working: WorkingDocumentV1;
};

const assertMatchingStructure = (document: NaturalMediaDocument, working: WorkingDocumentV1) => {
  if (working.sourceFormat !== document.format || working.sourceVersion !== document.version) throw new Error("Working document source does not match the compatibility document.");
  if (working.width !== document.width || working.height !== document.height) throw new Error("Working document dimensions do not match the compatibility document.");
  const documentLayerIds = document.layers.map((layer) => layer.id);
  const workingLayerIds = working.layers.map((layer) => layer.id);
  if (documentLayerIds.length !== workingLayerIds.length || documentLayerIds.some((id, index) => id !== workingLayerIds[index])) throw new Error("Working document layers do not match the compatibility document.");
};

export const createLiveDocumentState = (
  document: NaturalMediaDocument,
  rasterLayers: RasterLayerDescriptors = {},
): LiveDocumentState => ({ document, working: projectWorkingDocument(document, rasterLayers) });

export const restoreLiveDocumentState = (
  document: NaturalMediaDocument,
  working?: WorkingDocumentV1,
): LiveDocumentState => {
  if (!working) return createLiveDocumentState(document);
  const parsed = parseWorkingDocument(working);
  assertMatchingStructure(document, parsed);
  return { document, working: parsed };
};

export const updateLiveDocumentState = (
  current: LiveDocumentState,
  update: NaturalMediaDocument | ((document: NaturalMediaDocument) => NaturalMediaDocument),
  rasterLayers: RasterLayerDescriptors = {},
): LiveDocumentState => {
  const document = typeof update === "function" ? update(current.document) : update;
  return createLiveDocumentState(document, rasterLayers);
};

export const refreshLiveDocumentRaster = (
  current: LiveDocumentState,
  rasterLayers: RasterLayerDescriptors,
): LiveDocumentState => createLiveDocumentState(current.document, rasterLayers);
