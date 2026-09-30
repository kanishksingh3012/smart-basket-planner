/**
 * Synthetic evaluation (brief §14): 22 missions → extraction accuracy, basket usefulness, budget compliance,
 * unavailable transparency, clarification count, latency. Runs on mock data; writes docs/eval-report.md.
 * Rules-only by default (0 tokens). Set EVAL_LLM=1 to also measure the LLM parser.
 */
import fs from "node:fs";
import { mockSource, type CatalogSource } from "../src/lib/catalog/source";
import { applyBudgetPlan, budgetPlan, totalOf } from "../src/lib/planner/basket";
import { parseMission, parseWithRules } from "../src/lib/planner/parse";
import { buildPlan, clarifyQuestions, PlanError } from "../src/lib/planner/plan";
import type { Constraints } from "../src/lib/types";

type Case = { tag: string; text: string; expect: Partial<Pick<Constraints, "missionType" | "people" | "budget">> & { veg?: boolean; avoid?: string }; source?: CatalogSource };

const flaky: CatalogSource = { mode: "mock", search: (q, s) => mockSource.search(q.includes("namkeen") ? "__timeout" : q, s) };
const down: CatalogSource = { mode: "mock", search: (_q, s) => mockSource.search("__error", s) };

const CASES: Case[] = [
  { tag: "party", text: "I'm hosting six people tonight. I need vegetarian snacks and breakfast items under ₹1,200, preferably from trusted brands, delivered as soon as possible.", expect: { missionType: "occasion", people: 6, budget: 1200, veg: true } },
  { tag: "simple", text: "Need bread and milk for breakfast", expect: { missionType: "top_up" } },
  { tag: "stock-up", text: "Weekly groceries for 2, budget ₹2,000, no rice", expect: { missionType: "stock_up", people: 2, budget: 2000, avoid: "rice" } },
  { tag: "strict budget", text: "Movie night snacks for 4 under ₹300", expect: { missionType: "snack", people: 4, budget: 300 } },
  { tag: "healthy", text: "Healthy snacks for the office, 4 people, under ₹800", expect: { people: 4, budget: 800 } },
  { tag: "dietary", text: "Vegan breakfast for 3 people", expect: { people: 3 } },
  { tag: "brand", text: "Breakfast for 2, prefer Daily Dairy brand", expect: { people: 2 } },
  { tag: "emergency", text: "Power cut emergency — need supplies now", expect: { missionType: "emergency" } },
  { tag: "gifting", text: "Birthday gift hamper under ₹1,000", expect: { missionType: "gifting", budget: 1000 } },
  { tag: "pet", text: "Pet restock for my dog", expect: {} },
  { tag: "baby", text: "Running out of diapers and baby wipes", expect: { missionType: "top_up" } },
  { tag: "party-large", text: "Party for 10 people with snacks and drinks under ₹1,500", expect: { missionType: "occasion", people: 10, budget: 1500 } },
  { tag: "meal prep", text: "Cooking paneer butter masala dinner for 4 tonight", expect: { missionType: "meal_prep", people: 4 } },
  { tag: "cuisine dinner (date)", text: "I want to prepare dinner for me and my girlfriend. I want to have Chinese, and the budget is 1000", expect: { missionType: "meal_prep", people: 2, budget: 1000 } },
  { tag: "named dishes", text: "Make rajma chawal and roti for a family of four", expect: { missionType: "meal_prep", people: 4 } },
  { tag: "breakfast recipe", text: "Masala dosa breakfast for 3", expect: { missionType: "meal_prep", people: 3 } },
  { tag: "italian veg", text: "Veg pasta night for 5 under ₹900", expect: { people: 5, budget: 900, veg: true } },
  { tag: "vague", text: "Friends coming over later, something to munch", expect: { missionType: "occasion" } },
  { tag: "multi-constraint", text: "Veg snacks and drinks for 8 guests under ₹900, no chips", expect: { missionType: "occasion", people: 8, budget: 900, veg: true, avoid: "chips" } },
  { tag: "conflicting", text: "Party for 20 people under ₹200", expect: { people: 20, budget: 200 } },
  { tag: "zero-result", text: "Must have unicorn cheese for breakfast", expect: {} },
  { tag: "monthly", text: "Monthly ration stock up for a family of four", expect: { missionType: "stock_up", people: 4 } },
  { tag: "cleaning", text: "Household cleaning supplies restock", expect: { missionType: "stock_up" } },
  { tag: "unavailable", text: "Snacks for 4 people from trusted brands", expect: { people: 4 } },
  { tag: "timeout (partial)", text: "Veg snacks for 6 people under ₹700", expect: { people: 6, budget: 700, veg: true }, source: flaky },
  { tag: "tool error (all)", text: "Breakfast for 2", expect: { people: 2 }, source: down },
];

async function main() {
  const useLlm = process.env.EVAL_LLM === "1";
  const rows: string[] = [];
  let fieldsOk = 0, fieldsTotal = 0, useful = 0, budgetCases = 0, budgetFit = 0, clarQs = 0, unavailTransparent = 0, unavailCases = 0, handledErrors = 0;
  const latencies: number[] = [];
  for (const k of CASES) {
    const t0 = performance.now();
    const c = useLlm ? (await parseMission(k.text)).c : parseWithRules(k.text);
    const checks: [string, boolean][] = [];
    if (k.expect.missionType) checks.push(["mission", c.missionType === k.expect.missionType]);
    if (k.expect.people) checks.push(["people", c.people === k.expect.people]);
    if (k.expect.budget) checks.push(["budget", c.budget === k.expect.budget]);
    if (k.expect.veg) checks.push(["veg", c.dietary.includes("veg") || c.dietary.includes("vegan")]);
    if (k.expect.avoid) checks.push(["avoid", c.avoid.some((a) => a.includes(k.expect.avoid!))]);
    fieldsOk += checks.filter(([, ok]) => ok).length;
    fieldsTotal += checks.length;
    const q = clarifyQuestions(c).length;
    clarQs += q;
    let outcome = "";
    try {
      const plan = await buildPlan({ mission: k.text, constraints: c, budgetMode: "under_budget", source: k.source ?? mockSource, parser: "rules" });
      latencies.push(performance.now() - t0);
      if (plan.items.length >= 2) useful++;
      if (c.budget) {
        budgetCases++;
        const fixed = applyBudgetPlan(plan, budgetPlan(plan).steps);
        const fits = totalOf(fixed.items) <= c.budget;
        const flagged = plan.warnings.some((w) => w.kind === "budget") || totalOf(plan.items) <= c.budget;
        if (fits || flagged) budgetFit++;
      }
      const unavailable = plan.items.filter((i) => i.product.availability === "unavailable").length;
      const substituted = plan.items.filter((i) => /out of stock/.test(i.reason)).length;
      if (unavailable || substituted) {
        unavailCases++;
        if (plan.warnings.some((w) => w.kind === "unavailable") || substituted) unavailTransparent++;
      }
      if (k.source) handledErrors += plan.warnings.some((w) => w.kind === "partial") ? 1 : 0;
      outcome = `${plan.menu.length ? `menu: ${plan.menu.map((m) => m.name).join(" + ")} · ` : ""}${plan.items.length} items · ₹${Math.round(plan.estimatedTotal)} · ${plan.warnings.map((w) => w.kind).join(", ") || "no warnings"}`;
    } catch (e) {
      if (e instanceof PlanError) {
        handledErrors++;
        outcome = `typed error: ${e.kind}`;
      } else outcome = `CRASH: ${(e as Error).message}`;
    }
    const failed = checks.filter(([, ok]) => !ok).map(([n]) => n);
    rows.push(`| ${k.tag} | ${checks.length ? `${checks.length - failed.length}/${checks.length}${failed.length ? ` (missed ${failed.join(", ")})` : ""}` : "—"} | ${q} | ${outcome} |`);
  }
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "n/a");
  const p50 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length / 2)] ?? 0;
  const report = `# Evaluation report

Generated by \`npm run eval\` on ${new Date().toISOString().slice(0, 10)} · parser: ${useLlm ? "LLM (+rules fallback)" : "rules only (0 LLM tokens)"} · catalogue: sample data (mock).

| Metric | Result |
|---|---|
| Constraint extraction accuracy | ${pct(fieldsOk, fieldsTotal)} (${fieldsOk}/${fieldsTotal} fields) |
| Useful basket (≥2 relevant items) | ${pct(useful, CASES.length - 1)} of cases with a reachable catalogue |
| Budget compliance (fits after reduction plan, or overrun flagged) | ${pct(budgetFit, budgetCases)} |
| Unavailable-item transparency | ${pct(unavailTransparent, unavailCases)} |
| Clarification questions per mission | ${(clarQs / CASES.length).toFixed(2)} avg (max 2) |
| Failure handling (partial results / typed error, no crash) | ${handledErrors}/2 |
| Time to first basket (p50, mock, excl. network) | ${Math.round(p50)} ms |

| Case | Fields correct | Qs | Outcome |
|---|---|---|---|
${rows.join("\n")}

Not measured offline (need real users/live MCP): search relevance, substitution quality, % items manually corrected, live MCP latency & error rate.
`;
  fs.writeFileSync("docs/eval-report.md", report);
  console.log(report);
}

main();
