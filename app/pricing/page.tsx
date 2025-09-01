import React from "react";
import Link from "next/link";

const tiers = [
	{
		name: "Budget",
		price: "$149",
		description: "Up to 30 min raw → 5–10 min final",
		features: ["Cuts & transitions", "1 revision included"],
		ctaLabel: "Start a Project",
		ctaHref: "/onboarding?tier=budget",
		featured: false,
	},
	{
		name: "Pro",
		price: "$349",
		description: "Up to 60 min raw → 15–30 min final",
		features: [
			"Cuts & transitions",
			"Color grading",
			"Light VFX (≤2 instances)",
			"1 revision included",
		],
		ctaLabel: "Start a Project",
		ctaHref: "/onboarding?tier=pro",
		featured: true,
		badge: "Best Value",
	},
	{
		name: "Super",
		price: "$699",
		description: "Up to 120 min raw → 30–45 min final",
		features: [
			"Cuts & transitions",
			"Color grading",
			"Medium VFX (≤4 instances)",
			"Motion graphics (simple titles)",
			"1 revision included",
		],
		ctaLabel: "Start a Project",
		ctaHref: "/onboarding?tier=super",
		featured: false,
	},
	{
		name: "Special VFX (Bid)",
		price: "Custom quote",
		description:
			"Blender/Fusion/3D, heavy roto, particles, multi-shot composites",
		features: [
			"Quoted after a 3–5s test",
			"Delivered as shot packages or integrated into your edit",
		],
		ctaLabel: "Free Bid/Consult",
		ctaHref: "/consult",
		featured: false,
	},
];

const addons = [
	{
		name: "Captions/Subtitles",
		price: "$1.25/min",
		description:
			"Professional captions or subtitles for your final video duration.",
	},
	{
		name: "Security blur/redaction",
		price: "from $50 + $10/min",
		description:
			"Blur or redact sensitive faces, plates, or screens in your footage.",
	},
	{
		name: "Multi-aspect exports",
		price: "+15%",
		description:
			"Get your video in 16:9, 9:16, and 1:1 formats for all platforms.",
	},
	{
		name: "Audio cleanup",
		price: "+$40 (light) / $80+",
		description:
			"Remove noise, hum, or other audio issues (light or heavy).",
	},
	{
		name: "Rush (<72h)",
		price: "+25–50%",
		description: "Expedited delivery for urgent projects.",
	},
	{
		name: "Extra revision",
		price: "$40/hr",
		description:
			"Additional editing time for more changes or feedback rounds.",
	},
];

const vfxDefinitions = [
	{
		term: "Light VFX (Pro)",
		definition:
			"≤2 instances total (one effect on one shot): tracked blur, simple screen fix, basic qualifier/patch.",
	},
	{
		term: "Medium VFX (Super)",
		definition:
			"≤4 instances total: tracked text in scene, basic screen replace, minor roto, simple object removal.",
	},
	{
		term: "Special VFX (Bid)",
		definition:
			"Blender/Fusion/3D inserts, heavy roto, particles, multi-shot comps. Quoted after a 3–5s test.",
	},
	{
		term: "Instance",
		definition:
			"One finished effect on one continuous shot. Multiple shots = multiple instances.",
	},
];

const faqs = [
	{
		question: "What do the tiers include?",
		answer:
			"Budget = cuts & transitions. Pro = +color grade + Light VFX (≤2 shots). Super = +Medium VFX (≤4 shots) + simple motion graphics. Special VFX = Bid (Blender/Fusion/3D/heavy roto).",
	},
	{
		question: "What counts as one VFX “instance”?",
		answer:
			"One finished effect on one continuous shot. Same effect on 3 shots = 3 instances. Two different effects on one shot = 2 instances.",
	},
	{
		question: "How many revisions are included?",
		answer:
			"One round per project (group your notes). Extra revisions billed $40/hr.",
	},
	{
		question: "How fast is turnaround?",
		answer:
			"I process ~2 hours of raw/day for core editing. Color/VFX/MG can double or triple timelines. You’ll see an estimate before booking.",
	},
	{
		question: "Do you do rush jobs?",
		answer:
			"Yes. Under 72 hours adds +25–50% depending on scope and readiness of assets.",
	},
	{
		question: "Can I book a free consult first?",
		answer:
			"Yes—if your project is complex or exceeds scope, choose Free Bid/Consult. No charge.",
	},
	{
		question: "Do you require a deposit?",
		answer:
			"For standard packages: Full or 50% deposit to book. The deposit becomes non-refundable once editing begins. Balance due before final delivery.",
	},
	{
		question: "What formats do you deliver?",
		answer:
			"H.264/H.265 (web), ProRes (on request). Multi-aspect (16:9, 9:16, 1:1) available (+15%).",
	},
	{
		question: "Do you provide captions and thumbnails?",
		answer:
			"Captions $1.25/min (final runtime). Thumbnails available on request (quoted).",
	},
	{
		question: "Can you blur faces, plates, or screens?",
		answer:
			"Yes. Security blur/redaction starts from $50 + $10/min of affected footage.",
	},
	{
		question: "Do you handle audio cleanup and music?",
		answer:
			"Light cleanup available (+$40 baseline). You can provide music or I’ll source licensed tracks; usage must be properly licensed.",
	},
	{
		question: "What assets do you need from me?",
		answer:
			"Footage, brand kit (fonts/colors/logos), any images/audio, and style references (links). Confirm you have the rights to everything you send.",
	},
	{
		question: "Who owns the final video and project files?",
		answer:
			"You own the final rendered video upon full payment. Project files/working assets are not included by default; available as an add-on/hand-off fee.",
	},
	{
		question: "Will you use my video in your portfolio?",
		answer:
			"By default, yes—short excerpts only. If this is sensitive, uncheck the portfolio permission in the form or request an NDA.",
	},
	{
		question: "How do we communicate and hand off files?",
		answer:
			"All confirmations go to plumbmonkey@proton.me. Upload via Drive/Dropbox/portal link provided after booking.",
	},
	{
		question: "Do you charge sales tax?",
		answer:
			"Yes, CAD + GST. If you’re GST-registered, keep the invoice for ITCs.",
	},
	{
		question: "Where are you based / what’s your timezone?",
		answer: "Calgary, Canada",
	},
];

export default function Page() {
	return (
		<>
			{/* Hero Section */}
			<header className="w-full bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 py-16 px-4 flex items-center justify-center">
				<div className="max-w-2xl mx-auto text-center">
					<h1 className="text-3xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
						Simple, transparent pricing for VFX projects
					</h1>
					<p className="text-lg md:text-xl text-zinc-700 dark:text-zinc-300 mb-8">
						Choose the plan that fits your production. No hidden fees, no
						surprises.
					</p>
					<Link
						href="/onboarding"
						className="inline-block px-8 py-3 rounded-lg bg-teal-500 text-white font-semibold text-lg shadow hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
						aria-label="Start a Project"
					>
						Start a Project
					</Link>
				</div>
			</header>

			{/* Pricing Tiers Section */}
			<section className="max-w-6xl mx-auto py-12 px-4">
				<h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">
					Tiers & Pricing (CAD + GST)
				</h2>
				<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
					{tiers.map((tier) => (
						<div
							key={tier.name}
							className={`rounded-2xl shadow-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 p-6 flex flex-col items-center border-2 ${
								tier.featured
									? "border-teal-500 scale-105 z-10 relative"
									: "border-zinc-200 dark:border-zinc-800"
							}`}
						>
							{tier.badge && (
								<div className="mb-2 px-3 py-1 bg-teal-500 text-white text-xs rounded-full font-semibold uppercase tracking-wide">
									{tier.badge}
								</div>
							)}
							<h3 className="text-xl font-bold mb-2">{tier.name}</h3>
							<div className="mb-2 text-3xl font-extrabold">
								{tier.price}
							</div>
							<div className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
								{tier.description}
							</div>
							<ul className="mb-6 space-y-2 text-left w-full">
								{tier.features.map((feature) => (
									<li key={feature} className="flex items-center">
										<span className="inline-block w-2 h-2 bg-teal-500 rounded-full mr-2"></span>
										<span>{feature}</span>
									</li>
								))}
							</ul>
							<a
								href={tier.ctaHref}
								className={`mt-auto inline-block w-full py-2 px-4 text-center rounded-lg font-semibold ${
									tier.featured
										? "bg-teal-500 text-white hover:bg-teal-600"
										: "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-700"
								} transition`}
								aria-label={tier.ctaLabel}
							>
								{tier.ctaLabel}
							</a>
						</div>
					))}
				</div>
			</section>

			{/* Add-ons Section */}
			<section className="max-w-4xl mx-auto py-12 px-4">
				<h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">
					Add-ons
				</h2>
				<ul className="grid gap-6 sm:grid-cols-2">
					{addons.map((addon) => (
						<li
							key={addon.name}
							className="bg-white dark:bg-zinc-900 rounded-xl shadow p-6 flex flex-col"
						>
							<div className="flex justify-between items-center mb-2">
								<span className="text-lg font-semibold">{addon.name}</span>
								<span className="text-base font-bold text-teal-600 dark:text-teal-400">
									{addon.price}
								</span>
							</div>
							<p className="text-zinc-700 dark:text-zinc-300 text-sm">
								{addon.description}
							</p>
						</li>
					))}
				</ul>
			</section>

			{/* VFX Definitions Section */}
			<section className="max-w-3xl mx-auto py-12 px-4">
				<h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">
					VFX Definitions
				</h2>
				<dl className="space-y-6">
					{vfxDefinitions.map((entry) => (
						<div key={entry.term}>
							<dt className="font-semibold text-lg text-teal-700 dark:text-teal-400">
								{entry.term}
							</dt>
							<dd className="ml-2 text-zinc-700 dark:text-zinc-300">
								{entry.definition}
							</dd>
						</div>
					))}
				</dl>
			</section>

			{/* FAQ Section */}
			<section className="max-w-3xl mx-auto py-12 px-4">
				<h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">
					FAQ
				</h2>
				<ul className="space-y-4">
					{faqs.map((faq) => (
						<li key={faq.question}>
							<details className="group rounded-lg bg-white dark:bg-zinc-900 shadow p-4">
								<summary className="cursor-pointer font-semibold text-lg text-teal-700 dark:text-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400 rounded transition">
									{faq.question}
								</summary>
								<div className="mt-2 text-zinc-700 dark:text-zinc-300">
									{faq.answer}
								</div>
							</details>
						</li>
					))}
				</ul>
			</section>
		</>
	);
}