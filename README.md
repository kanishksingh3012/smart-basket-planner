# Smart Basket Planner

> **Independent prototype**, not an official Swiggy or Instamart product. It reads the catalogue through Swiggy's Instamart MCP server (or recorded sample data) and **never places orders, writes to your cart, or takes payment**.

Type a shopping *mission* — "hosting six people tonight, veg snacks and breakfast under ₹1,200, trusted brands, ASAP" — and get an **editable, availability-aware basket**. Every item says why it's there, what it costs, and whether it's in stock.

## The case in 60 seconds

| | |
|---|---|
| **Problem** | People shop by mission, not by SKU. Quick commerce delivers in 10 minutes, but *planning* the basket is still manual: search, compare, and add, over and over. |
| **Insight** | Delivery is already fast, so the slowest step is the planning before it. The shopper already knows the occasion, headcount, budget and diet; the app should turn that into a basket. |
| **Idea** | An explainable basket planner: mission → constraints → basket → substitutions → cart preview. |
| **Key design decision** | Conversational *input*, structured *editing*. No chat bubbles: the result is cards with reasons, stock chips, quantity steppers and a bottom-sheet for swaps. Editing is easier than accepting. |
| **Technical decision** | MCP for live discovery; **local, deterministic logic** for ranking, budget and safety. The LLM never sees catalogue data, so it can't invent prices or stock. |
| **Trade-off** | No automatic checkout. Trust and reversibility matter more than one fewer tap. "Send to Instamart cart" is shown, disabled, and explained. |
| **Evaluation** | 22 synthetic missions → [docs/eval-report.md](docs/eval-report.md): 100% constraint extraction, 100% budget compliance, 100% unavailable-item transparency, 0.8 clarifying questions per mission. |
| **Next** | Personalised repeat baskets (`your_go_to_items`), feedback-driven ranking, and a confirmed, reversible cart hand-off. |

## Demo script (≈90 s)
1. Tap the first example mission → **Plan my basket** (instant: no LLM call needed for a clear request).
2. **Review** screen: point out the mission chip, 6 people, ₹1,200, Vegetarian, and that everything is editable.
3. **Build my basket** → sticky goal header + budget bar. It's **₹157 over**, and the app shows a numbered reduction plan (optional items first, must-haves untouched). **Apply**.
4. Milk line: *"Trusted Select Full Cream Milk is out of stock, so this is the closest in-stock match."* Tap **Edit** → substitutes with plain comparisons (*₹38 cheaper · Everyday Basics*).
5. **Undo**, **Use fewer brands**, **Only essentials**: all instant and local.
6. **Review basket** → "Your basket is a draft. No order has been placed." Save it as *House party*.

## How it works

```
Phone UI (Next.js + HeroUI v3)            ← never receives Swiggy tokens
   │ POST /api/parse   { text }
   │ POST /api/plan    { mission, constraints, budgetMode }
   ▼
Server
 1 parse      rules first (0 tokens) → LLM only if ambiguous (Gemini Flash-Lite / Groq, 4 s cap, Zod-validated,
              numbers must appear in the user's text)
 2 clarify    ≤ 2 questions, only if headcount/budget would change the basket
 3 intents    mission playbooks → ≤ 8 searches (no LLM)
 4 catalogue  Instamart MCP: get_addresses (once, cached) → search_products × intents, concurrency 2,
              1 persistent session, read-only allowlist  ─ or ─  recorded / sample fixtures
 5 normalise  MCP variations → internal Product (missing fields stay missing → "Not available")
 6 rank       veg/avoid must pass → in stock → pack size for headcount → budget → brand/rating
 7 explain    templated reasons from returned data only
   ▼
Basket JSON → every edit, swap, undo, quick action and budget plan runs in the browser (pure functions).
```

**Safety:** mutating MCP tools (`update_cart`, `checkout`, `confirm_order`, address tools…) are refused by an allowlist *before* any network call (unit-tested). Credentials live in `.swiggy/` (gitignored, 0600). Only product lists are ever recorded, never addresses or phone numbers.

**Token economy:** a clear mission costs **0 LLM tokens**; an ambiguous one costs about 600. Edits cost 0. Swiggy calls per mission: 1 address lookup (cached) + ≤ 8 searches.

## Run it

```bash
npm install
cp .env.example .env.local        # optional: add GOOGLE_GENERATIVE_AI_API_KEY or GROQ_API_KEY
npm run dev                       # sample-data mode, works offline
npm run check                     # lint + typecheck + tests
npm run eval                      # regenerates docs/eval-report.md
```

**Live Instamart:** stop the dev server (the login uses port 3000), run `npm run swiggy:login` and sign in with phone + OTP, set `CATALOG_MODE=live` in `.env.local`, then `npm run dev`. Run `npm run record` to save real search results as fixtures, so the mock mode demos real catalogue data.

## Screens & states
Mission input · constraints review (with ≤ 2 quick questions) · basket plan · item/substitution sheet · budget breakdown & reduction plan · cart preview · saved baskets.
States: loading skeleton + cancel, empty, no results, partial results, unavailable, over budget, timeout, auth required, rate limit, tool error, offline, cancelled.

## Make it your own (fork guide)
This is open source under the MIT licence, so fork it and adapt it. The code is built so the common changes stay small:

| Want to… | Change |
|---|---|
| Plan different missions (e.g. pharmacy, stationery, festival shopping) | Add a category + searches in `src/lib/planner/intents.ts` (`PLAYBOOK`), and keywords in `src/lib/planner/parse.ts` |
| Tune how products are picked | Weights in `src/lib/planner/rank.ts` (`score`) |
| Change the budget-reduction rules | `budgetPlan` in `src/lib/planner/basket.ts` |
| Use another catalogue / store API | Implement the `CatalogSource` interface (`src/lib/catalog/source.ts`) and map results to `Product` like `normalise.ts` does |
| Re-skin it | Tokens in `src/app/globals.css` (`--accent`, `--app-bg`…); components are HeroUI v3 |
| Use a different LLM | `LLM_PROVIDER` + `getModel()` in `parse.ts` (any Vercel AI SDK provider works) |

If you build with Claude Code or another coding agent, `CLAUDE.md` holds the product brief and working rules, and `docs/swiggy/DIGEST.md` the verified Swiggy MCP facts. Raw doc caches are gitignored, so re-fetch them from [Swiggy Builders Club](https://mcp.swiggy.com/builders/llms.txt) if you need them.

Please keep the "independent prototype" disclaimer if you fork it, and follow Swiggy's MCP access terms and rate limits. Live access is granted by Swiggy, not by this repo.

## License
[MIT](LICENSE). Swiggy and Instamart are trademarks of their owners. This project is not affiliated with or endorsed by them. Sample-catalogue brands and prices are fictional.

## Project map
- `src/lib/catalog/`: MCP client (read-only allowlist, retries, error classes), OAuth store, normaliser, sample catalogue
- `src/lib/planner/`: parse, intents/playbooks, rank/explain, plan assembly, pure basket operations
- `src/components/`: HeroUI-based screens
- `scripts/`: Swiggy login, fixture recorder, evaluation
- `CLAUDE.md` / `PLAN.md` / `docs/swiggy/DIGEST.md`: brief, plan and verified Swiggy MCP facts
