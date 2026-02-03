# Plumbmonkey Site - AI Agent Instructions

## Architecture Overview

**Stack**: Next.js 15 (SSG export mode) + React 19 + Tailwind CSS + TypeScript  
**Purpose**: Marketing site + intake/estimation system for video editing services  
**Deployment**: Static HTML export to GitHub Pages (see `next.config.js` output: 'export')

### Core Flow
1. **Landing** ([app/page.tsx](app/page.tsx)) → Pricing & onboarding CTAs
2. **Orientation Questionnaire** ([app/onboarding/orientation/page.tsx](app/onboarding/orientation/page.tsx)) → Beginner-safe creative intake (11 questions, 3-5 min completion)
3. **Project Brief** ([/onboarding.html](/onboarding.html)) → Detailed technical specifications (legacy HTML; user auto-redirected after questionnaire)
4. **Intake Estimation** ([lib/intake/estimator.ts](lib/intake/estimator.ts)) → Converts project specs into service tier + timeline
5. **Service Tiers** ([data/tiers.ts](data/tiers.ts)) → 4 pricing tiers (Clean Cut $150–350 → Cinematic $900–3500+)
6. **Contact/Forms** → Formspree integration for submissions with all questionnaire responses included

## Key Patterns & Conventions

### Orientation Questionnaire Flow
**Entry Point**: `/onboarding/orientation` (replaces direct `/onboarding.html`)

**Component**: [app/components/OrientationQuestionnaire.tsx](app/components/OrientationQuestionnaire.tsx)
- 11 questions (Q1–Q11) capturing creative brief from first-time clients
- All questions optional except Q1 (core reason); accepts "not sure yet" for every field
- **Conditional rendering**: Q4.1 (brand assets), Q6.1–Q6.2 (animation style/scope), Q7.1 (music style) show based on prior selections
- **Local storage**: Auto-saves draft every 500ms to `plumbmonkey_orientation_draft` key; clears on successful submit
- **Schema**: [lib/intake/schema.ts](lib/intake/schema.ts) - `QuestionnaireInput` type with Zod validation
- **Formatter**: [lib/intake/questionnaireFormatter.ts](lib/intake/questionnaireFormatter.ts) - Converts responses to readable email text block

**Submission**:
- Sends to Formspree at `https://formspree.io/f/mqawknwn`
- Questionnaire responses formatted as email body via `formatQuestionnaireForEmail()`
- Tracked in Google Analytics as `gtag('event', 'orientation_submit', ...)`
- Success → redirect to `/onboarding.html` (project brief) after 2 seconds

### Form Submission Pattern
- Contact form ([app/contact/page.tsx](app/contact/page.tsx)) uses client-side Formspree (`https://formspree.io/f/mqawknwn`)
- Submits `FormData` as JSON, expects `response.status === 200` for success
- Includes Google Analytics conversion tracking: `gtag('event', 'form_submit', ...)`
- **Pattern**: Form → Formspree → Success state + message + GA event

### Estimation Logic
[lib/intake/estimator.ts](lib/intake/estimator.ts) calculates project feasibility:
```
baseDays = rawMinutes / 120  // ~2h raw footage per day
multipliers applied for: color correction (1.25x–1.5x), VFX (1.25x–1.75x), 
motion graphics (1.25x–2.5x), audio cleanup, multi-aspect exports
forced to "bid" path if: special VFX, designed motion graphics, or >120 min footage
```
**Input schema**: [lib/intake/schema.ts](lib/intake/schema.ts) (Zod validation)

### Metadata Strategy
Every page exports Next.js `Metadata` with SEO fields:
- `description`, `keywords`, `openGraph`, `twitter` card
- Schema.org JSON-LD structured data in [app/layout.tsx](app/layout.tsx) (line ~48+)
- **Pattern**: Consistent meta tags + social preview images

### Styling
- **Tailwind only** (no custom CSS components; minimal [styles/styles.css](styles/styles.css))
- Color palette: `zinc-*` (grays), `teal-*`, `purple-*`, `orange-*` (accent brands)
- Sticky header NavBar with dark backdrop blur (`bg-zinc-950/90 backdrop-blur`)
- **Pattern**: Utility-first; no CSS-in-JS or styled components

### TypeScript Strictness
`tsconfig.json` has `"strict": false` but still uses type annotations. **Avoid relying on implicit `any`** — add return types to functions, use Zod for runtime validation.

## Critical Developer Workflows

### Local Development
```bash
npm run dev        # Next.js dev server on http://localhost:3000
npm run build      # Generates static HTML to .next/
npm run start      # Serves exported static site
npm test           # Placeholder (no tests currently defined)
```

### File Organization
- **Page routes**: `app/{route}/page.tsx` + optional `app/{route}/metadata.ts`
- **Shared components**: `app/components/` (used across pages)
- **Data/config**: `data/tiers.ts`, `lib/intake/schema.ts`, `lib/intake/estimator.ts` (single source of truth for pricing & validation)
- **Intake utilities**: `lib/intake/questionnaireFormatter.ts` (converts questionnaire responses to email format)
- **Static HTML pages** (pricing-scope.html, onboarding.html, upload.html) exist in root for now; prefer moving to `app/` routes if adding new features

### Deployment & Export
- `next.config.js` sets `output: 'export'` (static-only; no server-side rendering)
- Exports to `.next/` → GitHub Pages deployment
- **Implication**: No API routes; all external calls (Formspree, Gumroad links) are client-side

## Integration Points & External Services

1. **Formspree** (`formspree.io/f/mqawknwn`)
   - Email form backend; returns JSON response with `ok: true` on success
   - Used in [app/contact/page.tsx](app/contact/page.tsx)

2. **Google Analytics** (gtag)
   - Conversion tracking on form submit
   - Assumes `window.gtag` is loaded (injected by GA script in HTML head)

3. **Gumroad** (`plumbmonkey.gumroad.com`)
   - Digital products shop; linked in NavBar and home page CTAs
   - External redirect; no integration code needed

4. **Google Search Console / Verification**
   - Meta tag in [app/layout.tsx](app/layout.tsx) for site verification

## Common Tasks & Patterns

### Adding a New Page
1. Create `app/{slug}/page.tsx` with `export const metadata`
2. Add route to NavBar if needed ([app/components/NavBar.tsx](app/components/NavBar.tsx))
3. Follow Tailwind utility + dark theme (bg-zinc-950, text-zinc-50)
4. Use Metadata type from `next` for SEO

### Updating Pricing Tiers
1. Edit [data/tiers.ts](data/tiers.ts) — this is the single source of truth
2. Adjust multipliers in [lib/intake/estimator.ts](lib/intake/estimator.ts) if business logic changes
3. Add tier name to `z.enum()` in [lib/intake/schema.ts](lib/intake/schema.ts) if adding new categories

### Handling Form Data
- Use **Zod** for runtime validation (existing pattern: `IntakeInput.parse(...)`)
- Submit to external service (Formspree) via fetch with `Content-Type: application/json`
- Always include error states + user feedback messages

### Build & TypeScript Checks
- Run `npm run build` to catch TypeScript errors; fix before deploying
- Static export means **no server-side code** — keep all logic client-side or in utility functions

## Specific Constraints & Gotchas

- **No API routes**: All form submissions go to Formspree; use fetch from client
- **Static export only**: `revalidate`, incremental static regeneration not available
- **TypeScript strict: false**: Use explicit types anyway to keep code maintainable
- **Tailwind content globs**: Updated in `tailwind.config.js` if adding new directories
- **HTML files in root** (pricing-scope.html, onboarding.html): These are legacy; prefer moving to Next.js pages
