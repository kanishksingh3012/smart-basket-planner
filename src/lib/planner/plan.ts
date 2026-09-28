import type { CatalogSource } from "@/lib/catalog/source";
import {
  MISSION_LABEL,
  type BasketItem,
  type BasketPlan,
  type BudgetMode,
  type CatalogErrorKind,
  type ClarifyQuestion,
  type Constraints,
  type Intent,
  type SearchOutcome,
  type Warning,
} from "@/lib/types";
import { totalOf } from "./basket";
import { buildIntents, quantityFor } from "./intents";
import { explain, pickForIntent } from "./rank";

/** ≤2 questions, only when the answer materially changes the basket (brief §10.2–3). */
export function clarifyQuestions(c: Constraints): ClarifyQuestion[] {
  const q: ClarifyQuestion[] = [];
  const sized = ["occasion", "snack", "meal_prep", "stock_up", "top_up"].includes(c.missionType);
  if (!c.people && sized)
    q.push({ id: "people", text: "How many people is this for?", options: [1, 2, 4, 6, 10].map((n) => ({ label: String(n), value: n })) });
  if (!c.budget && c.missionType !== "emergency")
    q.push({
      id: "budget",
      text: "Any budget in mind?",
      options: [500, 1000, 2000].map((n) => ({ label: `₹${n.toLocaleString("en-IN")}`, value: n })).concat({ label: "No limit", value: 0 }),
    });
  return q.slice(0, 2);
}

export class PlanError extends Error {
  constructor(public kind: CatalogErrorKind, message: string) {
    super(message);
  }
}

async function searchAll(source: CatalogSource, intents: Intent[]): Promise<SearchOutcome[]> {
  // Concurrency 2: fast enough for a demo, gentle on Swiggy's 70 req/min limit.
  const out: SearchOutcome[] = new Array(intents.length);
  let next = 0;
  const worker = async () => {
    while (next < intents.length) {
      const i = next++;
      out[i] = await source.search(intents[i].query, intents[i].slot);
    }
  };
  await Promise.all([worker(), worker()]);
  return out;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export async function buildPlan(args: {
  mission: string;
  constraints: Constraints;
  budgetMode: BudgetMode;
  source: CatalogSource;
  parser: "llm" | "rules";
}): Promise<BasketPlan> {
  const { mission, constraints: c, budgetMode, source, parser } = args;
  const intents = buildIntents(c);
  const results = await searchAll(source, intents);

  const failures = results.filter((r): r is Extract<SearchOutcome, { ok: false }> => !r.ok);
  if (failures.length === results.length && failures.length) throw new PlanError(failures[0].error, failures[0].message);

  const items: BasketItem[] = [];
  const warnings: Warning[] = [];
  const missing: string[] = [];
  let excluded = 0;
  let unverifiedDiet = 0;
  intents.forEach((intent, idx) => {
    const r = results[idx];
    if (!r.ok) return;
    const pick = pickForIntent(r.products, c, budgetMode);
    excluded += pick.excluded;
    if (!pick.chosen) return void missing.push(intent.slot);
    const quantity = quantityFor(intent, c.people);
    if ((c.dietary.includes("veg") || c.dietary.includes("vegan")) && pick.chosen.veg === undefined) unverifiedDiet++;
    items.push({
      product: pick.chosen,
      quantity,
      priority: intent.priority,
      reason: explain(intent, pick.chosen, quantity, c, pick),
      slot: intent.slot,
      alternatives: pick.alternatives,
      userApproved: false,
    });
  });

  if (failures.length)
    warnings.push({ kind: "partial", text: `Some product details are unavailable (${failures.length} of ${results.length} searches failed). You can continue with the items we found.` });
  if (missing.length) warnings.push({ kind: "no_results", text: `Nothing suitable found for: ${missing.join(", ")}.` });
  const unavailable = items.filter((i) => i.product.availability === "unavailable");
  if (unavailable.length) warnings.push({ kind: "unavailable", text: `${unavailable.length} item(s) are out of stock — tap to pick a substitute.` });
  if (unverifiedDiet) warnings.push({ kind: "uncertain", text: `${unverifiedDiet} item(s) have no veg label from Instamart — please check before ordering.` });
  const total = totalOf(items);
  if (c.budget && total > c.budget) warnings.push({ kind: "budget", text: `Basket is ${inr(total - c.budget)} over your ${inr(c.budget)} budget.` });

  const who = [c.people && `${c.people} people`, c.budget && `under ${inr(c.budget)}`, c.dietary.length && c.dietary.join(", ")].filter(Boolean).join(" · ");
  const steps = [
    `Read your mission as ${MISSION_LABEL[c.missionType]}${who ? ` (${who})` : ""}${parser === "llm" ? "" : " using basic parsing"}.`,
    `Searched Instamart ${source.mode === "live" ? "live" : "(sample data)"} for ${intents.length} things: ${intents.map((i) => i.query).join(", ")}.`,
    excluded ? `Filtered out ${excluded} product(s) that didn't match your dietary or avoid list.` : "",
    "Ranked by: fits your constraints → in stock → sensible pack size → budget → brand preference.",
  ].filter(Boolean);

  return { mission, constraints: c, budgetMode, items, estimatedTotal: total, warnings, steps, catalogMode: source.mode, parser };
}
