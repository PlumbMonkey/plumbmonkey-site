"use client";

import { useState, useEffect } from "react";
import type { QuestionnaireInput } from "@/lib/intake/schema";
import { SERVICE_OPTIONS } from "@/lib/services";

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
    projectType: "",
    coreReason: "",
    softwarePlatform: [],
    softwareUsers: "",
    softwareMustDo: "",
    scoringMedium: [],
    scoringAmount: "",
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
  const [q0Error, setQ0Error] = useState("");
  const [q1Error, setQ1Error] = useState("");
  const [q1HasStarted, setQ1HasStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastEditedAt, setLastEditedAt] = useState<number | null>(null);

  // Load the saved draft, then let ?service= from /services override the
  // project type. Read off window.location rather than useSearchParams because
  // this route is force-static: there is no server render to hand params down
  // from, and wrapping the whole form in Suspense to reach them is not worth it
  // for one prefill.
  //
  // The query wins over the draft on purpose. Someone who clicks "Get a quote"
  // under Scoring having previously abandoned a draft under Video means the
  // scoring one; the rest of their draft is still restored around it.
  useEffect(() => {
    let next: QuestionnaireInput | null = null;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        next = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load saved questionnaire", e);
      }
    }

    const requested = new URLSearchParams(window.location.search).get("service");
    if (requested && SERVICE_OPTIONS.some((o) => o.value === requested)) {
      next = { ...(next ?? formData), projectType: requested };
    }

    if (next) setFormData(next);
    setHasLoaded(true);
    // formData is the initial state here and intentionally not a dependency:
    // this runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const validateQ0 = () => {
    if (!formData.projectType) {
      setQ0Error("Pick the closest one — it only steers the questions.");
      return false;
    }
    setQ0Error("");
    return true;
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
    const q0ok = validateQ0();
    const q1ok = validateQ1();
    if (!q0ok || !q1ok) {
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

  /* Which discipline's questions to show. Answering Q0 makes the form SHORTER,
     not longer: a software client no longer scrolls past footage, colour and
     emotional-direction questions to reach the ones that matter, and a composer
     is not asked what platform the video is for.

     "Several of these", "Not sure yet", and an unanswered Q0 all fall through to
     showing everything, which is exactly what every visitor used to get. */
  const type = formData.projectType;
  const broad = !type || type === "several" || type === "unsure";
  const show = {
    // Footage, colour, platforms — the original question set.
    video: broad || type === "video" || type === "music-video",
    software: broad || type === "software",
    scoring: broad || type === "scoring",
    // Design questions also serve video and music video, which routinely want
    // titles, logo animation and character work.
    design: broad || type === "design" || type === "video" || type === "music-video",
    // Someone commissioning a score is not also being asked to brief one.
    musicBrief: broad || type !== "scoring",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Orientation Text */}
      <div className="p-4 bg-moonlit-900/60 border border-moonlit-700 rounded-lg">
        <p className="text-moonlit-200 leading-relaxed">
          <strong>You don't need perfect answers.</strong> Short, rough, or "not sure yet" is
          completely fine. This helps me lead the project in the right direction.
        </p>
      </div>

      {/* Q0 - Project Type (REQUIRED). Options come from lib/services.ts, so the
          form offers exactly the five lines the studio actually sells. */}
      <div>
        <label className="block text-sm font-semibold text-moonlit-50 mb-2">
          What kind of project is this? <span className="text-burgundy-300">*</span>
        </label>
        <p className="text-xs text-moonlit-400 mb-3">
          It only steers which questions you get. Plenty of projects are more than one.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {SERVICE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-2.5 border px-3.5 py-3 transition ${
                formData.projectType === option.value
                  ? "border-brass-500 bg-moonlit-900/60"
                  : "border-moonlit-700 hover:border-brass-500"
              }`}
            >
              <input
                type="radio"
                name="projectType"
                value={option.value}
                checked={formData.projectType === option.value}
                onChange={(e) => {
                  handleChange("projectType", e.target.value);
                  setQ0Error("");
                }}
                className="w-4 h-4 accent-brass-400"
              />
              <span className="text-sm text-moonlit-200">{option.label}</span>
            </label>
          ))}
        </div>
        {q0Error && <p className="text-xs text-burgundy-300 mt-2">{q0Error}</p>}
      </div>

      {/* Q1 - Core Reason (REQUIRED) */}
      <div>
        <label className="block text-sm font-semibold text-moonlit-50 mb-2">
          Why are you making this right now? <span className="text-burgundy-300">*</span>
        </label>
        <p className="text-xs text-moonlit-400 mb-2">
          What problem are you trying to solve, or what opportunity are you trying to capture?
        </p>
        <textarea
          value={formData.coreReason}
          onChange={(e) => handleChange("coreReason", e.target.value)}
          onBlur={validateQ1}
          placeholder="e.g., We need to explain our service in 60 seconds..."
          className={`w-full px-3 py-2 bg-moonlit-900/60 border rounded text-moonlit-50 placeholder-moonlit-500 focus:outline-none focus:border-brass-500 transition ${
            q1Error ? "border-burgundy-400" : "border-moonlit-700"
          }`}
          rows={3}
        />
        {q1Error && <p className="text-xs text-burgundy-300 mt-1">{q1Error}</p>}
      </div>

      {/* Q2 - Desired Outcome */}
      <div>
        <label className="block text-sm font-semibold text-moonlit-50 mb-2">
          If this works perfectly, what changes for the people who see it?
        </label>
        <p className="text-xs text-moonlit-400 mb-2">
          Examples: they understand something, feel excited, trust you more, click a link, remember you.
        </p>
        <textarea
          value={formData.desiredOutcome}
          onChange={(e) => handleChange("desiredOutcome", e.target.value)}
          placeholder="e.g., They'll understand why our product is different..."
          className="w-full px-3 py-2 bg-moonlit-900/60 border border-moonlit-700 rounded text-moonlit-50 placeholder-moonlit-500 focus:outline-none focus:border-brass-500"
          rows={3}
        />
      </div>

      {/* Q3 - Intended Audience */}
      <div>
        <label className="block text-sm font-semibold text-moonlit-50 mb-2">
          Who is this meant for?
        </label>
        <p className="text-xs text-moonlit-400 mb-2">
          You can describe them like a person, not a demographic.
        </p>
        <textarea
          value={formData.intendedAudience}
          onChange={(e) => handleChange("intendedAudience", e.target.value)}
          placeholder="e.g., Small business owners who are frustrated with their current solution..."
          className="w-full px-3 py-2 bg-moonlit-900/60 border border-moonlit-700 rounded text-moonlit-50 placeholder-moonlit-500 focus:outline-none focus:border-brass-500"
          rows={3}
        />
      </div>

      {/* Q4 - Existing Materials */}
      <div>
        <label className="block text-sm font-semibold text-moonlit-50 mb-3">
          What do you already have for this project?
        </label>
        <div className="space-y-2">
          {[
            "Raw video footage",
            "Code, designs or a previous build",
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
                className="w-4 h-4 accent-brass-400"
              />
              <span className="text-sm text-moonlit-200">{option}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Q4.1 - Brand & Contact Assets (CONDITIONAL) */}
      {hasBrandAssets && (
        <div className="pl-4 border-l-2 border-brass-500">
          <label className="block text-sm font-semibold text-moonlit-50 mb-3">
            Do you already have any brand or contact assets you want included?
          </label>
          <p className="text-xs text-moonlit-400 mb-3">
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
                  className="w-4 h-4 accent-brass-400"
                />
                <span className="text-sm text-moonlit-200">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Q5 - Emotional Direction */}
      <div>
        <label className="block text-sm font-semibold text-moonlit-50 mb-3">
          How should it feel overall?
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
                  className="w-4 h-4 accent-brass-400"
                />
                <span className="text-sm text-moonlit-200">{option}</span>
              </label>
            )
          )}
        </div>
        <textarea
          value={formData.emotionalDirectionFreeText}
          onChange={(e) => handleChange("emotionalDirectionFreeText", e.target.value)}
          placeholder="Any additional notes on the vibe..."
          className="w-full px-3 py-2 mt-3 bg-moonlit-900/60 border border-moonlit-700 rounded text-moonlit-50 placeholder-moonlit-500 focus:outline-none focus:border-brass-500"
          rows={2}
        />
      </div>

      {/* ===== SOFTWARE BLOCK — shown when projectType is "software" ===== */}
      {show.software && (
        <div className="space-y-8 border-l-2 border-brass-500/40 pl-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brass-400">
            About the software
          </p>

          <div>
            <label className="block text-sm font-semibold text-moonlit-50 mb-3">
              What should it run on?
            </label>
            <div className="space-y-2">
                <label key="In a browser" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.softwarePlatform ?? []).includes("In a browser")}
                    onChange={(e) =>
                      handleCheckboxGroupChange("softwarePlatform", "In a browser", e.target.checked)
                    }
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">In a browser</span>
                </label>
                <label key="Windows desktop" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.softwarePlatform ?? []).includes("Windows desktop")}
                    onChange={(e) =>
                      handleCheckboxGroupChange("softwarePlatform", "Windows desktop", e.target.checked)
                    }
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Windows desktop</span>
                </label>
                <label key="A game &mdash; browser" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.softwarePlatform ?? []).includes("A game &mdash; browser")}
                    onChange={(e) =>
                      handleCheckboxGroupChange("softwarePlatform", "A game &mdash; browser", e.target.checked)
                    }
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">A game &mdash; browser</span>
                </label>
                <label key="A game &mdash; desktop or console" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.softwarePlatform ?? []).includes("A game &mdash; desktop or console")}
                    onChange={(e) =>
                      handleCheckboxGroupChange("softwarePlatform", "A game &mdash; desktop or console", e.target.checked)
                    }
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">A game &mdash; desktop or console</span>
                </label>
                <label key="Mobile" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.softwarePlatform ?? []).includes("Mobile")}
                    onChange={(e) =>
                      handleCheckboxGroupChange("softwarePlatform", "Mobile", e.target.checked)
                    }
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Mobile</span>
                </label>
                <label key="Not sure yet" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.softwarePlatform ?? []).includes("Not sure yet")}
                    onChange={(e) =>
                      handleCheckboxGroupChange("softwarePlatform", "Not sure yet", e.target.checked)
                    }
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Not sure yet</span>
                </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-moonlit-50 mb-3">
              How far along is it?
            </label>
            <div className="space-y-2">
                <label key="idea" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="softwareStage"
                    value="idea"
                    checked={formData.softwareStage === "idea"}
                    onChange={(e) => handleChange("softwareStage", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">An idea, nothing written down yet</span>
                </label>
                <label key="spec" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="softwareStage"
                    value="spec"
                    checked={formData.softwareStage === "spec"}
                    onChange={(e) => handleChange("softwareStage", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">I have notes, a spec or designs</span>
                </label>
                <label key="existing" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="softwareStage"
                    value="existing"
                    checked={formData.softwareStage === "existing"}
                    onChange={(e) => handleChange("softwareStage", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Something exists and needs building on</span>
                </label>
                <label key="rebuild" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="softwareStage"
                    value="rebuild"
                    checked={formData.softwareStage === "rebuild"}
                    onChange={(e) => handleChange("softwareStage", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Something exists and needs replacing</span>
                </label>
                <label key="unsure" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="softwareStage"
                    value="unsure"
                    checked={formData.softwareStage === "unsure"}
                    onChange={(e) => handleChange("softwareStage", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Not sure</span>
                </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-moonlit-50 mb-2">
              Who will use it?
            </label>
            <textarea
              value={formData.softwareUsers}
              onChange={(e) => handleChange("softwareUsers", e.target.value)}
              placeholder="e.g., our five person team, or anyone who buys it..."
              className={"w-full px-3 py-2 bg-moonlit-900/60 border border-moonlit-700 rounded text-moonlit-50 placeholder-moonlit-500 focus:outline-none focus:border-brass-500"}
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-moonlit-50 mb-2">
              If it only did one thing well, what would it be?
            </label>
            <p className="text-xs text-moonlit-400 mb-2">
              The answer to this usually becomes version one.
            </p>
            <textarea
              value={formData.softwareMustDo}
              onChange={(e) => handleChange("softwareMustDo", e.target.value)}
              placeholder="e.g., turn a folder of clips into a rough cut..."
              className={"w-full px-3 py-2 bg-moonlit-900/60 border border-moonlit-700 rounded text-moonlit-50 placeholder-moonlit-500 focus:outline-none focus:border-brass-500"}
              rows={2}
            />
          </div>
        </div>
      )}

      {/* ===== SCORING BLOCK — shown when projectType is "scoring" ===== */}
      {show.scoring && (
        <div className="space-y-8 border-l-2 border-brass-500/40 pl-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brass-400">
            About the score
          </p>

          <div>
            <label className="block text-sm font-semibold text-moonlit-50 mb-3">
              What is it for?
            </label>
            <div className="space-y-2">
                <label key="A film or short" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.scoringMedium ?? []).includes("A film or short")}
                    onChange={(e) =>
                      handleCheckboxGroupChange("scoringMedium", "A film or short", e.target.checked)
                    }
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">A film or short</span>
                </label>
                <label key="A game" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.scoringMedium ?? []).includes("A game")}
                    onChange={(e) =>
                      handleCheckboxGroupChange("scoringMedium", "A game", e.target.checked)
                    }
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">A game</span>
                </label>
                <label key="TV or a series" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.scoringMedium ?? []).includes("TV or a series")}
                    onChange={(e) =>
                      handleCheckboxGroupChange("scoringMedium", "TV or a series", e.target.checked)
                    }
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">TV or a series</span>
                </label>
                <label key="A trailer" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.scoringMedium ?? []).includes("A trailer")}
                    onChange={(e) =>
                      handleCheckboxGroupChange("scoringMedium", "A trailer", e.target.checked)
                    }
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">A trailer</span>
                </label>
                <label key="Social / short-form" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.scoringMedium ?? []).includes("Social / short-form")}
                    onChange={(e) =>
                      handleCheckboxGroupChange("scoringMedium", "Social / short-form", e.target.checked)
                    }
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Social / short-form</span>
                </label>
                <label key="Something else" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.scoringMedium ?? []).includes("Something else")}
                    onChange={(e) =>
                      handleCheckboxGroupChange("scoringMedium", "Something else", e.target.checked)
                    }
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Something else</span>
                </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-moonlit-50 mb-3">
              Is there picture to write to?
            </label>
            <div className="space-y-2">
                <label key="locked" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scoringToPicture"
                    value="locked"
                    checked={formData.scoringToPicture === "locked"}
                    onChange={(e) => handleChange("scoringToPicture", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Yes &mdash; a locked edit</span>
                </label>
                <label key="rough" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scoringToPicture"
                    value="rough"
                    checked={formData.scoringToPicture === "rough"}
                    onChange={(e) => handleChange("scoringToPicture", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Yes &mdash; a rough cut that may still move</span>
                </label>
                <label key="standalone" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scoringToPicture"
                    value="standalone"
                    checked={formData.scoringToPicture === "standalone"}
                    onChange={(e) => handleChange("scoringToPicture", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">No &mdash; the music comes first</span>
                </label>
                <label key="unsure" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scoringToPicture"
                    value="unsure"
                    checked={formData.scoringToPicture === "unsure"}
                    onChange={(e) => handleChange("scoringToPicture", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Not sure yet</span>
                </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-moonlit-50 mb-3">
              How does the music need to behave?
            </label>
            <p className="text-xs text-moonlit-400 mb-3">
              Games usually need the last two &mdash; music that loops cleanly, or shifts with what the player is doing.
            </p>
            <div className="space-y-2">
                <label key="linear" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scoringAdaptive"
                    value="linear"
                    checked={formData.scoringAdaptive === "linear"}
                    onChange={(e) => handleChange("scoringAdaptive", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Plays start to finish, like a film cue</span>
                </label>
                <label key="loopable" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scoringAdaptive"
                    value="loopable"
                    checked={formData.scoringAdaptive === "loopable"}
                    onChange={(e) => handleChange("scoringAdaptive", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Loops seamlessly</span>
                </label>
                <label key="adaptive" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scoringAdaptive"
                    value="adaptive"
                    checked={formData.scoringAdaptive === "adaptive"}
                    onChange={(e) => handleChange("scoringAdaptive", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Layers or shifts with what&rsquo;s happening</span>
                </label>
                <label key="unsure" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scoringAdaptive"
                    value="unsure"
                    checked={formData.scoringAdaptive === "unsure"}
                    onChange={(e) => handleChange("scoringAdaptive", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Not sure &mdash; advise me</span>
                </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-moonlit-50 mb-2">
              Roughly how much music, and how many separate pieces?
            </label>
            <p className="text-xs text-moonlit-400 mb-2">
              A guess is fine &mdash; &ldquo;about ten minutes, maybe six cues&rdquo;.
            </p>
            <textarea
              value={formData.scoringAmount}
              onChange={(e) => handleChange("scoringAmount", e.target.value)}
              placeholder="e.g., 3 minutes for the trailer, plus a main theme..."
              className={"w-full px-3 py-2 bg-moonlit-900/60 border border-moonlit-700 rounded text-moonlit-50 placeholder-moonlit-500 focus:outline-none focus:border-brass-500"}
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-moonlit-50 mb-3">
              Where will it be heard?
            </label>
            <p className="text-xs text-moonlit-400 mb-3">
              This sets the licence, and it is agreed in writing before I write anything.
            </p>
            <div className="space-y-2">
                <label key="personal" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scoringLicence"
                    value="personal"
                    checked={formData.scoringLicence === "personal"}
                    onChange={(e) => handleChange("scoringLicence", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">A personal or student project</span>
                </label>
                <label key="single" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scoringLicence"
                    value="single"
                    checked={formData.scoringLicence === "single"}
                    onChange={(e) => handleChange("scoringLicence", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">One commercial project</span>
                </label>
                <label key="broadcast" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scoringLicence"
                    value="broadcast"
                    checked={formData.scoringLicence === "broadcast"}
                    onChange={(e) => handleChange("scoringLicence", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Broadcast, streaming or a released game</span>
                </label>
                <label key="buyout" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scoringLicence"
                    value="buyout"
                    checked={formData.scoringLicence === "buyout"}
                    onChange={(e) => handleChange("scoringLicence", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">I want to own it outright</span>
                </label>
                <label key="unsure" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scoringLicence"
                    value="unsure"
                    checked={formData.scoringLicence === "unsure"}
                    onChange={(e) => handleChange("scoringLicence", e.target.value as any)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">Not sure &mdash; talk me through it</span>
                </label>
            </div>
          </div>
        </div>
      )}

      {/* Q6 - Visual Design & Animation */}
      {show.design && (
        <div>
          <label className="block text-sm font-semibold text-moonlit-50 mb-3">
            Would you like help with any of the following?
          </label>
          <p className="text-xs text-moonlit-400 mb-3">
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
                  className="w-4 h-4 accent-brass-400"
                />
                <span className="text-sm text-moonlit-200">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Q6.1 - Animation Style Preference (CONDITIONAL) */}
      {show.design && hasAnimationNeeds && !formData.animationNeeds?.includes("Not sure — open to ideas") && (
        <div className="pl-4 border-l-2 border-brass-500">
          <label className="block text-sm font-semibold text-moonlit-50 mb-3">
            If animation is involved, what feels right?
          </label>
          <p className="text-xs text-moonlit-400 mb-3">
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
                  className="w-4 h-4 accent-brass-400"
                />
                <span className="text-sm text-moonlit-200">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Q6.2 - Character Scope (CONDITIONAL) */}
      {show.design && hasCharacterAnimation && (
        <div className="pl-4 border-l-2 border-brass-500">
          <label className="block text-sm font-semibold text-moonlit-50 mb-3">
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
                  className="w-4 h-4 accent-brass-400"
                />
                <span className="text-sm text-moonlit-200">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Q7 - Sound & Music Direction */}
      {show.musicBrief && (
        <div>
          <label className="block text-sm font-semibold text-moonlit-50 mb-3">
            How should music factor into this project?
          </label>
          <p className="text-xs text-moonlit-400 mb-3">
            Music is often the emotional spine — I can handle this end-to-end if you want.
          </p>
          <div className="space-y-2">
            {[
              { value: "have-music", label: "I already have music I want to use" },
              { value: "original", label: "I'd like original music written for this" },
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
                  className="w-4 h-4 accent-brass-400"
                />
                <span className="text-sm text-moonlit-200">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Q7.1 - Music Style (CONDITIONAL) */}
      {(musicNeedsStyle || type === "scoring") && (
        <div className="pl-4 border-l-2 border-brass-500">
          <label className="block text-sm font-semibold text-moonlit-50 mb-3">
            {type === "scoring"
              ? "What direction feels closest?"
              : "If music is involved, what direction feels closest?"}
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
                  className="w-4 h-4 accent-brass-400"
                />
                <span className="text-sm text-moonlit-200">{option}</span>
              </label>
            ))}
          </div>
          <textarea
            value={formData.musicStyleFreeText}
            onChange={(e) => handleChange("musicStyleFreeText", e.target.value)}
            placeholder="Any additional notes on music direction..."
            className="w-full px-3 py-2 mt-3 bg-moonlit-900/60 border border-moonlit-700 rounded text-moonlit-50 placeholder-moonlit-500 focus:outline-none focus:border-brass-500"
            rows={2}
          />
        </div>
      )}

      {/* Q7.2 - Music Usage Context */}
      {show.musicBrief && (
        <div>
          <label className="block text-sm font-semibold text-moonlit-50 mb-3">
            Where will it be used?
          </label>
          <p className="text-xs text-moonlit-400 mb-3">
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
                  className="w-4 h-4 accent-brass-400"
                />
                <span className="text-sm text-moonlit-200">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Q8 - Platforms */}
      {(show.video || show.design) && (
        <div>
          <label className="block text-sm font-semibold text-moonlit-50 mb-3">
            Where do you expect this to live?
          </label>
          <div className="space-y-2">
            {["YouTube", "Instagram / Reels", "TikTok", "Website", "Presentation / internal", "Not sure yet"].map(
              (option) => (
                <label key={option} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.platforms ?? []).includes(option)}
                    onChange={(e) => handleCheckboxGroupChange("platforms", option, e.target.checked)}
                    className="w-4 h-4 accent-brass-400"
                  />
                  <span className="text-sm text-moonlit-200">{option}</span>
                </label>
              )
            )}
          </div>
        </div>
      )}

      {/* Q9 - Timing */}
      <div>
        <label className="block text-sm font-semibold text-moonlit-50 mb-2">
          Is there a date this needs to be ready by?
        </label>
        <input
          type="date"
          value={formData.deadlineDate}
          onChange={(e) => handleChange("deadlineDate", e.target.value)}
          className="w-full px-3 py-2 mb-3 bg-moonlit-900/60 border border-moonlit-700 rounded text-moonlit-50 focus:outline-none focus:border-brass-500"
        />
        <textarea
          value={formData.deadlineReason}
          onChange={(e) => handleChange("deadlineReason", e.target.value)}
          placeholder="Why that date? (e.g., product launch, event, etc.)"
          className="w-full px-3 py-2 bg-moonlit-900/60 border border-moonlit-700 rounded text-moonlit-50 placeholder-moonlit-500 focus:outline-none focus:border-brass-500"
          rows={2}
        />
      </div>

      {/* Budget Comfort (Soft Question near Q9) */}
      <div>
        <label className="block text-sm font-semibold text-moonlit-50 mb-3">
          Which range feels realistic for this project?
        </label>
        <p className="text-xs text-moonlit-400 mb-3">
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
                className="w-4 h-4 accent-brass-400"
              />
              <span className="text-sm text-moonlit-200">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Q10 - Collaboration Preference */}
      <div>
        <label className="block text-sm font-semibold text-moonlit-50 mb-3">
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
                className="w-4 h-4 accent-brass-400"
              />
              <span className="text-sm text-moonlit-200">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Q11 - Catch-All */}
      <div>
        <label className="block text-sm font-semibold text-moonlit-50 mb-2">
          Is there anything else that matters?
        </label>
        <p className="text-xs text-moonlit-400 mb-2">
          Budgets, nerves, past bad experiences, big hopes — all fair game.
        </p>
        <textarea
          value={formData.anythingElse}
          onChange={(e) => handleChange("anythingElse", e.target.value)}
          placeholder="Anything else you'd like me to know..."
          className="w-full px-3 py-2 bg-moonlit-900/60 border border-moonlit-700 rounded text-moonlit-50 placeholder-moonlit-500 focus:outline-none focus:border-brass-500"
          rows={4}
        />
      </div>

      {/* Contact Preference + Timezone */}
      <div>
        <label className="block text-sm font-semibold text-moonlit-50 mb-3">
          Best way and time to reach you
        </label>
        <div className="mb-4">
          <label className="block text-xs font-medium text-moonlit-400 mb-2">Your timezone</label>
          <input
            type="text"
            value={formData.timezone}
            onChange={(e) => handleChange("timezone", e.target.value)}
            className="w-full px-3 py-2 bg-moonlit-900/60 border border-moonlit-700 rounded text-moonlit-50 placeholder-moonlit-500 focus:outline-none focus:border-brass-500"
            placeholder="e.g., America/Los_Angeles"
          />
        </div>
        <label className="block text-xs font-medium text-moonlit-400 mb-2">Best time to reach you</label>
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
                className="w-4 h-4 accent-brass-400"
              />
              <span className="text-sm text-moonlit-200">{option.label}</span>
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
            className="w-4 h-4 accent-brass-400"
          />
          <span className="text-sm text-moonlit-200">Email me a copy of my answers</span>
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || !formData.coreReason.trim()}
        className="w-full bg-brass-300 px-6 py-4 text-sm font-bold uppercase tracking-[0.18em] text-moonlit-950 transition hover:bg-brass-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Submitting..." : "Continue"}
      </button>
    </form>
  );
}
