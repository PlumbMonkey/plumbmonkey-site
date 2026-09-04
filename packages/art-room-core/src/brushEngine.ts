export type RasterStrokePoint = { x: number; y: number };
export type BrushPreset = {
  id: string;
  name: string;
  mark: string;
  opacity: number;
  grain: number;
  flow: number;
  wetness: number;
  scatter: number;
  shape?: "round" | "flat" | "pixel" | "airbrush";
};
export type BrushSettings = {
  size: number;
  color: string;
  flow: number;
  wetness: number;
  grain: number;
  scatter: number;
  pressure: number;
  mirror: boolean;
  canvasWidth: number;
  eraser: boolean;
  effects: number;
  seed: number;
  wetContext?: CanvasRenderingContext2D;
  heightContext?: CanvasRenderingContext2D;
  absorbency: number;
  separation: number;
};

export const seededRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
};

export const BRUSHES: BrushPreset[] = [
  { id: "pencil", name: "Pencil", mark: "P", opacity: .72, grain: .35, flow: .75, wetness: 0, scatter: .08 },
  { id: "graphite", name: "Graphite", mark: "G", opacity: .58, grain: .55, flow: .68, wetness: 0, scatter: .1 },
  { id: "charcoal", name: "Charcoal", mark: "C", opacity: .42, grain: .8, flow: .55, wetness: 0, scatter: .28 },
  { id: "ink", name: "Ink pen", mark: "I", opacity: .95, grain: .03, flow: .95, wetness: .15, scatter: 0 },
  { id: "calligraphy", name: "Calligraphy", mark: "Ca", opacity: .9, grain: .02, flow: .9, wetness: .12, scatter: 0, shape: "flat" },
  { id: "marker", name: "Marker", mark: "M", opacity: .94, grain: .01, flow: .96, wetness: .03, scatter: 0, shape: "flat" },
  { id: "watercolor", name: "Watercolor", mark: "W", opacity: .18, grain: .2, flow: .45, wetness: .85, scatter: .08 },
  { id: "acrylic", name: "Acrylic", mark: "A", opacity: .72, grain: .25, flow: .78, wetness: .3, scatter: .08 },
  { id: "oil", name: "Oil paint", mark: "O", opacity: .82, grain: .42, flow: .7, wetness: .58, scatter: .05, shape: "flat" },
  { id: "palette-knife", name: "Palette knife", mark: "K", opacity: .88, grain: .18, flow: .78, wetness: .45, scatter: .02, shape: "flat" },
  { id: "pastel", name: "Pastel", mark: "Pa", opacity: .5, grain: .55, flow: .62, wetness: 0, scatter: .2 },
  { id: "chalk", name: "Chalk", mark: "Ch", opacity: .46, grain: .72, flow: .55, wetness: 0, scatter: .3 },
  { id: "airbrush", name: "Airbrush", mark: "Ai", opacity: .15, grain: 0, flow: .3, wetness: .1, scatter: .75, shape: "airbrush" },
  { id: "pixel", name: "Pixel brush", mark: "Px", opacity: 1, grain: 0, flow: 1, wetness: 0, scatter: 0, shape: "pixel" },
  { id: "smudge", name: "Finger smudge", mark: "S", opacity: .55, grain: 0, flow: .45, wetness: .6, scatter: 0 },
  { id: "eraser", name: "Eraser", mark: "E", opacity: 1, grain: 0, flow: 1, wetness: 0, scatter: 0 },
];

export function renderBrushStroke(
  context: CanvasRenderingContext2D,
  from: RasterStrokePoint,
  to: RasterStrokePoint,
  preset: BrushPreset,
  settings: BrushSettings,
) {
  const pressureSize = settings.size * (.3 + settings.pressure * .9);
  const opacity = preset.opacity * settings.flow;
  const random = seededRandom(settings.seed);
  const paintLine = (startX: number, endX: number) => {
    if (preset.id === "smudge" || preset.id === "palette-knife") {
      const radius = Math.max(2, Math.round(pressureSize));
      const sx = Math.max(0, Math.round(startX - radius)), sy = Math.max(0, Math.round(from.y - radius));
      const width = Math.min(radius * 2, context.canvas.width - sx), height = Math.min(radius * 2, context.canvas.height - sy);
      if (width > 0 && height > 0) {
        const patch = document.createElement("canvas"); patch.width = width; patch.height = height;
        patch.getContext("2d")?.drawImage(context.canvas, sx, sy, width, height, 0, 0, width, height);
        context.save(); context.globalAlpha = preset.id === "palette-knife" ? .55 + settings.effects * .3 : .18 + settings.effects * .35;
        context.filter = preset.id === "palette-knife" ? "none" : `blur(${Math.max(1, settings.effects * 3)}px)`;
        context.drawImage(patch, endX - radius, to.y - radius); context.restore();
        if (preset.id === "palette-knife" && settings.heightContext) {
          settings.heightContext.save(); settings.heightContext.strokeStyle = "#ffffff";
          settings.heightContext.globalAlpha = .35 + settings.effects * .55; settings.heightContext.lineWidth = pressureSize;
          settings.heightContext.beginPath(); settings.heightContext.moveTo(startX, from.y); settings.heightContext.lineTo(endX, to.y);
          settings.heightContext.stroke(); settings.heightContext.restore();
        }
      }
      return;
    }
    context.save();
    context.globalCompositeOperation = settings.eraser ? "destination-out" : "source-over";
    context.strokeStyle = settings.color;
    context.fillStyle = settings.color;
    context.globalAlpha = opacity;
    context.lineCap = preset.shape === "pixel" || preset.id === "marker" ? "butt" : "round";
    context.lineJoin = preset.shape === "pixel" ? "miter" : "round";
    context.lineWidth = preset.id === "marker" ? pressureSize * .85 : preset.shape === "flat" ? pressureSize * .55 : pressureSize;
    if (settings.wetness > .15 && !settings.eraser) {
      context.shadowColor = settings.color;
      context.shadowBlur = pressureSize * settings.wetness * .32;
    }
    if (preset.id === "oil" && settings.effects > .05) {
      const bristles = Math.max(3, Math.round(5 + settings.effects * 9));
      for (let i = 0; i < bristles; i++) {
        const offset = (i / (bristles - 1) - .5) * pressureSize;
        context.globalAlpha = opacity * (.45 + random() * .55);
        context.lineWidth = Math.max(1, pressureSize / bristles * (.45 + random()));
        context.strokeStyle = i % 4 === 0 ? "#ffffff" : settings.color;
        context.beginPath(); context.moveTo(startX, from.y + offset); context.lineTo(endX, to.y + offset); context.stroke();
      }
    } else if (preset.shape === "pixel") {
      const unit = Math.max(1, Math.round(pressureSize));
      context.fillRect(Math.round(endX / unit) * unit, Math.round(to.y / unit) * unit, unit, unit);
    } else {
      context.beginPath(); context.moveTo(startX, from.y); context.lineTo(endX, to.y); context.stroke();
    }
    const distance = Math.hypot(endX - startX, to.y - from.y);
    const particles = Math.min(120, Math.ceil(distance * (settings.grain + settings.scatter * .7)));
    for (let i = 0; i < particles && !settings.eraser; i++) {
      const t = random(), spread = pressureSize * (.15 + settings.scatter);
      const x = startX + (endX - startX) * t + (random() - .5) * spread;
      const y = from.y + (to.y - from.y) * t + (random() - .5) * spread;
      const dustBoost = preset.id === "charcoal" || preset.id === "chalk" ? 1 + settings.effects * 2 : 1;
      const radius = preset.shape === "airbrush" ? random() * pressureSize * .12 : Math.max(.4, random() * pressureSize * .07 * dustBoost);
      context.globalAlpha = opacity * (preset.shape === "airbrush" ? .18 : .35);
      context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
    }
    if (preset.id === "watercolor" && settings.effects > .05 && !settings.eraser) {
      const bloomRadius = pressureSize * (1 + settings.wetness * .7);
      const bloom = context.createRadialGradient(endX, to.y, bloomRadius * .12, endX, to.y, bloomRadius);
      bloom.addColorStop(0, `${settings.color}18`);
      bloom.addColorStop(.72, `${settings.color}${Math.round(24 + settings.effects * 24).toString(16).padStart(2, "0")}`);
      bloom.addColorStop(.9, `${settings.color}${Math.round(45 + settings.effects * 55).toString(16).padStart(2, "0")}`);
      bloom.addColorStop(1, `${settings.color}00`);
      context.globalAlpha = .7; context.fillStyle = bloom;
      context.beginPath(); context.arc(endX, to.y, bloomRadius, 0, Math.PI * 2); context.fill();
      if (settings.separation > .05) {
        const separated = `#${settings.color.slice(5, 7)}${settings.color.slice(1, 3)}${settings.color.slice(3, 5)}`;
        context.globalAlpha = settings.separation * .18; context.fillStyle = separated;
        context.beginPath(); context.arc(endX + bloomRadius * .14, to.y - bloomRadius * .08, bloomRadius * .55, 0, Math.PI * 2); context.fill();
      }
      context.globalAlpha = .16 + settings.effects * .2; context.strokeStyle = settings.color; context.lineWidth = Math.max(1, pressureSize * .08);
      context.beginPath(); context.arc(endX, to.y, bloomRadius * .82, 0, Math.PI * 2); context.stroke();
      if (settings.wetContext) {
        settings.wetContext.save(); settings.wetContext.strokeStyle = "#ffffff";
        settings.wetContext.globalAlpha = (.2 + settings.effects * .7) * (1 - settings.absorbency * .45);
        settings.wetContext.lineWidth = bloomRadius * (1.25 + (1 - settings.absorbency) * .5); settings.wetContext.lineCap = "round";
        settings.wetContext.beginPath(); settings.wetContext.moveTo(startX, from.y); settings.wetContext.lineTo(endX, to.y); settings.wetContext.stroke();
        settings.wetContext.restore();
      }
    }
    if ((preset.id === "ink" || preset.id === "calligraphy") && settings.effects > .05 && !settings.eraser) {
      const pool = context.createRadialGradient(endX, to.y, 0, endX, to.y, pressureSize * .7);
      pool.addColorStop(0, `${settings.color}b8`); pool.addColorStop(.55, `${settings.color}55`); pool.addColorStop(1, `${settings.color}00`);
      context.globalAlpha = .25 + settings.effects * .35; context.fillStyle = pool;
      context.beginPath(); context.arc(endX, to.y, pressureSize * .7, 0, Math.PI * 2); context.fill();
    }
    if ((preset.id === "pastel" || preset.id === "chalk") && settings.effects > .05 && !settings.eraser) {
      context.globalAlpha = .08 + settings.effects * .12; context.fillStyle = settings.color;
      for (let i = 0; i < Math.round(4 + settings.effects * 12); i++) {
        const angle = random() * Math.PI * 2, radius = random() * pressureSize * 1.15;
        context.fillRect(endX + Math.cos(angle) * radius, to.y + Math.sin(angle) * radius, 1 + random() * 2, 1 + random() * 2);
      }
    }
    if ((preset.id === "oil" || preset.id === "palette-knife") && settings.heightContext && settings.effects > .05) {
      settings.heightContext.save(); settings.heightContext.strokeStyle = "#ffffff";
      settings.heightContext.globalAlpha = .2 + settings.effects * .65;
      settings.heightContext.lineWidth = pressureSize; settings.heightContext.lineCap = "round";
      settings.heightContext.beginPath(); settings.heightContext.moveTo(startX, from.y); settings.heightContext.lineTo(endX, to.y); settings.heightContext.stroke();
      settings.heightContext.restore();
    }
    context.restore();
  };
  paintLine(from.x, to.x);
  if (settings.mirror) paintLine(settings.canvasWidth - from.x, settings.canvasWidth - to.x);
}
