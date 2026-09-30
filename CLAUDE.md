@AGENTS.md

# CLAUDE.md — Instamart Smart Basket Planner

> Condensed from the original brief (photos in `Project brief/`, do NOT re-read them — this file is the source of truth).
> Swiggy MCP facts: read `docs/swiggy/DIGEST.md` first; raw pages in `docs/swiggy/*.md`. Plan: `PLAN.md`.

## 1. Identity & thesis
Portfolio-quality, **mobile-first** assistant that turns a natural-language shopping *mission* into an **editable, availability-aware Instamart basket**.
Example: "I'm hosting six people tonight. I need vegetarian snacks and breakfast items under ₹1,200, preferably from trusted brands, delivered as soon as possible."
People think in missions, not SKUs: weekly stock-up, monthly replenishment, party/occasion, breakfast/meal prep, healthy snacks, baby/pet, emergency top-up, budget, gifting.
North star: more successful basket creation + repeat usage by making mission shopping faster, clearer, more confidence-inspiring.
**Independent concept/prototype** — never claim it is an official Instamart feature. Never auto-place orders, never expose credentials.

## 2. Instamart themes to reflect
Conversion (discovery→cart friction) · Conversational discovery (vague/multi-constraint) · Personalisation (segments, missions) · Availability (stockouts, substitutions, serviceability, delivery promise) · Commercial balance (budget, assortment, promos, basket size) · Design-system reuse (components, tokens, states).

## 3. Goals / non-goals
Goals: mission → structured plan; useful first basket with minimal effort; explainable + editable recs; surface uncertainty (never pretend price/stock is guaranteed); fast swap/remove/replace/add; clear cart preview before any consequential action. Secondary: learn from explicit feedback, saved baskets/repeat missions.
Non-goals: checkout/order placement, payments, delivery-partner features, full app replacement, authoritative medical/nutrition advice, personalisation on sensitive attributes, scraping private data, a generic chatbot without a structured basket.

## 4. Users
Primary: busy urban consumer who knows the occasion but won't browse hundreds of products. Secondary: household recurring shopper, small-event host, budget-bound student/young pro, user wanting alternatives for unavailable items.

## 5. Core journey
1 open → 2 enter mission → 3 extract constraints (mission type, people, budget, dietary, brand, delivery-time, must-haves, avoid) → 4 ask **≤2** high-value clarifications → 5 search Instamart via MCP → 6 normalise to internal model → 7 group: Must-have / Recommended / Optional / Alternatives → 8 review explanations, edit → 9 cart preview (totals, availability, substitutions, uncertainty) → 10 save as reusable template.

## 6. Feature requirements
- **Intake**: free text + structured controls (budget, people, urgency, dietary, brand, must-haves, avoid). Free text stays visible & editable.
- **Classification**: stock-up, top-up, impulse/snack, occasion, meal-prep, gifting, emergency — shown as a changeable chip.
- **Basket line**: name, image (if MCP gives), qty, unit price, line total, availability, delivery promise (if given), reason, confidence/uncertainty label, substitutes. **Never invent price/stock/rating/brand/ETA/attributes** — show "Not available" or omit.
- **Budget modes**: stay under budget · maximise coverage · prefer quality/brand. Over budget → transparent reduction plan: 1 drop optional, 2 trim excess qty, 3 cheaper alternatives, 4 ask before touching must-haves.
- **Substitutions**: same category, similar pack/price, same dietary, brand pref, better availability. Explain in plain language; never silently replace a user-selected item.
- **Editing**: +/− qty, remove, swap, mark must-have/optional, add note. Quick actions: "Under ₹1,000", "Add healthier options", "Use fewer brands", "Replace unavailable items", "Show only essentials".
- **Explainability**: short reasons ("Added because it covers breakfast for six people."). No chain-of-thought.
- **Saved baskets**: name, mission, items+qty, prefs, budget, last edited (e.g. Weekly essentials, Friday snacks, Breakfast basket, Pet restock, House party).

## 7. MCP integration & tool policy
Endpoint `https://mcp.swiggy.com/im`. Setup: `claude mcp add --transport http swiggy-instamart https://mcp.swiggy.com/im` then OAuth in browser.
Never assume tool names — use exact names/args from `docs/swiggy/DIGEST.md` (verified from docs) and confirm with tools/list on first connection.
**Allowed**: search, category discovery, product details, availability/serviceability, cart *read*.
**Blocked**: checkout, payment, order placement, address changes, any irreversible/consequential write. If preview vs write isn't distinguishable, don't call the write tool — build a local cart.

## 8. Architecture
Mobile web UI → local app server/agent endpoint → (LLM reasoning layer, Instamart MCP client) → Instamart MCP server.
Stack: Next.js + React 19 + TypeScript, Tailwind v4 + **HeroUI v3** (react-aria based), Zod, **server-side MCP calls only**, local JSON/localStorage for saved baskets, Vercel AI SDK `generateObject` with a swappable provider (default: free Gemini Flash-Lite; alt: Groq; fallback: rule parser). Browser never receives MCP OAuth tokens.
Cooking missions: recipe base in `src/lib/recipes/` (curated `data.ts` + optional gitignored TheMealDB import) → menu → ingredient intents (strict name matching). Visual identity: orange (`--brand` #fc8019 decorative, `--accent` #c74a0b for text/buttons, AA-safe).

## 9. Data model (UI is independent of MCP response shape)
```ts
type Product = { id: string; name: string; brand?: string; category?: string; imageUrl?: string;
  price?: number; mrp?: number; quantityLabel?: string;
  availability: "available" | "low_stock" | "unavailable" | "unknown";
  deliveryPromiseMinutes?: number; rating?: number; tags?: string[]; source: "instamart-mcp" | "mock" };
type BasketItem = { product: Product; quantity: number; priority: "must_have" | "recommended" | "optional";
  reason: string; alternatives: Product[]; userApproved: boolean };
type BasketPlan = { mission: string; constraints: { budget?: number; people?: number;
  dietaryPreferences?: string[]; avoid?: string[]; urgency?: string };
  items: BasketItem[]; estimatedTotal?: number; warnings: string[] };
```

## 10. Agent procedure (implement exactly)
1 parse → constraints · 2 find missing info that materially changes basket · 3 ≤2 questions · 4 small set of search intents · 5 call MCP search with exposed schema · 6 fetch details only for shortlisted · 7 normalise · 8 filter constraint violations · 9 rank deterministically: dietary/avoid must pass → prefer available → sensible pack size for people → within budget → brand pref → fewer duplicates · 10 explanations from returned data only · 11 local editable plan · 12 ask approval before any cart write · 13 show warnings/uncertainty.
LLM may interpret intent & phrase explanations; must not invent catalogue facts or make hidden basket-changing decisions.

## 11. UX
Fast, calm, trustworthy. Screens: mission input, parsed-constraints review, basket plan, item detail/substitution sheet, budget breakdown, cart preview, saved baskets, error/unavailable.
States: loading, empty, no results, partial results, unavailable item, over-budget, MCP timeout, auth required, rate limit, tool error, user cancelled.
Principles: goal always visible; show what the assistant did & why; editing easier than accepting; never hide price/qty changes; structured cards not chat bubbles; progressive disclosure; mobile-first; reusable components + consistent tokens; keyboard a11y + readable contrast.

## 12. Safety / privacy
Never commit tokens/cookies/OAuth codes/private MCP config; secrets in env or `.swiggy/` (gitignored). No credentials to browser. Don't log addresses/phones/tokens/raw PII; redact logs. Don't store raw MCP responses (except redacted fixtures). No real orders in dev/demo/tests. Checkout & payment disabled. Mock fixtures for deterministic tests. Label as independent prototype. Respect rate limits & partner terms.

## 13. Error handling
Every tool call: timeout, retry for safe read-only calls only, user-readable copy, fallback path, continue with partial results.
Copy: "Some product details are unavailable. You can continue with the items we found." · "Instamart search timed out. Try fewer constraints or search again." · "I could not verify availability, so I have not marked this item as confirmed." · "Your basket is a draft. No order has been placed."
Never retry checkout, payment or unknown writes.

## 14. Evaluation
20–30 synthetic requests: simple item, party, strict budget, veg/dietary, brand pref, unavailable item, vague multi-constraint, conflicting reqs, zero-result, MCP timeout/malformed.
Measure: constraint-extraction accuracy, search relevance, basket usefulness, budget compliance, substitution quality, unavailable transparency, # clarification questions, time to first usable basket, MCP latency/error rate, % items needing manual correction.

## 15. Acceptance criteria (interview-ready when)
NL mission entry · constraints extracted & displayed · search via live MCP **or** deterministic mock mode · useful editable basket · every rec has concise reason · budget overrun handled transparently · substitutions explicit & user-controlled · unavailable/uncertain clearly labelled · MCP creds server-side · no checkout/order possible · mock tests cover normal/failure/edge · explainable in <5 min.

## 16. Interview story
Problem (shop by mission, not SKU) → Insight (q-commerce speed wasted if planning is manual) → Idea (explainable, availability-aware planner) → Design decision (conversational input + structured editing) → Tech decision (MCP for live discovery, local logic for ranking & safety) → Trade-off (no auto checkout: trust & reversibility) → Demo (mission → constraints → basket → substitution → cart preview) → Evaluation (completion, correction rate, relevance, latency, trust) → Next (personalised repeat baskets, feedback-driven recs).

## 17. Working rules for Claude Code
Inspect before creating · small testable changes · never invent MCP tool names/fields · MCP behind a typed service layer · UI independent of raw MCP · mock fixtures for tests/screenshots · never enable checkout/payment · run lint, typecheck, tests after meaningful changes · report changed files + results · don't rewrite unrelated code.

### Token economy (applies to every session)
- Read this file + `docs/swiggy/DIGEST.md` only. Never re-read `Project brief/` photos or re-fetch docs that are cached in `docs/swiggy/`.
- No subagents unless asked. Targeted `Edit`s over full rewrites. Read only the file ranges you need.
- Verify with `npm run check` (lint+typecheck+test) once per phase, not after every edit.
- Browser verification: prefer `read_page`/`get_page_text`; screenshots only for final visual checks.
- Runtime: the LLM never sees raw catalogue payloads — one small JSON parse call per mission; everything else is deterministic code.
