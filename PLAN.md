# Build plan — Instamart Smart Basket Planner (4 h + testing)

## Status (2026-09-29)
Phases 1–5 done, Phase 6 README/demo script done. `npm run check` green (14 tests), eval 100% extraction.
Changes vs plan: LLM is called only when the rule parser isn't confident (Gemini free tier measured 14–40 s → rules-first keeps demos instant).
Remaining (user): `npm run swiggy:login` → `CATALOG_MODE=live` → `npm run record`; record 60–90 s demo video.

## How it works (runtime)
```
Phone browser (Next.js UI, HeroUI cards)
   │  POST /api/plan  { text, controls }          ← no tokens/credentials ever reach here
   ▼
Next.js server route  ─────────────────────────────────────────────────────────┐
 1. parseMission()   Gemini Flash-Lite (free tier), ONE call, Zod schema     │
                     fallback: rule parser (works with no API key)             │
 2. clarify()        deterministic: ≤2 questions (only if budget/people missing │
                     and they change the basket)                               │
 3. intents()        mission playbook → 3–6 search queries (no LLM)            │
 4. CatalogSource    ┌ McpSource  → Swiggy MCP /im: get_addresses (cached),    │
                     │              search_products × intents (concurrency 2)  │
                     └ MockSource → recorded fixtures (deterministic demo/tests)│
 5. normalise()      SearchProduct.variations → Product (never invents fields) │
 6. rank + budget    deterministic rules → Must-have / Recommended / Optional  │
 7. explain()        templated reasons from returned data only                 │
   ▼                                                                           │
BasketPlan JSON → UI. All edits (qty, swap, remove, quick actions) run locally ┘
in the browser with the same pure ranking/budget functions → zero extra LLM/MCP calls.
Cart preview = local draft. "Send to Instamart cart" is visibly disabled (prototype).
```

## Token-minimal workflows
**Runtime (per mission):** 1 LLM call (free Gemini Flash-Lite, ~600 tokens total; provider = 1 env var) · LLM never sees catalogue data (no hallucinated prices, tiny prompts) · parse cache keyed by normalised text · edits & quick actions = 0 LLM calls · MCP: 1 persistent session, addresses cached, ≤6 searches, top-N trimmed immediately.
**Build (Claude Code):** CLAUDE.md + DIGEST.md are the only context docs · no subagents · phase-level checks (`npm run check`) · `read_page` over screenshots · fixtures recorded by a script (`npm run record`) straight to disk, so MCP payloads never pass through the model's context.

## Phases & timebox
| # | Time | Deliverable |
|---|---|---|
| 1 Foundation | 0:00–0:25 | Next.js + TS + Tailwind v4 + HeroUI v3, Zod, Vitest, ESLint; `.env.example`; `.gitignore` covers `.env*`, `.swiggy/`; `claude mcp add` + tools/list sanity check |
| 2 Data layer | 0:25–1:05 | `lib/catalog/{types,mcp-source,mock-source,normalise}.ts`; `scripts/swiggy-login.ts` (SDK OAuth, DCR+PKCE, token → `.swiggy/`); `scripts/record-fixtures.ts`; tool allowlist guard (throws on any mutating tool); timeouts/retry/error classes |
| 3 Planner | 1:05–2:05 | `lib/planner/{parse,clarify,intents,rank,budget,substitute,explain}.ts`; mission playbooks (party, breakfast, stock-up, snack, emergency, pet/baby, gifting); unit tests + 20-case eval set |
| 4 UI | 2:05–3:20 | Screens: Mission input (+controls, example chips) → Constraints review (mission chip, ≤2 questions) → Basket plan (grouped cards) → Item/substitution bottom sheet → Budget breakdown → Cart preview → Saved baskets (localStorage + JSON) |
| 5 Quality | 3:20–3:50 | All states (loading, empty, no results, partial, unavailable, over-budget, timeout, auth required, rate limit, tool error, cancelled); a11y pass; 375 px check; eval report |
| 6 Portfolio | 3:50–4:00 + | README case study (problem → decisions → trade-offs → metrics), demo script (60–90 s), architecture diagram, "independent prototype" disclaimer + live/mock badge |

## Modes
- `CATALOG_MODE=mock` (default): recorded real fixtures — deterministic, demo-safe, offline.
- `CATALOG_MODE=live`: live Swiggy MCP with token from `npm run swiggy:login`.
- `LLM_PROVIDER=gemini|groq|none` + key optional: without it the rule-based parser is used (UI shows "basic parsing").

## Risks & fallbacks
- Direct app OAuth to Swiggy MCP may be refused (developer access is invite-based) → record fixtures through the Claude Code MCP connection instead; app runs in mock mode with real catalogue data; the demo says so honestly.
- Rate limits → single session, cached addresses, capped intents, 429 surfaces the "rate limit" state.
- Time overrun → cut order: saved baskets → budget modes 2 & 3 → go-to items. Never cut: states, explanations, disabled checkout.
