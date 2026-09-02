import type { AnimationFrame } from "./documentModel";

export type LayerTransform = AnimationFrame["transforms"][string];

export const DEFAULT_LAYER_TRANSFORM: LayerTransform = {
  x: 0,
  y: 0,
  scale: 100,
  rotation: 0,
  opacity: 100,
  easing: "linear",
};

export const easeTimelineValue = (value: number, easing: LayerTransform["easing"]) =>
  easing === "hold" ? 0
    : easing === "ease-in" ? value * value
      : easing === "ease-out" ? 1 - (1 - value) ** 2
        : easing === "ease-in-out"
          ? value < .5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2
          : value;

export const resolveLayerTransform = (
  frames: AnimationFrame[],
  index: number,
  layerId: string,
): LayerTransform => {
  const exact = frames[index]?.transforms[layerId];
  if (exact) return { ...exact };

  let previous = -1;
  let next = -1;
  for (let cursor = index - 1; cursor >= 0; cursor--) {
    if (frames[cursor]?.transforms[layerId]) {
      previous = cursor;
      break;
    }
  }
  for (let cursor = index + 1; cursor < frames.length; cursor++) {
    if (frames[cursor]?.transforms[layerId]) {
      next = cursor;
      break;
    }
  }

  if (previous < 0 && next < 0) return { ...DEFAULT_LAYER_TRANSFORM };
  if (previous < 0) return { ...DEFAULT_LAYER_TRANSFORM, ...frames[next].transforms[layerId] };

  const from = { ...DEFAULT_LAYER_TRANSFORM, ...frames[previous].transforms[layerId] };
  if (next < 0 || from.easing === "hold") return from;

  const to = { ...DEFAULT_LAYER_TRANSFORM, ...frames[next].transforms[layerId] };
  const amount = easeTimelineValue((index - previous) / (next - previous), from.easing);
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
    scale: from.scale + (to.scale - from.scale) * amount,
    rotation: from.rotation + (to.rotation - from.rotation) * amount,
    opacity: from.opacity + (to.opacity - from.opacity) * amount,
    easing: from.easing,
  };
};

export const framePlaybackDelay = (fps: number, hold = 1) => {
  const safeFps = Math.max(1, Math.min(240, Number.isFinite(fps) ? fps : 1));
  const safeHold = Math.max(1, Number.isFinite(hold) ? hold : 1);
  return 1000 / safeFps * safeHold;
};
