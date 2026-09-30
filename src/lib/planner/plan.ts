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
import { assumedPantry, pickMenu, recipeIntents } from "@/lib/recipes";
import { CUISINES } from "@/lib/recipes/data";
import { buildIntents, MAX_INTENTS, quantityFor } from "./intents";
import { explain, pickForIntent } from "./rank";

/** ≤2 questions, only when the answer materially changes the basket (brief §10.2–3). */
export function clarifyQuestions(c: Constraints): ClarifyQuestion[] {
  const q: ClarifyQuestion[] = [];
  const sized = ["occasion", "snack", "meal_prep", "stock_up", "top_up"].includes(c.missionType);
  if (!c.people && sized)
    q.push({ id: "people", text: "How many people is this for?", options: [1, 2, 4, 6, 10].map((n) => ({ label: String(n), value: n })) });
  if (c.missionType === "meal_prep" && !c.cuisine && !c.dishes.length)
    q.push({
      id: "cuisine",
      text: "What would you like to cook?",
      options: CUISINES.map((k) => ({ label: k.replace(/\b\w/g, (m) => m.toUpperCase()), value: k })),
    });
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
  const { menu, unknown, note } = pickMenu(c);
  const fromRecipes = recipeIntents(menu, c);
  // Unknown dishes are still searched by name (e.g. a ready kit) so the user gets something honest.
  const unknownIntents: Intent[] = unknown.map((d) => ({ slot: d, query: d, priority: "must_have", perPerson: 0 }));
  // With a menu, meal words ("breakfast") describe the menu, not a second generic basket.
  const extraCats = menu.length ? c.categories.filter((k) => k !== "breakfast") : c.categories;
  const rest = buildIntents({ ...c, categories: menu.length && !extraCats.length ? ["none"] : extraCats }, Math.max(0, MAX_INTENTS - fromRecipes.length - unknownIntents.length));
  const intents = [...fromRecipes, ...unknownIntents, ...rest.filter((i) => !fromRecipes.some((r) => r.query === i.query))].slice(0, MAX_INTENTS);
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
    const pick = pickForIntent(r.products, c, budgetMode, intent.query, intent.strict);
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

  if (note) warnings.push({ kind: "conflict", text: note });
  if (unknown.length)
    warnings.push({ kind: "no_results", text: `I don't have a recipe for ${unknown.join(", ")} yet, so I searched Instamart for it by name.` });
  if (failures.length)
    warnings.push({ kind: "partial", text: `Some product details are unavailable (${failures.length} of ${results.length} searches failed). You can continue with the items we found.` });
  if (missing.length) warnings.push({ kind: "no_results", text: `Nothing suitable found for: ${missing.join(", ")}.` });
  const unavailable = items.filter((i) => i.product.availability === "unavailable");
  if (unavailable.length) warnings.push({ kind: "unavailable", text: `${unavailable.length} item(s) are out of stock — tap to pick a substitute.` });
  if (unverifiedDiet) warnings.push({ kind: "uncertain", text: `${unverifiedDiet} item(s) have no veg label from Instamart — please check before ordering.` });
  const total = totalOf(items);
  if (c.budget && total > c.budget) warnings.push({ kind: "budget", text: `Basket is ${inr(total - c.budget)} over your ${inr(c.budget)} budget.` });

  const who = [c.people && `${c.people} people`, c.budget && `under ${inr(c.budget)}`, c.dietary.length && c.dietary.join(", ")].filter(Boolean).join(" · ");
  const pantry = assumedPantry(menu).filter(() => !c.includePantry);
  const steps = [
    `Read your mission as ${MISSION_LABEL[c.missionType]}${who ? ` (${who})` : ""}${parser === "llm" ? "" : " using basic parsing"}.`,
    menu.length ? `Planned the menu: ${menu.map((m) => m.name).join(" + ")} (${menu.map((m) => (m.source === "curated" ? "curated recipe" : "TheMealDB")).filter((v, i, a) => a.indexOf(v) === i).join(", ")}).` : "",
    pantry.length ? `Assumed you already have: ${pantry.join(", ")}. Turn on pantry staples to add them.` : "",
    `Searched Instamart ${source.mode === "live" ? "live" : "(sample data)"} for ${intents.length} things: ${intents.map((i) => i.query).join(", ")}.`,
    excluded ? `Filtered out ${excluded} product(s) that didn't match your dietary or avoid list.` : "",
    "Ranked by: fits your constraints → closest name match → in stock → budget → brand preference.",
  ].filter(Boolean);

  return {
    mission,
    constraints: c,
    budgetMode,
    items,
    estimatedTotal: total,
    warnings,
    steps,
    catalogMode: source.mode,
    parser,
    menu: menu.map((m) => ({ name: m.name, cuisine: m.cuisine, source: m.source })),
    assumedPantry: pantry,
  };
}
