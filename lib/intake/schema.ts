import { z } from "zod";

export const IntakeInput = z.object({
  purpose: z.string().min(2),
  rawMinutes: z.number().int().min(1),
  targetMinutes: z.number().int().min(1).optional(),

  color: z.enum(["none","basic","stylized"]).default("none"),
  vfx: z.enum(["none","light","medium","special"]).default("none"),
  motionGraphics: z.enum(["none","titles","designed"]).default("none"),
  securityBlur: z.enum(["none","few","many"]).default("none"),

  audioCleanup: z.boolean().default(false),
  multiAspect: z.boolean().default(false),
  deadlineISO: z.string().optional(),

  // collected later on submit
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});
export type IntakeInput = z.infer<typeof IntakeInput>;
