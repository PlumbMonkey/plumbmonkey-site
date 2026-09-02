export type RasterExportFormat = "png" | "jpeg" | "webp";
export type ComicPrintProfile = "a4" | "letter";

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export const safeExportStem = (name: string, fallback = "Untitled") => {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  if (!cleaned || WINDOWS_RESERVED_NAMES.test(cleaned)) return fallback;
  return cleaned.slice(0, 120);
};

export const planRasterExport = (
  name: string,
  format: RasterExportFormat,
  background: "transparent" | "paper",
  suffix = "",
) => {
  const extension = format === "jpeg" ? "jpg" : format;
  return {
    mediaType: `image/${format}`,
    quality: format === "png" ? undefined : .92,
    flattenColor: format !== "png" && background === "transparent" ? "#f1ede3" : undefined,
    filename: `${safeExportStem(name)}${suffix}.${extension}`,
  };
};

export const planGifExport = (width: number, height: number, maximumWidth = 480) => {
  if (![width, height, maximumWidth].every((value) => Number.isFinite(value) && value > 0)) throw new Error("GIF dimensions must be positive numbers.");
  const scale = Math.min(1, maximumWidth / width);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
};

export const planComicPdfExport = (
  profile: ComicPrintProfile,
  bleedMm: number,
  artworkWidth: number,
) => {
  if (!Number.isFinite(bleedMm) || bleedMm < 0 || !Number.isFinite(artworkWidth) || artworkWidth <= 0) throw new Error("PDF export dimensions are invalid.");
  const page = profile === "a4"
    ? { width: 595.28, height: 841.89, widthMm: 210 }
    : { width: 612, height: 792, widthMm: 215.9 };
  const bleedPoints = bleedMm / 25.4 * 72;
  const bleedPixels = Math.round(artworkWidth / page.widthMm * bleedMm);
  return {
    pageWidth: page.width + bleedPoints * 2,
    pageHeight: page.height + bleedPoints * 2,
    bleedPoints,
    bleedPixels,
  };
};
