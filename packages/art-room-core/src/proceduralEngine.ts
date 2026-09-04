import { RasterStrokePoint, seededRandom } from "./brushEngine";

export type ProceduralKind = "grass" | "leaves" | "stars" | "snow" | "rain" | "vines" | "fire" | "smoke" | "clouds" | "lightning";
export type ProceduralPreset = { id: ProceduralKind; name: string; mark: string; description: string };
export type ProceduralSettings = {
  density: number;
  scale: number;
  wind: number;
  colorVariation: number;
  color: string;
  seed: number;
  mirror: boolean;
  canvasWidth: number;
};

export const PROCEDURAL_BRUSHES: ProceduralPreset[] = [
  { id: "grass", name: "Grass", mark: "Gr", description: "Tapered blades bend with the wind." },
  { id: "leaves", name: "Leaves", mark: "L", description: "Organic leaf clusters follow the stroke." },
  { id: "stars", name: "Stars", mark: "St", description: "Five-point stars vary in scale and turn." },
  { id: "snow", name: "Snow", mark: "Sn", description: "Layered flakes drift across the mark." },
  { id: "rain", name: "Rain", mark: "R", description: "Wind-driven rain streaks fall in sheets." },
  { id: "vines", name: "Growing vines", mark: "V", description: "Curling stems grow leaves along the gesture." },
  { id: "fire", name: "Fire", mark: "F", description: "Layered flame tongues rise from the stroke." },
  { id: "smoke", name: "Smoke", mark: "Sm", description: "Soft translucent coils drift with the wind." },
  { id: "clouds", name: "Clouds", mark: "Cl", description: "Overlapping soft masses build cloud banks." },
  { id: "lightning", name: "Lightning", mark: "Li", description: "Jagged charged branches follow the gesture." },
];

const varyColor = (hex: string, amount: number, random: () => number) => {
  const value = parseInt(hex.slice(1), 16);
  const shift = (random() - .5) * amount * 90;
  const channels = [value >> 16, value >> 8 & 255, value & 255]
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel + shift))));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
};

const starPath = (context: CanvasRenderingContext2D, x: number, y: number, radius: number, rotation: number) => {
  context.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = rotation + i * Math.PI / 5 - Math.PI / 2;
    const distance = i % 2 ? radius * .42 : radius;
    const px = x + Math.cos(angle) * distance, py = y + Math.sin(angle) * distance;
    if (i === 0) context.moveTo(px, py); else context.lineTo(px, py);
  }
  context.closePath();
};

export function renderProceduralStroke(
  context: CanvasRenderingContext2D,
  from: RasterStrokePoint,
  to: RasterStrokePoint,
  preset: ProceduralPreset,
  settings: ProceduralSettings,
) {
  const random = seededRandom(settings.seed);
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const count = Math.min(100, Math.max(1, Math.ceil(distance / Math.max(3, 34 - settings.density * 28))));
  const render = (startX: number, endX: number) => {
    for (let i = 0; i < count; i++) {
      const t = (i + random()) / count;
      const x = startX + (endX - startX) * t;
      const y = from.y + (to.y - from.y) * t;
      const scale = settings.scale * (.55 + random() * .9);
      const wind = settings.wind * scale * .8;
      context.save();
      context.fillStyle = varyColor(settings.color, settings.colorVariation, random);
      context.strokeStyle = context.fillStyle;
      context.globalAlpha = .48 + random() * .48;
      context.lineCap = "round";
      if (preset.id === "grass") {
        const height = scale * (1.5 + random());
        context.lineWidth = Math.max(1, scale * .12);
        context.beginPath(); context.moveTo(x, y); context.quadraticCurveTo(x + wind * .25, y - height * .55, x + wind, y - height); context.stroke();
      } else if (preset.id === "leaves") {
        context.translate(x + wind * .25, y); context.rotate((random() - .5) * Math.PI + settings.wind * .02);
        context.beginPath(); context.ellipse(0, 0, scale, scale * .42, 0, 0, Math.PI * 2); context.fill();
        context.globalAlpha *= .45; context.beginPath(); context.moveTo(-scale, 0); context.lineTo(scale, 0); context.stroke();
      } else if (preset.id === "stars") {
        starPath(context, x, y, scale, random() * Math.PI); context.fill();
      } else if (preset.id === "snow") {
        context.beginPath(); context.arc(x + wind * random(), y, Math.max(1, scale * .38), 0, Math.PI * 2); context.fill();
        if (scale > 8) {
          context.globalAlpha *= .65; context.lineWidth = 1;
          for (let arm = 0; arm < 3; arm++) {
            const angle = arm * Math.PI / 3; context.beginPath();
            context.moveTo(x - Math.cos(angle) * scale, y - Math.sin(angle) * scale);
            context.lineTo(x + Math.cos(angle) * scale, y + Math.sin(angle) * scale); context.stroke();
          }
        }
      } else if (preset.id === "rain") {
        context.lineWidth = Math.max(1, scale * .12);
        context.beginPath(); context.moveTo(x, y - scale); context.lineTo(x + wind, y + scale * 1.6); context.stroke();
      } else if (preset.id === "vines") {
        context.lineWidth = Math.max(1, scale * .14);
        context.beginPath(); context.moveTo(x - scale, y); context.bezierCurveTo(x, y - scale, x + wind, y + scale, x + scale, y); context.stroke();
        context.beginPath(); context.ellipse(x + scale * .4, y - scale * .35, scale * .42, scale * .2, -.5, 0, Math.PI * 2); context.fill();
      } else if (preset.id === "fire") {
        const flame = context.createLinearGradient(x, y, x + wind, y - scale * 2.3);
        flame.addColorStop(0, "#7a2014"); flame.addColorStop(.45, settings.color); flame.addColorStop(1, "#ffe49a00");
        context.fillStyle = flame; context.beginPath(); context.moveTo(x - scale * .55, y);
        context.quadraticCurveTo(x - scale * .15, y - scale, x + wind, y - scale * 2.3);
        context.quadraticCurveTo(x + scale * .65, y - scale * .7, x + scale * .55, y); context.closePath(); context.fill();
      } else if (preset.id === "smoke" || preset.id === "clouds") {
        context.globalAlpha = preset.id === "smoke" ? .08 + random() * .12 : .15 + random() * .18;
        context.shadowColor = context.fillStyle as string; context.shadowBlur = scale * 1.2;
        const radius = scale * (preset.id === "clouds" ? 1.1 : .7);
        context.beginPath(); context.arc(x + wind * random(), y - random() * scale, radius, 0, Math.PI * 2); context.fill();
      } else {
        context.globalCompositeOperation = "screen"; context.lineWidth = Math.max(1, scale * .16);
        context.shadowColor = context.strokeStyle as string; context.shadowBlur = scale * .7;
        context.beginPath(); context.moveTo(x - scale, y);
        context.lineTo(x - scale * .35, y + (random() - .5) * scale);
        context.lineTo(x + scale * .2, y + (random() - .5) * scale);
        context.lineTo(x + scale + wind, y + (random() - .5) * scale); context.stroke();
      }
      context.restore();
    }
  };
  render(from.x, to.x);
  if (settings.mirror) render(settings.canvasWidth - from.x, settings.canvasWidth - to.x);
}
