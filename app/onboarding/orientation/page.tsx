"use client";

import Link from "next/link";
import { useState } from "react";
import OrientationQuestionnaire from "@/app/components/OrientationQuestionnaire";
import { formatQuestionnaireForEmail } from "@/lib/intake/questionnaireFormatter";
import type { QuestionnaireInput } from "@/lib/intake/schema";

// Ensure this route is statically exported
export const dynamic = "force-static";

export default function OrientationPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (formData: QuestionnaireInput) => {
    setIsSubmitting(true);
    setStatusMessage("");
    setIsError(false);

    try {
      // Format questionnaire responses for email
      const questionnaireText = formatQuestionnaireForEmail(formData);

      // Prepare email body with questionnaire responses
      const emailData = {
        name: "Questionnaire Submission",
        email: "project-inquiry@plumbmonkey.online",
        subject: "New Project Questionnaire Submission",
        message: questionnaireText,
        _template: "questionnaire",
      };

      const response = await fetch("https://formspree.io/f/mqawknwn", {
        method: "POST",
        body: JSON.stringify(emailData),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      let responseData: any = {};
      try {
        responseData = await response.json();
      } catch (e) {
        // If JSON parsing fails, that's okay - check status
      }

      if (response.status === 200 || response.ok || responseData.ok) {
        // Debug logging
        console.log("Orientation submitted successfully");
        console.log("Response status:", response.status);
        console.log("Redirecting to /onboarding.html in 2 seconds");

        // Track conversion in Google Analytics
        if (typeof window !== "undefined" && typeof (window as any).gtag !== "undefined") {
          (window as any).gtag("event", "orientation_submit", {
            event_category: "engagement",
            event_label: "questionnaire",
          });
        }

        setStatusMessage("You're done. I'll review this personally and follow up with next steps.");
        setIsError(false);

        // Redirect to project brief after 2 seconds
        setTimeout(() => {
          console.log("Executing redirect to /onboarding.html");
          window.location.href = "/onboarding.html";
        }, 2000);
      } else {
        setStatusMessage(
          "Something went wrong. Please try again or email your answers to plumbmonkey@proton.me."
        );
        setIsError(true);
      }
    } catch (error) {
      console.error("Submission error:", error);
      setStatusMessage(
        "Error submitting your responses. Please try again or email plumbmonkey@proton.me with your answers."
      );
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-moonlit-950 pt-16">
      <div className="relative overflow-hidden px-6 py-20 md:py-24">
        <div className="manor-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-2xl">
          <div className="mb-10">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.36em] text-brass-300">
              Start a project
            </p>
            {/* Was "Let's talk about your video." The studio sells five lines now
                and four of them are not video, so the form opens by asking which
                one this is (Q0) rather than assuming. */}
            <h1 className="font-display text-4xl font-semibold leading-tight text-white md:text-5xl">
              Tell me what you're making.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-moonlit-200">
              Software, a score, design and animation, a video, or some combination — these
              questions help me understand it properly before we talk. Not sure what you
              need?{" "}
              <Link href="/services" className="text-brass-300 underline underline-offset-4 transition hover:text-brass-200">
                See what the studio does
              </Link>
              .
            </p>
          </div>

          {statusMessage && (
            <div
              role="status"
              className={`mb-6 border px-4 py-3 text-sm ${
                isError
                  ? "border-burgundy-400/60 bg-burgundy-950/40 text-burgundy-100"
                  : "border-brass-500/50 bg-brass-900/20 text-brass-100"
              }`}
            >
              {statusMessage}
            </div>
          )}

          <OrientationQuestionnaire onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
      </div>
    </main>
  );
}
