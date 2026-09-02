import type { ComicPage, ComicText, NaturalMediaDocument } from "./documentModel";
import { comicPanelSourceTransform, comicRectToPixels, comicTextPosition, wrapComicText } from "./comicLayout";

export type ComicCanvasResolver = (layerId: string) => HTMLCanvasElement | undefined;

export type ComicRenderOptions = {
  activeCanvas?: ComicCanvasResolver;
  bleedPixels?: number;
  cropMarks?: boolean;
};

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const loadImage = (url: string) => new Promise<HTMLImageElement | null>((resolve) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = url;
});

export const pagesWithActiveComicState = (source: NaturalMediaDocument) =>
  source.comic.pages.map((page) => page.id === source.comic.activePageId ? {
    ...page,
    panels: source.comic.panels.map((panel) => ({ ...panel })),
    text: source.comic.text.map((item) => ({ ...item })),
  } : page);

export const renderPageArtwork = async (
  source: NaturalMediaDocument,
  pageId: string,
  activeCanvas?: ComicCanvasResolver,
) => {
  const output = createCanvas(source.width, source.height);
  const context = output.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  const page = source.comic.pages.find((item) => item.id === pageId);
  if (source.background === "paper") {
    context.fillStyle = "#f1ede3";
    context.fillRect(0, 0, output.width, output.height);
  }
  for (const layer of source.layers) {
    if (!layer.visible) continue;
    const live = pageId === source.comic.activePageId ? activeCanvas?.(layer.id) : undefined;
    const image = live ?? await loadImage(page?.layerData[layer.id] ?? "");
    if (!image) continue;
    context.globalAlpha = layer.opacity;
    context.globalCompositeOperation = layer.blendMode;
    context.drawImage(image, 0, 0);
  }
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  return output;
};

const drawComicText = (context: CanvasRenderingContext2D, item: ComicText, pageWidth: number, pageHeight: number, offset: number) => {
  const rect = comicRectToPixels(item, pageWidth, pageHeight, offset, offset);
  context.save();
  context.beginPath();
  if (item.type === "caption") context.rect(rect.x, rect.y, rect.width, rect.height);
  else context.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2, rect.height / 2, 0, 0, Math.PI * 2);
  context.fillStyle = item.type === "caption" ? "#171816" : "#fffdf8";
  context.fill();
  context.strokeStyle = "#171816";
  context.lineWidth = Math.max(2, pageWidth / 500);
  context.stroke();

  if (item.type !== "caption") {
    const tailX = rect.x + item.tailX / 100 * rect.width;
    const tailY = rect.y + item.tailY / 100 * rect.height;
    if (item.type === "speech") {
      context.beginPath();
      context.moveTo(rect.x + rect.width * .42, rect.y + rect.height * .82);
      context.lineTo(rect.x + rect.width * .58, rect.y + rect.height * .82);
      context.lineTo(tailX, tailY);
      context.closePath();
      context.fill();
      context.stroke();
    } else {
      [0, 1, 2].forEach((index) => {
        const amount = (index + 1) / 4;
        context.beginPath();
        context.arc(rect.x + rect.width / 2 + (tailX - (rect.x + rect.width / 2)) * amount, rect.y + rect.height / 2 + (tailY - (rect.y + rect.height / 2)) * amount, Math.max(3, rect.width * (.055 - index * .012)), 0, Math.PI * 2);
        context.fill();
        context.stroke();
      });
    }
  }

  const families = { sans: "Arial", serif: "Georgia", hand: "'Comic Sans MS'" };
  const fontSize = Math.max(12, Math.round(pageWidth * item.fontSize / 1400));
  const lineHeight = Math.max(16, pageWidth * item.fontSize / 1150);
  context.fillStyle = item.type === "caption" ? "#fff" : "#171816";
  context.font = `700 ${fontSize}px ${families[item.fontFamily]}`;
  context.textAlign = item.align;
  context.textBaseline = "middle";
  const lines = wrapComicText(item.text, rect.width * .82, (value) => context.measureText(value).width);
  const position = comicTextPosition(item, rect, lines.length, lineHeight);
  lines.forEach((line, index) => context.fillText(line, position.x, position.firstLineY + index * lineHeight));
  context.restore();
};

export const renderComicPage = async (
  source: NaturalMediaDocument,
  page: ComicPage,
  options: ComicRenderOptions = {},
) => {
  const bleed = Math.max(0, Math.round(options.bleedPixels ?? 0));
  const output = createCanvas(source.width + bleed * 2, source.height + bleed * 2);
  const context = output.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  if (bleed > 0) {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, output.width, output.height);
  }
  context.drawImage(await renderPageArtwork(source, page.id, options.activeCanvas), bleed, bleed);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.lineJoin = "round";
  context.strokeStyle = "#171816";
  context.lineWidth = Math.max(3, source.width * source.comic.gutter / 500);

  for (const panel of page.panels) {
    const rect = comicRectToPixels(panel, source.width, source.height, bleed, bleed);
    if (panel.sourcePageId) {
      const panelSource = await renderPageArtwork(source, panel.sourcePageId, options.activeCanvas);
      const transform = comicPanelSourceTransform(panel, rect);
      context.save();
      context.beginPath();
      context.rect(rect.x, rect.y, rect.width, rect.height);
      context.clip();
      context.translate(transform.centerX, transform.centerY);
      context.scale(transform.scale, transform.scale);
      context.drawImage(panelSource, -rect.width / 2, -rect.height / 2, rect.width, rect.height);
      context.restore();
    }
    context.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }
  page.text.forEach((item) => drawComicText(context, item, source.width, source.height, bleed));

  if (options.cropMarks && bleed > 0) {
    context.strokeStyle = "#000";
    context.lineWidth = 1;
    const mark = Math.max(8, bleed * .75);
    [[bleed, bleed], [output.width - bleed, bleed], [bleed, output.height - bleed], [output.width - bleed, output.height - bleed]].forEach(([x, y]) => {
      context.beginPath();
      context.moveTo(x - mark, y);
      context.lineTo(x + mark, y);
      context.moveTo(x, y - mark);
      context.lineTo(x, y + mark);
      context.stroke();
    });
  }
  return output;
};
