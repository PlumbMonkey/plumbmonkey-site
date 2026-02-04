"use client";

import { useState } from "react";
import OrientationQuestionnaire from "@/app/components/OrientationQuestionnaire";
import { formatQuestionnaireForEmail } from "@/lib/intake/questionnaireFormatter";
import type { QuestionnaireInput } from "@/lib/intake/schema";

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
    <main className="min-h-screen bg-zinc-950 text-zinc-50 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">Let's talk about your video.</h1>
          <p className="text-lg text-zinc-400">
            Quick questions to help me understand your project better.
          </p>
        </div>

        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              isError
                ? "bg-red-900/20 border-red-700 text-red-200"
                : "bg-green-900/20 border-green-700 text-green-200"
            }`}
          >
            {statusMessage}
          </div>
        )}

        <OrientationQuestionnaire onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </div>
    </main>
  );
}
