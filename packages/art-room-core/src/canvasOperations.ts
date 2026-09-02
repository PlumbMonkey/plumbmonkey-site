import type { BlendMode } from "./documentModel";
import type { RasterRect } from "./rasterSurface";

export type CanvasMergeLayer = {
  canvas: CanvasImageSource;
  opacity: number;
  blendMode: BlendMode;
};

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const context2d = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  return context;
};

export const mergeCanvasLayers = (width: number, height: number, layers: CanvasMergeLayer[]) => {
  const output = createCanvas(width, height);
  const context = context2d(output);
  layers.forEach((layer) => {
    context.globalAlpha = layer.opacity;
    context.globalCompositeOperation = layer.blendMode;
    context.drawImage(layer.canvas, 0, 0);
  });
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  return output;
};

export const flipCanvasLayer = (source: CanvasImageSource, width: number, height: number, vertical = false) => {
  const output = createCanvas(width, height);
  const context = context2d(output);
  context.translate(vertical ? 0 : width, vertical ? height : 0);
  context.scale(vertical ? 1 : -1, vertical ? -1 : 1);
  context.drawImage(source, 0, 0);
  return output;
};

export const resizeCanvasLayer = (source: CanvasImageSource | undefined, width: number, height: number) => {
  const output = createCanvas(width, height);
  if (source) context2d(output).drawImage(source, 0, 0, width, height);
  return output;
};

export const cropCanvasLayer = (source: CanvasImageSource | undefined, selection: RasterRect) => {
  const width = Math.max(1, Math.round(selection.width));
  const height = Math.max(1, Math.round(selection.height));
  const output = createCanvas(width, height);
  if (source) context2d(output).drawImage(source, selection.x, selection.y, selection.width, selection.height, 0, 0, width, height);
  return output;
};

export const fillCanvasLinearGradient = (canvas: HTMLCanvasElement, from: string, to: string) => {
  const context = context2d(canvas);
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
};

export const flattenCanvas = (source: HTMLCanvasElement, color: string) => {
  const output = createCanvas(source.width, source.height);
  const context = context2d(output);
  context.fillStyle = color;
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(source, 0, 0);
  return output;
};
