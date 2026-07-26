"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function StickyCTA() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div
      className="
        fixed bottom-0 left-0 right-0 z-50
        md:bottom-6 md:right-6 md:left-auto md:w-auto
        flex justify-center md:justify-end pointer-events-none
      "
      aria-label="Sticky Call To Action"
    >
      <div className="relative pointer-events-auto px-4 py-2 md:px-6 md:py-3 bg-burgundy-600 text-white rounded-t-xl md:rounded-xl shadow-lg flex items-center gap-3">
        <span className="font-display font-semibold text-lg">Ready to start your project?</span>
        <Link
          href="/contact"
          className="ml-2 bg-white text-burgundy-600 hover:bg-brass-50 font-bold px-4 py-2 rounded-lg shadow transition focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Start a Project"
        >
          Start a Project
        </Link>
        <button
          onClick={() => setVisible(false)}
          className="absolute top-2 right-2 p-2 rounded-full hover:bg-burgundy-800 focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Dismiss call to action"
          type="button"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <title>Close</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}