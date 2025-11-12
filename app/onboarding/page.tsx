"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { IntakeInput as IntakeSchema } from "@/lib/intake/schema";
import { estimate } from "@/lib/intake/estimator";

type Tier = "essential" | "pro" | "super";
type ContactPref = "phone" | "zoom";
type AspectRatio = "16:9" | "9:16" | "1:1";
type Platforms = {
  youtube: boolean;
  instagram: boolean;
  tiktok: boolean;
  facebook: boolean;
  website: boolean;
  other: string;
};

const STORAGE_KEY = "pm_onboarding_draft_v1";

const tierDefaults: Record<Tier, Partial<z.infer<typeof IntakeSchema>>> = {
  essential: {
    rawMinutes: 30,
    color: "none",
    vfx: "none",
    motionGraphics: "none",
    securityBlur: "none",
    audioCleanup: false,
    multiAspect: false,
  },
  pro: {
    rawMinutes: 60,
    color: "basic",
    vfx: "light",
    motionGraphics: "none",
    securityBlur: "none",
    audioCleanup: false,
    multiAspect: true,
  },
  super: {
    rawMinutes: 120,
    color: "basic",
    vfx: "medium",
    motionGraphics: "titles",
    securityBlur: "few",
    audioCleanup: false,
    multiAspect: true,
  },
};

export default function OnboardingPage() {
  // read ?tier=... once (map older names too)
  const urlTier = useMemo<Tier | null>(() => {
    if (typeof window === "undefined") return null;
    const t = new URLSearchParams(window.location.search).get("tier")?.toLowerCase();
    if (t === "essential" || t === "budget") return "essential";
    if (t === "pro") return "pro";
    if (t === "super") return "super";
    return null;
  }, []);

  // -------------------------
  // Core estimator inputs
  // -------------------------
  const [data, setData] = useState<any>({
    purpose: "",
    rawMinutes: 30,
    color: "none", // none | basic | stylized
    vfx: "none", // none | light | medium | special
    motionGraphics: "none", // none | titles | designed
    securityBlur: "none", // none | few | many
    audioCleanup: false,
    multiAspect: false,
    deadlineISO: "",
  });

  // Apply tier defaults after initial render (but before user edits)
  useEffect(() => {
    if (urlTier) setData((d: any) => ({ ...d, ...tierDefaults[urlTier] }));
  }, [urlTier]);

  // -------------------------
  // Project detail fields (not required by estimator)
  // -------------------------
  const [story, setStory] = useState("");
  const [platforms, setPlatforms] = useState<Platforms>({
    youtube: false,
    instagram: false,
    tiktok: false,
    facebook: false,
    website: false,
    other: "",
  });
  const [aspectRatios, setAspectRatios] = useState<AspectRatio[]>([]);
  const [brandLinks, setBrandLinks] = useState("");
  const [musicLinks, setMusicLinks] = useState("");
  const [contactPref, setContactPref] = useState<ContactPref>("phone");

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof estimate> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // -------------------------
  // Draft: LOAD once on mount
  // -------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);

      if (draft.data) setData((d: any) => ({ ...d, ...draft.data }));
      if (typeof draft.story === "string") setStory(draft.story);
      if (draft.platforms) setPlatforms((p) => ({ ...p, ...draft.platforms }));
      if (Array.isArray(draft.aspectRatios)) setAspectRatios(draft.aspectRatios);
      if (typeof draft.brandLinks === "string") setBrandLinks(draft.brandLinks);
      if (typeof draft.musicLinks === "string") setMusicLinks(draft.musicLinks);
      if (draft.contactPref === "phone" || draft.contactPref === "zoom")
        setContactPref(draft.contactPref);
    } catch {
      /* ignore */
    }
  }, []);

  // -------------------------
  // Draft: SAVE (debounced)
  // -------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = setTimeout(() => {
      try {
        const payload = {
          data,
          story,
          platforms,
          aspectRatios,
          brandLinks,
          musicLinks,
          contactPref,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [data, story, platforms, aspectRatios, brandLinks, musicLinks, contactPref]);

  const onEstimate = () => {
    setError(null);
    try {
      const parsed = IntakeSchema.pick({
        purpose: true,
        rawMinutes: true,
        color: true,
        vfx: true,
        motionGraphics: true,
        securityBlur: true,
        audioCleanup: true,
        multiAspect: true,
        deadlineISO: true,
      }).parse(data);

      const r = estimate(parsed as any);
      setResult(r);
    } catch (e: any) {
      const fieldErrors = e?.errors || [];
      if (fieldErrors.length > 0) {
        const field = fieldErrors[0]?.path?.[0];
        const message = fieldErrors[0]?.message;
        if (field === "purpose") {
          setError("Please describe your project purpose (at least 2 characters)");
        } else {
          setError(message || "Please check your inputs.");
        }
      } else {
        setError("Please check your inputs.");
      }
    }
  };

  const clearDraft = () => {
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    setData((d: any) => ({
      ...d,
      purpose: "",
      rawMinutes: urlTier ? tierDefaults[urlTier]?.rawMinutes ?? 30 : 30,
      color: "none",
      vfx: "none",
      motionGraphics: "none",
      securityBlur: "none",
      audioCleanup: false,
      multiAspect: false,
      deadlineISO: "",
    }));
    setStory("");
    setPlatforms({
      youtube: false,
      instagram: false,
      tiktok: false,
      facebook: false,
      website: false,
      other: "",
    });
    setAspectRatios([]);
    setBrandLinks("");
    setMusicLinks("");
    setContactPref("phone");
  };

  // -------------------------
  // Render
  // -------------------------
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <section className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
          Project Brief
        </h1>
        <p className="text-lg md:text-xl text-zinc-300">
          Describe your vision
        </p>
        <p className="mt-4 text-sm text-zinc-400">
          Clarity on your desired outcome, timing and package choice.
        </p>

        {!result && (
          <>
            {/* A) Core knobs */}
            <div className="mt-6 grid gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <label className="block">
                <span className="text-sm font-medium">Purpose <span className="text-red-400">*</span></span>
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="YouTube / promo / training / event / music video…"
                  value={data.purpose}
                  onChange={(e) => setData((d: any) => ({ ...d, purpose: e.target.value }))}
                />
                {data.purpose.length < 2 && (
                  <p className="mt-1 text-xs text-amber-400">Please describe your project purpose (at least 2 characters)</p>
                )}
              </label>

              <div className="flex items-end gap-4">
                <label className="block">
                  <span className="text-sm font-medium">Footage duration (minutes)</span>
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-28 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={data.rawMinutes}
                    onChange={(e) =>
                      setData((d: any) => ({ ...d, rawMinutes: Number(e.target.value) }))
                    }
                  />
                </label>

                <label className="flex-1 block">
                  <span className="text-sm font-medium">Color grading</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={data.color}
                    onChange={(e) => setData((d: any) => ({ ...d, color: e.target.value }))}
                  >
                    <option value="none">none</option>
                    <option value="basic">basic</option>
                    <option value="stylized">stylized look</option>
                  </select>
                </label>

                <label className="flex-1 block">
                  <span className="text-sm font-medium">VFX</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={data.vfx}
                    onChange={(e) => setData((d: any) => ({ ...d, vfx: e.target.value }))}
                  >
                    <option value="none">none</option>
                    <option value="light">light (≤2 shots)</option>
                    <option value="medium">medium (≤4 shots)</option>
                    <option value="special">special (custom bid)</option>
                  </select>
                </label>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={data.audioCleanup}
                    onChange={(e) =>
                      setData((d: any) => ({ ...d, audioCleanup: e.target.checked }))
                    }
                  />
                  <span className="text-sm">Audio cleanup</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <span className="text-sm">Deadline</span>
                  <input
                    type="date"
                    className="ml-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm"
                    value={data.deadlineISO || ""}
                    onChange={(e) => setData((d: any) => ({ ...d, deadlineISO: e.target.value }))}
                  />
                </label>
              </div>

              {/* Multi-aspect exports selection */}
              <div className="border-t border-zinc-700 pt-4">
                <div className="text-sm font-medium mb-3">Export aspect ratios</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "16:9 (Landscape)", value: "16:9" },
                    { label: "9:16 (Portrait)", value: "9:16" },
                    { label: "1:1 (Square)", value: "1:1" },
                  ].map((ratio) => (
                    <label key={ratio.value} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={aspectRatios.includes(ratio.value as AspectRatio)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAspectRatios([...aspectRatios, ratio.value as AspectRatio]);
                          } else {
                            setAspectRatios(aspectRatios.filter((ar) => ar !== ratio.value));
                          }
                        }}
                      />
                      <span className="text-sm">{ratio.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="mt-1 text-left text-sm text-teal-400 hover:underline"
                onClick={() => setShowAdvanced((s) => !s)}
              >
                {showAdvanced ? "Hide advanced" : "Show advanced options"}
              </button>

              {showAdvanced && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium">Motion graphics</span>
                    <select
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      value={data.motionGraphics}
                      onChange={(e) =>
                        setData((d: any) => ({ ...d, motionGraphics: e.target.value }))
                      }
                    >
                      <option value="none">none</option>
                      <option value="titles">titles / lower-thirds</option>
                      <option value="designed">designed package</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium">Security blur</span>
                    <select
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      value={data.securityBlur}
                      onChange={(e) =>
                        setData((d: any) => ({ ...d, securityBlur: e.target.value }))
                      }
                    >
                      <option value="none">none</option>
                      <option value="few">few shots</option>
                      <option value="many">many shots</option>
                    </select>
                  </label>
                </div>
              )}
            </div>

            {/* B) Project details (in writing) */}
            <div className="mt-6 grid gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <label className="block">
                <span className="text-sm font-medium">Story / key message</span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  rows={4}
                  placeholder="What should the audience feel or do after watching?"
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                />
              </label>

              <div>
                <div className="text-sm font-medium">Where will this be used?</div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  {[
                    ["youtube", "YouTube"],
                    ["instagram", "Instagram"],
                    ["tiktok", "TikTok"],
                    ["facebook", "Facebook"],
                    ["website", "Website"],
                  ].map(([key, label]) => (
                    <label key={key} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={(platforms as any)[key]}
                        onChange={(e) =>
                          setPlatforms((p) => ({ ...p, [key]: e.target.checked }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <input
                  className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  placeholder="Other platform (optional)"
                  value={platforms.other}
                  onChange={(e) => setPlatforms((p) => ({ ...p, other: e.target.value }))}
                />
              </div>

              <label className="block">
                <span className="text-sm font-medium">Branding links (logos, fonts, palette)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  placeholder="Paste Drive/Dropbox/WeTransfer links"
                  value={brandLinks}
                  onChange={(e) => setBrandLinks(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">Music links / notes</span>
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  placeholder="Song link(s) or note 'compose original'"
                  value={musicLinks}
                  onChange={(e) => setMusicLinks(e.target.value)}
                />
              </label>

              <div className="text-sm">
                Preferred follow-up:{" "}
                <label className="ml-2 mr-4 inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="contactPref"
                    checked={contactPref === "phone"}
                    onChange={() => setContactPref("phone")}
                  />
                  <span>Phone call</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="contactPref"
                    checked={contactPref === "zoom"}
                    onChange={() => setContactPref("zoom")}
                  />
                  <span>Zoom/Meet</span>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Draft is saved locally as you type.</span>
                <button
                  type="button"
                  className="text-xs text-teal-400 hover:underline"
                  onClick={clearDraft}
                >
                  Clear saved draft
                </button>
              </div>
            </div>

            {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}

            <button
              onClick={onEstimate}
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-teal-600 text-white px-5 py-3 font-semibold hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              Get estimate
            </button>
          </>
        )}

        {result && (
          <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-2xl font-semibold">your estimate</h2>
            <p className="mt-2">
              Estimated timeline: <b>{result.estDays} day(s)</b>
            </p>
            <p className="mt-1">
              Recommended tier: <b>{result.tier}</b>
            </p>
            <p className="mt-4 text-sm text-zinc-400">
              Two revisions included. Heavier VFX/motion graphics can extend timelines; I put my heart into every frame.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {result.path === "standard" && (
                <Link
                  href={`/booking?tier=${result.tier}`}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-5 py-2.5 font-medium"
                >
                  Book a production slot
                </Link>
              )}
              <a
                href="/contact.html"
                className="inline-flex items-center justify-center rounded-lg bg-zinc-50 text-zinc-950 px-5 py-2.5 font-medium hover:opacity-90"
              >
                Free bid/consult
              </a>
              <Link
                href={`/upload`}
                className="inline-flex items-center justify-center rounded-lg bg-teal-600 text-white px-5 py-2.5 font-medium hover:bg-teal-500"
              >
                Go to upload
              </Link>
            </div>

            {/* quick recap for you (not submitted anywhere yet) */}
            <div className="mt-6 text-xs text-zinc-400">
              <div>Story/message: {story || "—"}</div>
              <div>
                Platforms:{" "}
                {Object.entries(platforms)
                  .filter(([k, v]) => typeof v === "boolean" && v)
                  .map(([k]) => k)
                  .concat(platforms.other ? [platforms.other] : [])
                  .join(", ") || "—"}
              </div>
              <div>Aspect ratios: {aspectRatios.length > 0 ? aspectRatios.join(", ") : "—"}</div>
              <div>Branding: {brandLinks || "—"}</div>
              <div>Music: {musicLinks || "—"}</div>
              <div>Contact: {contactPref}</div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

