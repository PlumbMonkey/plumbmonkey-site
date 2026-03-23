import type { IntakeInput } from "./schema";

export type Estimation = {
  estDays: number;
  tier: "budget"|"pro"|"super"|"bid";
  path: "standard"|"bid";
  notes: string[];
};

export function estimate(input: IntakeInput): Estimation {
  const notes: string[] = [];
  const baseDays = Math.ceil((input.rawMinutes || 0) / 120); // ~2h raw/day
  let mult = 1;

  if (input.color === "basic") mult *= 1.25;
  if (input.color === "stylized") mult *= 1.5;

  if (input.vfx === "light") mult *= 1.25;
  if (input.vfx === "medium") mult *= 1.75;
  if (input.vfx === "special") notes.push("Special VFX requires bid.");

  if (input.motionGraphics === "titles") mult *= 1.25;
  if (input.motionGraphics === "designed") mult *= 2.5;

  if (input.securityBlur === "few") mult *= 1.2;
  if (input.securityBlur === "many") mult *= 1.4;

  if (input.audioCleanup) mult *= 1.2;
  if (input.multiAspect) mult *= 1.15;

  // Projects with VFX or motion graphics have a minimum production floor
  const hasComplexity =
    input.vfx !== "none" ||
    input.motionGraphics !== "none" ||
    input.color === "stylized";
  const minDays = hasComplexity ? 2 : 1;

  const estDays = Math.max(minDays, Math.ceil(baseDays * mult));

  let tier: Estimation["tier"] = "budget";
  if (input.rawMinutes <= 30 && input.vfx === "none" && input.motionGraphics === "none") tier = "budget";
  else if (input.rawMinutes <= 60 || input.vfx === "light" || input.color !== "none") tier = "pro";
  else if (input.rawMinutes <= 120 || input.vfx === "medium" || input.motionGraphics !== "none") tier = "super";
  else tier = "bid";

  const forceBid =
    input.vfx === "special" ||
    input.motionGraphics === "designed" ||
    input.rawMinutes > 120;

  const path: Estimation["path"] = forceBid ? "bid" : (tier === "bid" ? "bid" : "standard");

  return { estDays, tier: forceBid ? "bid" : tier, path, notes };
}
