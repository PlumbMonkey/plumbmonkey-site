export const PMSTUDIO_FORMAT = "plumbmonkey-studio" as const;
export const PMSTUDIO_VERSION = 1 as const;
export const PMASSET_FORMAT = "plumbmonkey-asset" as const;
export const PMASSET_VERSION = 1 as const;

export type ImportMode = "copy" | "link" | "instance" | "reference";

export type BinaryHandle = {
  id: string;
  mediaType: string;
  byteLength: number;
  sha256: string;
  location:
    | { kind: "embedded"; path: string }
    | { kind: "external"; path: string }
    | { kind: "cache"; key: string };
};

export type AssetProvenance = {
  createdAt: string;
  creator?: string;
  source: {
    kind: "created" | "imported" | "generated" | "linked";
    uri?: string;
    sha256?: string;
  };
  license: {
    spdx?: string;
    label: string;
    attribution?: string;
    redistributable: "yes" | "no" | "unknown";
  };
  generator?: {
    id: string;
    version: string;
    seed?: number;
    parameters: Record<string, unknown>;
    blenderVersion?: string;
  };
};

export type ProjectAssetReference = {
  id: string;
  assetId: string;
  assetVersion: number;
  mode: ImportMode;
  sourcePath?: string;
  expectedSha256?: string;
};

export type PmStudioManifestV1 = {
  format: typeof PMSTUDIO_FORMAT;
  version: typeof PMSTUDIO_VERSION;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  application: { version: string };
  document: {
    path: string;
    format: "natural-media-document";
    version: 1;
    width: number;
    height: number;
  };
  binaries: BinaryHandle[];
  assets: ProjectAssetReference[];
  journal: {
    path: string;
    head: number;
    checkpoint: { sequence: number; path: string } | null;
  };
};

export type PmAssetManifestV1 = {
  format: typeof PMASSET_FORMAT;
  version: typeof PMASSET_VERSION;
  assetId: string;
  assetVersion: number;
  name: string;
  assetType: "image" | "material" | "model" | "scene" | "rig" | "animation" | "audio" | "generator" | "reference";
  createdAt: string;
  updatedAt: string;
  entrypoint: string;
  preview?: string;
  tags: string[];
  dependencies: Array<{ assetId: string; minimumVersion: number }>;
  binaries: BinaryHandle[];
  provenance: AssetProvenance;
};

export type PlannedNmlBinary = {
  id: string;
  jsonPointer: string;
  packagePath: string;
  mediaType: string;
  dataUrl: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, label: string) => {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return value;
};

const requireString = (value: unknown, label: string) => {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string.`);
  return value;
};

const requireNumber = (value: unknown, label: string, minimum = 0) => {
  if (!Number.isFinite(value) || Number(value) < minimum) throw new Error(`${label} must be a number of at least ${minimum}.`);
  return Number(value);
};

export const isSafePackagePath = (path: string) => {
  if (!path || path.startsWith("/") || path.startsWith("\\") || /^[a-zA-Z]:/.test(path) || path.includes("\\")) return false;
  const segments = path.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
};

const requirePackagePath = (value: unknown, label: string) => {
  const path = requireString(value, label);
  if (!isSafePackagePath(path)) throw new Error(`${label} must be a safe relative package path.`);
  return path;
};

export const parseBinaryHandle = (value: unknown, label = "Binary handle"): BinaryHandle => {
  const handle = requireRecord(value, label);
  requireString(handle.id, `${label}.id`);
  requireString(handle.mediaType, `${label}.mediaType`);
  requireNumber(handle.byteLength, `${label}.byteLength`);
  if (!/^[a-f\d]{64}$/i.test(requireString(handle.sha256, `${label}.sha256`))) throw new Error(`${label}.sha256 must contain 64 hexadecimal characters.`);
  const location = requireRecord(handle.location, `${label}.location`);
  if (location.kind === "embedded") requirePackagePath(location.path, `${label}.location.path`);
  else if (location.kind === "external") requireString(location.path, `${label}.location.path`);
  else if (location.kind === "cache") requireString(location.key, `${label}.location.key`);
  else throw new Error(`${label}.location.kind is unsupported.`);
  return value as BinaryHandle;
};

const validateCommonManifest = (manifest: Record<string, unknown>, binaryLabel: string) => {
  const binaries = Array.isArray(manifest.binaries) ? manifest.binaries : (() => { throw new Error(`${binaryLabel} must be an array.`); })();
  const handles = binaries.map((binary, index) => parseBinaryHandle(binary, `${binaryLabel}[${index}]`));
  if (new Set(handles.map((handle) => handle.id)).size !== handles.length) throw new Error(`${binaryLabel} contains duplicate ids.`);
};

export const parsePmStudioManifest = (value: unknown): PmStudioManifestV1 => {
  const manifest = requireRecord(value, "Project manifest");
  if (manifest.format !== PMSTUDIO_FORMAT || manifest.version !== PMSTUDIO_VERSION) throw new Error("This is not a supported .pmstudio manifest.");
  requireString(manifest.projectId, "Project manifest.projectId");
  requireString(manifest.title, "Project manifest.title");
  requireString(manifest.createdAt, "Project manifest.createdAt");
  requireString(manifest.updatedAt, "Project manifest.updatedAt");
  const application = requireRecord(manifest.application, "Project manifest.application");
  requireString(application.version, "Project manifest.application.version");
  const document = requireRecord(manifest.document, "Project manifest.document");
  requirePackagePath(document.path, "Project manifest.document.path");
  if (document.format !== "natural-media-document" || document.version !== 1) throw new Error("Project manifest.document format is unsupported.");
  requireNumber(document.width, "Project manifest.document.width", 1);
  requireNumber(document.height, "Project manifest.document.height", 1);
  const assets = Array.isArray(manifest.assets) ? manifest.assets : (() => { throw new Error("Project manifest.assets must be an array."); })();
  assets.forEach((asset, index) => {
    const reference = requireRecord(asset, `Project manifest.assets[${index}]`);
    requireString(reference.id, `Project manifest.assets[${index}].id`);
    requireString(reference.assetId, `Project manifest.assets[${index}].assetId`);
    requireNumber(reference.assetVersion, `Project manifest.assets[${index}].assetVersion`, 1);
    if (!["copy", "link", "instance", "reference"].includes(String(reference.mode))) throw new Error(`Project manifest.assets[${index}].mode is unsupported.`);
  });
  const journal = requireRecord(manifest.journal, "Project manifest.journal");
  requirePackagePath(journal.path, "Project manifest.journal.path");
  requireNumber(journal.head, "Project manifest.journal.head");
  if (journal.checkpoint !== null) {
    const checkpoint = requireRecord(journal.checkpoint, "Project manifest.journal.checkpoint");
    requireNumber(checkpoint.sequence, "Project manifest.journal.checkpoint.sequence");
    requirePackagePath(checkpoint.path, "Project manifest.journal.checkpoint.path");
  }
  validateCommonManifest(manifest, "Project manifest.binaries");
  return value as PmStudioManifestV1;
};

export const parsePmAssetManifest = (value: unknown): PmAssetManifestV1 => {
  const manifest = requireRecord(value, "Asset manifest");
  if (manifest.format !== PMASSET_FORMAT || manifest.version !== PMASSET_VERSION) throw new Error("This is not a supported .pmasset manifest.");
  requireString(manifest.assetId, "Asset manifest.assetId");
  requireNumber(manifest.assetVersion, "Asset manifest.assetVersion", 1);
  requireString(manifest.name, "Asset manifest.name");
  if (!["image", "material", "model", "scene", "rig", "animation", "audio", "generator", "reference"].includes(String(manifest.assetType))) throw new Error("Asset manifest.assetType is unsupported.");
  requireString(manifest.createdAt, "Asset manifest.createdAt");
  requireString(manifest.updatedAt, "Asset manifest.updatedAt");
  requirePackagePath(manifest.entrypoint, "Asset manifest.entrypoint");
  if (manifest.preview !== undefined) requirePackagePath(manifest.preview, "Asset manifest.preview");
  if (!Array.isArray(manifest.tags) || !manifest.tags.every((tag) => typeof tag === "string")) throw new Error("Asset manifest.tags must be strings.");
  if (!Array.isArray(manifest.dependencies)) throw new Error("Asset manifest.dependencies must be an array.");
  manifest.dependencies.forEach((dependency, index) => {
    const item = requireRecord(dependency, `Asset manifest.dependencies[${index}]`);
    requireString(item.assetId, `Asset manifest.dependencies[${index}].assetId`);
    requireNumber(item.minimumVersion, `Asset manifest.dependencies[${index}].minimumVersion`, 1);
  });
  const provenance = requireRecord(manifest.provenance, "Asset manifest.provenance");
  requireString(provenance.createdAt, "Asset manifest.provenance.createdAt");
  const source = requireRecord(provenance.source, "Asset manifest.provenance.source");
  if (!["created", "imported", "generated", "linked"].includes(String(source.kind))) throw new Error("Asset manifest.provenance.source.kind is unsupported.");
  const license = requireRecord(provenance.license, "Asset manifest.provenance.license");
  requireString(license.label, "Asset manifest.provenance.license.label");
  if (!["yes", "no", "unknown"].includes(String(license.redistributable))) throw new Error("Asset manifest.provenance.license.redistributable is unsupported.");
  validateCommonManifest(manifest, "Asset manifest.binaries");
  return value as PmAssetManifestV1;
};

const packageSegment = (value: unknown, fallback: string) => {
  const normalized = String(value ?? "").trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
};

const jsonPointerSegment = (value: string) => value.replace(/~/g, "~0").replace(/\//g, "~1");

const dataUrlMediaType = (dataUrl: string) => /^data:([^;,]+)[;,]/.exec(dataUrl)?.[1] ?? "application/octet-stream";
const mediaTypeExtension = (mediaType: string) => mediaType === "image/png" ? "png" : mediaType === "image/jpeg" ? "jpg" : "bin";

export const planNmlBinaryMigration = (value: unknown): PlannedNmlBinary[] => {
  const project = requireRecord(value, ".nml project");
  if (project.format !== "natural-media-lab" || project.version !== 1 || !Array.isArray(project.layers)) throw new Error("This is not a supported .nml project.");
  const planned: PlannedNmlBinary[] = [];
  const add = (dataUrl: unknown, id: string, jsonPointer: string, basePath: string) => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return;
    const mediaType = dataUrlMediaType(dataUrl);
    planned.push({ id, jsonPointer, packagePath: `${basePath}.${mediaTypeExtension(mediaType)}`, mediaType, dataUrl });
  };
  project.layers.forEach((layerValue, layerIndex) => {
    const layer = requireRecord(layerValue, `.nml project.layers[${layerIndex}]`);
    const layerId = packageSegment(layer.id, `layer-${layerIndex + 1}`);
    add(layer.dataUrl, `nml-layer-${layerId}-pixels`, `/layers/${layerIndex}/dataUrl`, `binary/layers/${layerId}/pixels`);
    if (isRecord(layer.simulation)) {
      add(layer.simulation.wetMapUrl, `nml-layer-${layerId}-wet`, `/layers/${layerIndex}/simulation/wetMapUrl`, `binary/layers/${layerId}/wet`);
      add(layer.simulation.heightMapUrl, `nml-layer-${layerId}-height`, `/layers/${layerIndex}/simulation/heightMapUrl`, `binary/layers/${layerId}/height`);
    }
  });
  const animation = isRecord(project.animation) ? project.animation : undefined;
  if (animation && Array.isArray(animation.frames)) animation.frames.forEach((frameValue, frameIndex) => {
    const frame = requireRecord(frameValue, `.nml project.animation.frames[${frameIndex}]`);
    const frameId = packageSegment(frame.id, `frame-${frameIndex + 1}`);
    if (isRecord(frame.layerData)) Object.entries(frame.layerData).forEach(([layerId, dataUrl]) => add(dataUrl, `nml-frame-${frameId}-${packageSegment(layerId, "layer")}`, `/animation/frames/${frameIndex}/layerData/${jsonPointerSegment(layerId)}`, `binary/frames/${frameId}/${packageSegment(layerId, "layer")}`));
  });
  const comic = isRecord(project.comic) ? project.comic : undefined;
  if (comic && Array.isArray(comic.pages)) comic.pages.forEach((pageValue, pageIndex) => {
    const page = requireRecord(pageValue, `.nml project.comic.pages[${pageIndex}]`);
    const pageId = packageSegment(page.id, `page-${pageIndex + 1}`);
    if (isRecord(page.layerData)) Object.entries(page.layerData).forEach(([layerId, dataUrl]) => add(dataUrl, `nml-page-${pageId}-${packageSegment(layerId, "layer")}`, `/comic/pages/${pageIndex}/layerData/${jsonPointerSegment(layerId)}`, `binary/pages/${pageId}/${packageSegment(layerId, "layer")}`));
  });
  const rig = isRecord(project.rig) ? project.rig : undefined;
  if (rig && isRecord(rig.sprites)) Object.entries(rig.sprites).forEach(([layerId, variantsValue]) => {
    if (!Array.isArray(variantsValue)) return;
    variantsValue.forEach((variantValue, variantIndex) => {
      const variant = requireRecord(variantValue, `.nml project.rig.sprites.${layerId}[${variantIndex}]`);
      const safeLayerId = packageSegment(layerId, "layer");
      add(variant.dataUrl, `nml-sprite-${safeLayerId}-${variantIndex + 1}`, `/rig/sprites/${jsonPointerSegment(layerId)}/${variantIndex}/dataUrl`, `binary/sprites/${safeLayerId}/${variantIndex + 1}`);
    });
  });
  return planned;
};
