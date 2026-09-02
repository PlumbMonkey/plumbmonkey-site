import type { AnimationFrame, NaturalMediaDocument } from "./documentModel";
import { resolveLayerTransform } from "./animation";
import { poseRotation } from "./rig";

export type AnimationLayerSourceResolver = (
  layerId: string,
  sourceUrl: string,
  frame: AnimationFrame,
) => Promise<CanvasImageSource | null>;

export type AnimationRenderOptions = {
  resolveLayerSource?: AnimationLayerSourceResolver;
};

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const loadImage = (url: string) => new Promise<HTMLImageElement | null>((resolve) => {
  if (!url) return resolve(null);
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = url;
});

export const animationCameraState = (source: NaturalMediaDocument, frameId: string) => {
  const frameIndex = source.animation.frames.findIndex((frame) => frame.id === frameId);
  if (frameIndex < 0) throw new Error(`Animation frame does not exist: ${frameId}`);
  const frame = source.animation.frames[frameIndex];
  const camera = frame.camera ?? { x: 0, y: 0, zoom: 100, rotation: 0, shake: 0 };
  return {
    frame,
    frameIndex,
    camera,
    shakeX: Math.sin(frameIndex * 12.9898) * camera.shake,
    shakeY: Math.cos(frameIndex * 8.233) * camera.shake,
  };
};

export const animationLayerSourceUrl = (source: NaturalMediaDocument, frame: AnimationFrame, layerId: string) => {
  const variants = source.rig.sprites[layerId] ?? [];
  return variants[frame.spriteExposure[layerId] ?? -1]?.dataUrl ?? frame.layerData[layerId] ?? "";
};

export const renderAnimationFrame = async (
  source: NaturalMediaDocument,
  frameId: string,
  options: AnimationRenderOptions = {},
) => {
  const output = createCanvas(source.width, source.height);
  const context = output.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  if (source.background === "paper") {
    context.fillStyle = "#f1ede3";
    context.fillRect(0, 0, output.width, output.height);
  }
  const { frame, frameIndex, camera, shakeX, shakeY } = animationCameraState(source, frameId);
  context.save();
  context.translate(source.width / 2 + camera.x + shakeX, source.height / 2 + camera.y + shakeY);
  context.rotate(camera.rotation * Math.PI / 180);
  context.scale(camera.zoom / 100, camera.zoom / 100);
  context.translate(-source.width / 2, -source.height / 2);

  for (const layer of source.layers) {
    if (!layer.visible) continue;
    const sourceUrl = animationLayerSourceUrl(source, frame, layer.id);
    const image = options.resolveLayerSource
      ? await options.resolveLayerSource(layer.id, sourceUrl, frame)
      : await loadImage(sourceUrl);
    if (!image) continue;
    const transform = resolveLayerTransform(source.animation.frames, frameIndex, layer.id);
    context.save();
    context.globalAlpha = layer.opacity * transform.opacity / 100;
    context.globalCompositeOperation = layer.blendMode;
    context.translate(source.width / 2 + transform.x, source.height / 2 + transform.y);
    context.rotate(transform.rotation * Math.PI / 180);
    context.scale(transform.scale / 100, transform.scale / 100);
    const binding = source.rig.layerBindings[layer.id];
    if (binding) {
      const pivotX = binding.pivotX - source.width / 2;
      const pivotY = binding.pivotY - source.height / 2;
      context.translate(pivotX, pivotY);
      context.rotate(poseRotation(source, frame, binding.boneId) * Math.PI / 180);
      context.translate(-pivotX, -pivotY);
    }
    context.drawImage(image, -source.width / 2, -source.height / 2);
    context.restore();
  }
  context.restore();
  return output;
};

export const renderAnimationImageData = async (
  source: NaturalMediaDocument,
  width: number,
  height: number,
  options: AnimationRenderOptions = {},
) => {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error("Animation output dimensions must be positive integers.");
  const images: ImageData[] = [];
  for (const frame of source.animation.frames) {
    const rendered = await renderAnimationFrame(source, frame.id, options);
    const reduced = createCanvas(width, height);
    const context = reduced.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable.");
    context.drawImage(rendered, 0, 0, width, height);
    images.push(context.getImageData(0, 0, width, height));
  }
  return images;
};
