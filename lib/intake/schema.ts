import { z } from "zod";

export const QuestionnaireInput = z.object({
  // Q0 - Project Type (REQUIRED). Slugs come from lib/services.ts, plus the two
  // escape hatches in SERVICE_OPTIONS. Asked first because the form used to open
  // "Let's talk about your video" and had no way to say "it's a game" or "it's a
  // score" — a visitor with a non-video project had to answer fifteen questions
  // in the wrong vocabulary before they could mention it.
  projectType: z.string().min(1, "Pick the closest one"),

  // Q1 - Core Reason (REQUIRED)
  coreReason: z.string().min(1, "This is required"),

  // Q2 - Desired Outcome (optional)
  desiredOutcome: z.string().optional().default(""),

  // Q3 - Intended Audience (optional)
  intendedAudience: z.string().optional().default(""),

  // Q4 - Existing Materials (optional, multiple select)
  existingMaterials: z.array(z.string()).optional().default([]),

  // Q4.1 - Brand & Contact Assets (conditional, multiple select)
  brandAssets: z.array(z.string()).optional().default([]),

  // Q5 - Emotional Direction (optional, multiple select + free text)
  emotionalDirection: z.array(z.string()).optional().default([]),
  emotionalDirectionFreeText: z.string().optional().default(""),

  // Q6 - Visual Design & Animation (optional, multiple select)
  animationNeeds: z.array(z.string()).optional().default([]),

  // Q6.1 - Animation Style Preference (conditional, single select)
  animationStyle: z.enum(["traditional", "ai-assisted", "both", "unsure"]).optional(),

  // Q6.2 - Character Scope (conditional, single select)
  characterScope: z.enum(["simple", "talking", "full", "unsure"]).optional(),

  // Q7 - Sound & Music Direction (single select)
  musicDirection: z.enum(["have-music", "original", "license", "open", "unsure"]).optional(),

  // Q7.1 - Music Style (conditional, multiple select + free text)
  musicStyle: z.array(z.string()).optional().default([]),
  musicStyleFreeText: z.string().optional().default(""),

  // Q7.2 - Music Usage Context (optional, multiple select)
  musicUsageContext: z.array(z.string()).optional().default([]),

  // ---- SOFTWARE (shown when projectType is "software") -------------------
  // The video questions ask about footage and colour, which tells you nothing
  // about an application. These four are the software equivalent: what it runs
  // on, how far along it already is, who uses it, and the one job it must do.
  softwarePlatform: z.array(z.string()).optional().default([]),
  softwareStage: z.enum(["idea", "spec", "existing", "rebuild", "unsure"]).optional(),
  softwareUsers: z.string().optional().default(""),
  softwareMustDo: z.string().optional().default(""),

  // ---- SCORING (shown when projectType is "scoring") ---------------------
  // scoringAdaptive is the question that separates a game score from a film
  // score: linear cues are written once, adaptive ones have to survive being
  // cut into by the player. It changes the work and the price.
  scoringMedium: z.array(z.string()).optional().default([]),
  scoringToPicture: z.enum(["locked", "rough", "standalone", "unsure"]).optional(),
  scoringAmount: z.string().optional().default(""),
  scoringAdaptive: z.enum(["linear", "loopable", "adaptive", "unsure"]).optional(),
  scoringLicence: z.enum(["personal", "single", "broadcast", "buyout", "unsure"]).optional(),

  // Q8 - Platforms (optional, multiple select)
  platforms: z.array(z.string()).optional().default([]),

  // Q9 - Timing (optional, date + textarea)
  deadlineDate: z.string().optional().default(""),
  deadlineReason: z.string().optional().default(""),

  // Q10 - Collaboration Preference (optional, single select)
  collaborationStyle: z.enum(["lead", "close", "feedback", "unsure"]).optional(),

  // Q11 - Catch-All (optional, textarea)
  anythingElse: z.string().optional().default(""),

  // Contact Preference + Timezone (optional)
  timezone: z.string().optional().default(""),
  bestTimeToReach: z.enum(["morning", "afternoon", "evening"]).optional(),

  // Budget Comfort (optional, soft question)
  budgetComfort: z.enum(["affordable", "midrange", "premium", "unsure"]).optional(),

  // Email copy preference
  sendMeCopy: z.boolean().optional().default(false),

  // GA tracking
  startedAt: z.number().optional(),
});
export type QuestionnaireInput = z.infer<typeof QuestionnaireInput>;

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
