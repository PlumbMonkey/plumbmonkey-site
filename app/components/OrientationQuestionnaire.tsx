"use client";

import { useState, useEffect } from "react";
import type { QuestionnaireInput } from "@/lib/intake/schema";

const STORAGE_KEY = "plumbmonkey_orientation_draft";
const FINAL_KEY = "plumbmonkey_orientation_final";

export interface OrientationQuestionnaireProps {
  onSubmit: (data: QuestionnaireInput) => void;
  isSubmitting?: boolean;
}

export default function OrientationQuestionnaire({
  onSubmit,
  isSubmitting = false,
}: OrientationQuestionnaireProps) {
  const [formData, setFormData] = useState<QuestionnaireInput>({
    coreReason: "",
    desiredOutcome: "",
    intendedAudience: "",
    existingMaterials: [],
    brandAssets: [],
    emotionalDirection: [],
    emotionalDirectionFreeText: "",
    animationNeeds: [],
    animationStyle: undefined,
    characterScope: undefined,
    musicDirection: undefined,
    musicStyle: [],
    musicStyleFreeText: "",
    musicUsageContext: [],
    platforms: [],
    deadlineDate: "",
    deadlineReason: "",
    collaborationStyle: undefined,
    anythingElse: "",
    timezone: typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "",
    bestTimeToReach: undefined,
    budgetComfort: undefined,
    sendMeCopy: false,
  });

  const [hasLoaded, setHasLoaded] = useState(false);
  const [q1Error, setQ1Error] = useState("");
  const [q1HasStarted, setQ1HasStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastEditedAt, setLastEditedAt] = useState<number | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setFormData(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved questionnaire", e);
      }
    }
    setHasLoaded(true);
  }, []);

  // Track orientation start on first Q1 interaction
  useEffect(() => {
    if (!q1HasStarted && formData.coreReason && typeof window !== "undefined") {
      const now = Date.now();
      setStartedAt(now);
      setLastEditedAt(now);
      if (typeof (window as any).gtag !== "undefined") {
        (window as any).gtag("event", "orientation_start", {
          event_category: "engagement",
          event_label: "questionnaire",
        });
      }
      setQ1HasStarted(true);
    }
  }, [formData.coreReason, q1HasStarted]);

  // Track last edit time whenever formData changes
  useEffect(() => {
    if (hasLoaded && q1HasStarted) {
      setLastEditedAt(Date.now());
    }
  }, [formData, hasLoaded, q1HasStarted]);

  // Autosave to localStorage on change (debounced)
  useEffect(() => {
    if (!hasLoaded) return;
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    }, 500);
    return () => clearTimeout(timer);
  }, [formData, hasLoaded]);

  // Track abandonment on unmount with refined logic
  useEffect(() => {
    return () => {
      if (
        typeof window !== "undefined" &&
        !submitted &&
        startedAt !== null &&
        lastEditedAt !== null
      ) {
        const now = Date.now();
        const timeSinceStart = now - startedAt;
        const timeSinceLastEdit = now - lastEditedAt;
        const hasContent = formData.coreReason.trim().length > 0;

        // Fire abandon event only if: 
        // - Not submitted
        // - Been more than 15 seconds since they started
        // - Been more than 5 seconds since last edit
        // - They have some content in Q1
        if (
          timeSinceStart > 15000 &&
          timeSinceLastEdit > 5000 &&
          hasContent
        ) {
          if (typeof (window as any).gtag !== "undefined") {
            (window as any).gtag("event", "orientation_abandon", {
              event_category: "engagement",
              event_label: "questionnaire",
              time_on_form: Math.round(timeSinceStart / 1000),
              time_since_edit: Math.round(timeSinceLastEdit / 1000),
            });
          }
        }
      }
    };
  }, [submitted, startedAt, lastEditedAt, formData.coreReason]);

  const handleChange = (field: keyof QuestionnaireInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCheckboxGroupChange = (
    field: keyof QuestionnaireInput,
    value: string,
    checked: boolean
  ) => {
    const current = formData[field] as string[];
    if (checked) {
      handleChange(field, [...current, value]);
    } else {
      handleChange(field, current.filter((item) => item !== value));
    }
  };

  const validateQ1 = () => {
    const trimmed = formData.coreReason.trim();
    
    // Must have at least some content
    if (trimmed.length === 0) {
      setQ1Error("Tell me what sparked this project.");
      return false;
    }

    // Accept if:
    // 1. Long enough (≥10 chars), OR
    // 2. At least 2 words (e.g., "Music video", "Promo ad"), OR
    // 3. Contains a common domain word (promo, edit, music, ad, youtube, etc.)
    const wordCount = trimmed.split(/\s+/).length;
    const keywords = /\b(promo|music|edit|video|ad|youtube|demo|explainer|tutorial|reel|teaser|trailer|short|campaign|commercial|podcast|stream|channel|brand|product|service|event|interview|webinar|highlight)\b/i;
    const isLongEnough = trimmed.length >= 10;
    const hasMultipleWords = wordCount >= 2;
    const hasKeyword = keywords.test(trimmed);

    if (isLongEnough || hasMultipleWords || hasKeyword) {
      setQ1Error("");
      return true;
    }

    setQ1Error("A short phrase is enough — e.g., 'Music video' or 'Product demo'");
    return false;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Prevent double-submit
    if (submitted || isSubmitting) {
      return;
    }
    if (!validateQ1()) {
      return;
    }
    // Mark as submitted to prevent abandon tracking
    setSubmitted(true);
    // Save final payload for prefilling
    localStorage.setItem(FINAL_KEY, JSON.stringify(formData));
    // Clear draft on successful submit
    localStorage.removeItem(STORAGE_KEY);
    onSubmit(formData);
  };

  // Conditional show helpers
  const hasBrandAssets =
    (formData.existingMaterials?.includes("Brand assets (logo, visuals, contact info)") ||
      formData.existingMaterials?.includes("Nothing yet — starting from scratch")) ?? false;

  const hasAnimationNeeds = (formData.animationNeeds?.length ?? 0) > 0;

  const hasCharacterAnimation = formData.animationNeeds?.includes("Animated character") ?? false;

  const musicNeedsStyle =
    formData.musicDirection &&
    !["have-music", "unsure"].includes(formData.musicDirection);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Orientation Text */}
      <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg">
        <p className="text-zinc-300 leading-relaxed">
          <strong>You don't need perfect answers.</strong> Short, rough, or "not sure yet" is
          completely fine. This helps me lead the project in the right direction.
        </p>
      </div>

      {/* Q1 - Core Reason (REQUIRED) */}
      <div>
        <label className="block text-sm font-semibold text-zinc-50 mb-2">
          Why are you making this video right now? <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-zinc-400 mb-2">
          What problem are you trying to solve, or what opportunity are you trying to capture?
        </p>
        <textarea
          value={formData.coreReason}
          onChange={(e) => handleChange("coreReason", e.target.value)}
          onBlur={validateQ1}
          placeholder="e.g., We need to explain our service in 60 seconds..."
          className={`w-full px-3 py-2 bg-zinc-900 border rounded text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-teal-500 transition ${
            q1Error ? "border-red-500" : "border-zinc-700"
          }`}
          rows={3}
        />
        {q1Error && <p className="text-xs text-red-400 mt-1">{q1Error}</p>}
      </div>

      {/* Q2 - Desired Outcome */}
      <div>
        <label className="block text-sm font-semibold text-zinc-50 mb-2">
          If this video works perfectly, what changes after people watch it?
        </label>
        <p className="text-xs text-zinc-400 mb-2">
          Examples: they understand something, feel excited, trust you more, click a link, remember you.
        </p>
        <textarea
          value={formData.desiredOutcome}
          onChange={(e) => handleChange("desiredOutcome", e.target.value)}
          placeholder="e.g., They'll understand why our product is different..."
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-teal-500"
          rows={3}
        />
      </div>

      {/* Q3 - Intended Audience */}
      <div>
        <label className="block text-sm font-semibold text-zinc-50 mb-2">
          Who is this video meant for?
        </label>
        <p className="text-xs text-zinc-400 mb-2">
          You can describe them like a person, not a demographic.
        </p>
        <textarea
          value={formData.intendedAudience}
          onChange={(e) => handleChange("intendedAudience", e.target.value)}
          placeholder="e.g., Small business owners who are frustrated with their current solution..."
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-teal-500"
          rows={3}
        />
      </div>

      {/* Q4 - Existing Materials */}
      <div>
        <label className="block text-sm font-semibold text-zinc-50 mb-3">
          What do you already have for this project?
        </label>
        <div className="space-y-2">
          {[
            "Raw video footage",
            "Screen recordings",
            "Photos or graphics",
            "Music or audio",
            "Brand assets (logo, visuals, contact info)",
            "Nothing yet — starting from scratch",
          ].map((option) => (
            <label key={option} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(formData.existingMaterials ?? []).includes(option)}
                onChange={(e) =>
                  handleCheckboxGroupChange("existingMaterials", option, e.target.checked)
                }
                className="w-4 h-4 accent-teal-500"
              />
              <span className="text-sm text-zinc-300">{option}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Q4.1 - Brand & Contact Assets (CONDITIONAL) */}
      {hasBrandAssets && (
        <div className="pl-4 border-l-2 border-teal-600">
          <label className="block text-sm font-semibold text-zinc-50 mb-3">
            Do you already have any brand or contact assets you want included?
          </label>
          <p className="text-xs text-zinc-400 mb-3">
            If you don't have these yet, I can design them.
          </p>
          <div className="space-y-2">
            {[
              "Logo",
              "Visual business card / brand card",
              "Website URL",
              "Social handles",
              "Contact info (email, phone, etc.)",
              "Brand colors or fonts",
              "None yet",
            ].map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(formData.brandAssets ?? []).includes(option)}
                  onChange={(e) => handleCheckboxGroupChange("brandAssets", option, e.target.checked)}
                  className="w-4 h-4 accent-teal-500"
                />
                <span className="text-sm text-zinc-300">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Q5 - Emotional Direction */}
      <div>
        <label className="block text-sm font-semibold text-zinc-50 mb-3">
          How should the video feel overall?
        </label>
        <div className="space-y-2">
          {["Energetic", "Calm", "Cinematic", "Honest", "Fun", "Serious", "Experimental", "Not sure yet"].map(
            (option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(formData.emotionalDirection ?? []).includes(option)}
                  onChange={(e) =>
                    handleCheckboxGroupChange("emotionalDirection", option, e.target.checked)
                  }
                  className="w-4 h-4 accent-teal-500"
                />
                <span className="text-sm text-zinc-300">{option}</span>
              </label>
            )
          )}
        </div>
        <textarea
          value={formData.emotionalDirectionFreeText}
          onChange={(e) => handleChange("emotionalDirectionFreeText", e.target.value)}
          placeholder="Any additional notes on the vibe..."
          className="w-full px-3 py-2 mt-3 bg-zinc-900 border border-zinc-700 rounded text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-teal-500"
          rows={2}
        />
      </div>

      {/* Q6 - Visual Design & Animation */}
      <div>
        <label className="block text-sm font-semibold text-zinc-50 mb-3">
          Would you like help with any of the following?
        </label>
        <p className="text-xs text-zinc-400 mb-3">
          You don't need to know what fits — this just tells me what's on the table.
        </p>
        <div className="space-y-2">
          {[
            "Logo design",
            "Logo animation (animated version of an existing logo)",
            "Graphic elements (titles, lower thirds, visuals)",
            "Custom 2D scene or background",
            "Custom 3D scene or environment",
            "Animated character",
            "Character lipsync (talking or singing)",
            "Not sure — open to ideas",
          ].map((option) => (
            <label key={option} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(formData.animationNeeds ?? []).includes(option)}
                onChange={(e) => handleCheckboxGroupChange("animationNeeds", option, e.target.checked)}
                className="w-4 h-4 accent-teal-500"
              />
              <span className="text-sm text-zinc-300">{option}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Q6.1 - Animation Style Preference (CONDITIONAL) */}
      {hasAnimationNeeds && !formData.animationNeeds?.includes("Not sure — open to ideas") && (
        <div className="pl-4 border-l-2 border-teal-600">
          <label className="block text-sm font-semibold text-zinc-50 mb-3">
            If animation is involved, what feels right?
          </label>
          <p className="text-xs text-zinc-400 mb-3">
            Traditional gives finer control. AI can explore bolder looks.
          </p>
          <div className="space-y-2">
            {[
              { value: "traditional", label: "Traditional animation (more control, handcrafted feel)" },
              { value: "ai-assisted", label: "AI-assisted animation (flashier, faster experimentation)" },
              { value: "both", label: "A mix of both" },
              { value: "unsure", label: "Not sure — I trust your judgment" },
            ].map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="animationStyle"
                  value={option.value}
                  checked={formData.animationStyle === option.value}
                  onChange={(e) => handleChange("animationStyle", e.target.value as any)}
                  className="w-4 h-4 accent-teal-500"
                />
                <span className="text-sm text-zinc-300">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Q6.2 - Character Scope (CONDITIONAL) */}
      {hasCharacterAnimation && (
        <div className="pl-4 border-l-2 border-teal-600">
          <label className="block text-sm font-semibold text-zinc-50 mb-3">
            If a character is involved, how developed should it be?
          </label>
          <div className="space-y-2">
            {[
              { value: "simple", label: "Simple visual presence (no dialogue)" },
              { value: "talking", label: "Talking or singing character (lipsync)" },
              { value: "full", label: "Full character design + performance" },
              { value: "unsure", label: "Not sure yet" },
            ].map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="characterScope"
                  value={option.value}
                  checked={formData.characterScope === option.value}
                  onChange={(e) => handleChange("characterScope", e.target.value as any)}
                  className="w-4 h-4 accent-teal-500"
                />
                <span className="text-sm text-zinc-300">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Q7 - Sound & Music Direction */}
      <div>
        <label className="block text-sm font-semibold text-zinc-50 mb-3">
          How should music factor into this project?
        </label>
        <p className="text-xs text-zinc-400 mb-3">
          Music is often the emotional spine — I can handle this end-to-end if you want.
        </p>
        <div className="space-y-2">
          {[
            { value: "have-music", label: "I already have music I want to use" },
            { value: "original", label: "I'd like original music created for this video" },
            { value: "license", label: "I'd like to license music directly (royalty-free, cleared)" },
            { value: "open", label: "I'm open to your recommendation" },
            { value: "unsure", label: "Not sure yet" },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="musicDirection"
                value={option.value}
                checked={formData.musicDirection === option.value}
                onChange={(e) => handleChange("musicDirection", e.target.value as any)}
                className="w-4 h-4 accent-teal-500"
              />
              <span className="text-sm text-zinc-300">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Q7.1 - Music Style (CONDITIONAL) */}
      {musicNeedsStyle && (
        <div className="pl-4 border-l-2 border-teal-600">
          <label className="block text-sm font-semibold text-zinc-50 mb-3">
            If music is involved, what direction feels closest?
          </label>
          <div className="space-y-2">
            {[
              "Cinematic",
              "Minimal / ambient",
              "Energetic / upbeat",
              "Dark / moody",
              "Emotional / melodic",
              "Modern / electronic",
              "Acoustic / organic",
              "Not sure — surprise me",
            ].map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(formData.musicStyle ?? []).includes(option)}
                  onChange={(e) => handleCheckboxGroupChange("musicStyle", option, e.target.checked)}
                  className="w-4 h-4 accent-teal-500"
                />
                <span className="text-sm text-zinc-300">{option}</span>
              </label>
            ))}
          </div>
          <textarea
            value={formData.musicStyleFreeText}
            onChange={(e) => handleChange("musicStyleFreeText", e.target.value)}
            placeholder="Any additional notes on music direction..."
            className="w-full px-3 py-2 mt-3 bg-zinc-900 border border-zinc-700 rounded text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-teal-500"
            rows={2}
          />
        </div>
      )}

      {/* Q7.2 - Music Usage Context */}
      <div>
        <label className="block text-sm font-semibold text-zinc-50 mb-3">
          Where will this video be used?
        </label>
        <p className="text-xs text-zinc-400 mb-3">
          All music provided is cleared for its intended use.
        </p>
        <div className="space-y-2">
          {[
            "Social media",
            "YouTube",
            "Website",
            "Paid ads",
            "Presentation / internal",
            "Broadcast / festival",
          ].map((option) => (
            <label key={option} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(formData.musicUsageContext ?? []).includes(option)}
                onChange={(e) =>
                  handleCheckboxGroupChange("musicUsageContext", option, e.target.checked)
                }
                className="w-4 h-4 accent-teal-500"
              />
              <span className="text-sm text-zinc-300">{option}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Q8 - Platforms */}
      <div>
        <label className="block text-sm font-semibold text-zinc-50 mb-3">
          Where do you expect this video to live?
        </label>
        <div className="space-y-2">
          {["YouTube", "Instagram / Reels", "TikTok", "Website", "Presentation / internal", "Not sure yet"].map(
            (option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(formData.platforms ?? []).includes(option)}
                  onChange={(e) => handleCheckboxGroupChange("platforms", option, e.target.checked)}
                  className="w-4 h-4 accent-teal-500"
                />
                <span className="text-sm text-zinc-300">{option}</span>
              </label>
            )
          )}
        </div>
      </div>

      {/* Q9 - Timing */}
      <div>
        <label className="block text-sm font-semibold text-zinc-50 mb-2">
          Is there a date this needs to be ready by?
        </label>
        <input
          type="date"
          value={formData.deadlineDate}
          onChange={(e) => handleChange("deadlineDate", e.target.value)}
          className="w-full px-3 py-2 mb-3 bg-zinc-900 border border-zinc-700 rounded text-zinc-50 focus:outline-none focus:border-teal-500"
        />
        <textarea
          value={formData.deadlineReason}
          onChange={(e) => handleChange("deadlineReason", e.target.value)}
          placeholder="Why that date? (e.g., product launch, event, etc.)"
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-teal-500"
          rows={2}
        />
      </div>

      {/* Budget Comfort (Soft Question near Q9) */}
      <div>
        <label className="block text-sm font-semibold text-zinc-50 mb-3">
          Which range feels realistic for this project?
        </label>
        <p className="text-xs text-zinc-400 mb-3">
          This helps me scope appropriately.
        </p>
        <div className="space-y-2">
          {[
            { value: "affordable", label: "I want the most affordable option" },
            { value: "midrange", label: "Mid-range is fine if it's worth it" },
            { value: "premium", label: "I'm investing in premium results" },
            { value: "unsure", label: "Not sure yet" },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="budgetComfort"
                value={option.value}
                checked={formData.budgetComfort === option.value}
                onChange={(e) => handleChange("budgetComfort", e.target.value as any)}
                className="w-4 h-4 accent-teal-500"
              />
              <span className="text-sm text-zinc-300">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Q10 - Collaboration Preference */}
      <div>
        <label className="block text-sm font-semibold text-zinc-50 mb-3">
          How do you want to work together?
        </label>
        <div className="space-y-2">
          {[
            { value: "lead", label: "I want you to take the creative lead" },
            { value: "close", label: "I want to collaborate closely" },
            { value: "feedback", label: "I want to give feedback and let you handle the rest" },
            { value: "unsure", label: "Not sure yet" },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="collaborationStyle"
                value={option.value}
                checked={formData.collaborationStyle === option.value}
                onChange={(e) => handleChange("collaborationStyle", e.target.value as any)}
                className="w-4 h-4 accent-teal-500"
              />
              <span className="text-sm text-zinc-300">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Q11 - Catch-All */}
      <div>
        <label className="block text-sm font-semibold text-zinc-50 mb-2">
          Is there anything else that matters?
        </label>
        <p className="text-xs text-zinc-400 mb-2">
          Budgets, nerves, past bad experiences, big hopes — all fair game.
        </p>
        <textarea
          value={formData.anythingElse}
          onChange={(e) => handleChange("anythingElse", e.target.value)}
          placeholder="Anything else you'd like me to know..."
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-teal-500"
          rows={4}
        />
      </div>

      {/* Contact Preference + Timezone */}
      <div>
        <label className="block text-sm font-semibold text-zinc-50 mb-3">
          Best way and time to reach you
        </label>
        <div className="mb-4">
          <label className="block text-xs font-medium text-zinc-400 mb-2">Your timezone</label>
          <input
            type="text"
            value={formData.timezone}
            onChange={(e) => handleChange("timezone", e.target.value)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-teal-500"
            placeholder="e.g., America/Los_Angeles"
          />
        </div>
        <label className="block text-xs font-medium text-zinc-400 mb-2">Best time to reach you</label>
        <div className="space-y-2">
          {[
            { value: "morning", label: "Morning (before noon)" },
            { value: "afternoon", label: "Afternoon (12-5pm)" },
            { value: "evening", label: "Evening (after 5pm)" },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="bestTimeToReach"
                value={option.value}
                checked={formData.bestTimeToReach === option.value}
                onChange={(e) => handleChange("bestTimeToReach", e.target.value as any)}
                className="w-4 h-4 accent-teal-500"
              />
              <span className="text-sm text-zinc-300">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Send Me A Copy Checkbox */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.sendMeCopy}
            onChange={(e) => handleChange("sendMeCopy", e.target.checked)}
            className="w-4 h-4 accent-teal-500"
          />
          <span className="text-sm text-zinc-300">Email me a copy of my answers</span>
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || !formData.coreReason.trim()}
        className="w-full px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Submitting..." : "Continue"}
      </button>
    </form>
  );
}
