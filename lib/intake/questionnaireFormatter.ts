import type { QuestionnaireInput } from "./schema";

export function formatQuestionnaireForEmail(responses: QuestionnaireInput): string {
  const lines: string[] = ["--- ORIENTATION QUESTIONNAIRE ---", ""];

  // Q1 - Core Reason
  if (responses.coreReason) {
    lines.push("Why are you making this video right now?");
    lines.push(responses.coreReason);
    lines.push("");
  }

  // Q2 - Desired Outcome
  if (responses.desiredOutcome) {
    lines.push("If this video works perfectly, what changes after people watch it?");
    lines.push(responses.desiredOutcome);
    lines.push("");
  }

  // Q3 - Intended Audience
  if (responses.intendedAudience) {
    lines.push("Who is this video meant for?");
    lines.push(responses.intendedAudience);
    lines.push("");
  }

  // Q4 - Existing Materials
  if (responses.existingMaterials && responses.existingMaterials.length > 0) {
    lines.push("What do you already have for this project?");
    lines.push(responses.existingMaterials.map((m) => `- ${m}`).join("\n"));
    lines.push("");
  }

  // Q4.1 - Brand & Contact Assets
  if (responses.brandAssets && responses.brandAssets.length > 0) {
    lines.push("Brand or contact assets they want included:");
    lines.push(responses.brandAssets.map((b) => `- ${b}`).join("\n"));
    lines.push("");
  }

  // Q5 - Emotional Direction
  if (responses.emotionalDirection && responses.emotionalDirection.length > 0) {
    lines.push("How should the video feel overall?");
    lines.push(responses.emotionalDirection.map((e) => `- ${e}`).join("\n"));
    if (responses.emotionalDirectionFreeText) {
      lines.push(`Additional notes: ${responses.emotionalDirectionFreeText}`);
    }
    lines.push("");
  }

  // Q6 - Visual Design & Animation
  if (responses.animationNeeds && responses.animationNeeds.length > 0) {
    lines.push("Animation / visual design help needed:");
    lines.push(responses.animationNeeds.map((a) => `- ${a}`).join("\n"));
    lines.push("");
  }

  // Q6.1 - Animation Style Preference
  if (responses.animationStyle) {
    const styleLabels: Record<string, string> = {
      traditional: "Traditional animation (handcrafted feel)",
      "ai-assisted": "AI-assisted animation (flashier, faster)",
      both: "A mix of both",
      unsure: "Not sure — they trust judgment",
    };
    lines.push("Animation style preference:");
    lines.push(styleLabels[responses.animationStyle] || responses.animationStyle);
    lines.push("");
  }

  // Q6.2 - Character Scope
  if (responses.characterScope) {
    const scopeLabels: Record<string, string> = {
      simple: "Simple visual presence (no dialogue)",
      talking: "Talking or singing character (lipsync)",
      full: "Full character design + performance",
      unsure: "Not sure yet",
    };
    lines.push("Character development scope:");
    lines.push(scopeLabels[responses.characterScope] || responses.characterScope);
    lines.push("");
  }

  // Q7 - Sound & Music Direction
  if (responses.musicDirection) {
    const musicLabels: Record<string, string> = {
      "have-music": "They already have music to use",
      original: "They'd like original music created",
      license: "They'd like to license royalty-free music",
      open: "They're open to recommendation",
      unsure: "Not sure yet",
    };
    lines.push("Music direction:");
    lines.push(musicLabels[responses.musicDirection] || responses.musicDirection);
    lines.push("");
  }

  // Q7.1 - Music Style
  if (responses.musicStyle && responses.musicStyle.length > 0) {
    lines.push("Music style preference:");
    lines.push(responses.musicStyle.map((m) => `- ${m}`).join("\n"));
    if (responses.musicStyleFreeText) {
      lines.push(`Additional notes: ${responses.musicStyleFreeText}`);
    }
    lines.push("");
  }

  // Q7.2 - Music Usage Context
  if (responses.musicUsageContext && responses.musicUsageContext.length > 0) {
    lines.push("Where will the video be used?");
    lines.push(responses.musicUsageContext.map((u) => `- ${u}`).join("\n"));
    lines.push("");
  }

  // Q8 - Platforms
  if (responses.platforms && responses.platforms.length > 0) {
    lines.push("Where do they expect this video to live?");
    lines.push(responses.platforms.map((p) => `- ${p}`).join("\n"));
    lines.push("");
  }

  // Q9 - Timing
  if (responses.deadlineDate) {
    lines.push("Deadline:");
    lines.push(responses.deadlineDate);
    if (responses.deadlineReason) {
      lines.push(`Why: ${responses.deadlineReason}`);
    }
    lines.push("");
  }

  // Q10 - Collaboration Preference
  if (responses.collaborationStyle) {
    const collabLabels: Record<string, string> = {
      lead: "They want me to take the creative lead",
      close: "They want to collaborate closely",
      feedback: "They want to give feedback and let me handle the rest",
      unsure: "Not sure yet",
    };
    lines.push("Collaboration preference:");
    lines.push(collabLabels[responses.collaborationStyle] || responses.collaborationStyle);
    lines.push("");
  }

  // Q11 - Catch-All
  if (responses.anythingElse) {
    lines.push("Anything else that matters?");
    lines.push(responses.anythingElse);
    lines.push("");
  }

  // Contact Preference + Timezone
  if (responses.timezone) {
    lines.push("Timezone: " + responses.timezone);
    lines.push("");
  }

  if (responses.bestTimeToReach) {
    const timeLabels: Record<string, string> = {
      morning: "Before noon",
      afternoon: "12-5pm",
      evening: "After 5pm",
    };
    lines.push("Best time to reach: " + (timeLabels[responses.bestTimeToReach] || responses.bestTimeToReach));
    lines.push("");
  }

  // Budget Comfort
  if (responses.budgetComfort) {
    const budgetLabels: Record<string, string> = {
      affordable: "Looking for most affordable option",
      midrange: "Mid-range is fine if it's worth it",
      premium: "Investing in premium results",
      unsure: "Not sure yet",
    };
    lines.push("Budget comfort level:");
    lines.push(budgetLabels[responses.budgetComfort] || responses.budgetComfort);
    lines.push("");
  }

  // Send copy preference
  if (responses.sendMeCopy) {
    lines.push("They want a copy of their answers emailed to them.");
    lines.push("");
  }

  lines.push("--- END QUESTIONNAIRE ---");

  return lines.join("\n");
}
