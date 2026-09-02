import type { ComicPanel, ComicText } from "./documentModel";

export type PixelRect = { x: number; y: number; width: number; height: number };
export type ComicTransformMode = "move" | "resize" | "crop";
export type ComicRect = Pick<ComicPanel, "x" | "y" | "width" | "height" | "cropX" | "cropY">;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export const getComicTransformPatch = (
  base: ComicRect,
  mode: ComicTransformMode,
  deltaXPercent: number,
  deltaYPercent: number,
): Partial<ComicRect> => {
  if (mode === "crop") {
    return { cropX: (base.cropX ?? 0) + deltaXPercent, cropY: (base.cropY ?? 0) + deltaYPercent };
  }
  if (mode === "move") {
    return {
      x: clamp(base.x + deltaXPercent, 0, 100 - base.width),
      y: clamp(base.y + deltaYPercent, 0, 100 - base.height),
    };
  }
  return {
    width: clamp(base.width + deltaXPercent, 5, 100 - base.x),
    height: clamp(base.height + deltaYPercent, 5, 100 - base.y),
  };
};

export const comicRectToPixels = (
  item: Pick<ComicPanel, "x" | "y" | "width" | "height">,
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 0,
): PixelRect => ({
  x: offsetX + item.x / 100 * width,
  y: offsetY + item.y / 100 * height,
  width: item.width / 100 * width,
  height: item.height / 100 * height,
});

export const comicPanelSourceTransform = (panel: ComicPanel, rect: PixelRect) => ({
  centerX: rect.x + rect.width / 2 + (panel.cropX ?? 0) / 100 * rect.width,
  centerY: rect.y + rect.height / 2 + (panel.cropY ?? 0) / 100 * rect.height,
  scale: Math.max(.01, (panel.zoom ?? 100) / 100),
});

export const wrapComicText = (
  text: string,
  maximumWidth: number,
  measure: (value: string) => number,
  maximumLines = 4,
) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const candidate = `${line} ${word}`.trim();
    if (line && measure(candidate) > maximumWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, Math.max(1, maximumLines));
};

export const comicTextPosition = (item: ComicText, rect: PixelRect, lineCount: number, lineHeight: number) => ({
  x: item.align === "left" ? rect.x + rect.width * .1 : item.align === "right" ? rect.x + rect.width * .9 : rect.x + rect.width / 2,
  firstLineY: rect.y + rect.height / 2 - (Math.max(1, lineCount) - 1) / 2 * lineHeight,
});
