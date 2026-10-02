import type { BudgetMode, Constraints, Intent, Product } from "@/lib/types";

/** Hard constraint check. Returns why a product is excluded, or null. */
export function violation(p: Product, c: Constraints): string | null {
  const vegOnly = c.dietary.includes("veg") || c.dietary.includes("vegan");
  if (vegOnly && p.veg === false) return "not vegetarian";
  const hay = `${p.name} ${p.brand ?? ""}`.toLowerCase();
  const hit = c.avoid.find((a) => a && hay.includes(a.toLowerCase()));
  return hit ? `contains "${hit}"` : null;
}

const stem = (w: string) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, "");
const tokens = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2).map(stem);

/** Share of the query's words found in the product name (0–1). "hakka noodles" vs "Atta Noodles" = 0.5. */
export function relevance(query: string, p: Product): number {
  const q = tokens(query);
  if (!q.length) return 1;
  const squash = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "");
  if (squash(p.name).includes(squash(query))) return 1; // "cornflour" ≈ "Corn Flour"
  const name = new Set(tokens(`${p.name} ${p.brand ?? ""}`));
  return q.filter((w) => name.has(w)).length / q.length;
}

const AVAIL_SCORE = { available: 100, low_stock: 70, unknown: 40, unavailable: 0 } as const;

/** Deterministic score — the brief's ranking rules, in order of weight. */
export function score(p: Product, c: Constraints, mode: BudgetMode, medianPrice: number, query = "", strict = false): number {
  let s = AVAIL_SCORE[p.availability];
  // Relevance: the right product beats a cheaper near-miss (a recipe needs *the* ingredient).
  if (query) s += relevance(query, p) * (strict ? 120 : 45);
  const vegOnly = c.dietary.includes("veg") || c.dietary.includes("vegan");
  if (vegOnly && p.veg === undefined) s -= 25; // unverified dietary fit
  if (c.brands.some((b) => p.brand?.toLowerCase().includes(b.toLowerCase()))) s += 35;
  const trustWeight = mode === "quality" || c.preferTrusted ? 40 : 10;
  s += ((p.rating ?? 3.8) - 3.8) * trustWeight;
  const priceWeight = mode === "under_budget" ? 35 : mode === "coverage" ? 25 : 5;
  if (p.price !== undefined && medianPrice > 0) s -= priceWeight * (p.price / medianPrice);
  else s -= 15; // unknown price is a risk
  return s;
}

export type Pick = { chosen?: Product; alternatives: Product[]; excluded: number; skippedPreferred?: Product };

export function pickForIntent(products: Product[], c: Constraints, mode: BudgetMode, query = "", strict = false): Pick {
  let eligible = products.filter((p) => !violation(p, c));
  const excluded = products.length - eligible.length;
  // Strict (recipe) intents: drop products sharing no words with the ingredient, if any match exists.
  if (strict && eligible.some((p) => relevance(query, p) > 0)) eligible = eligible.filter((p) => relevance(query, p) > 0);
  const prices = eligible.map((p) => p.price).filter((n): n is number => n !== undefined).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)] ?? 0;
  const sc = (p: Product) => score(p, c, mode, median, query, strict);
  const ranked = [...eligible].sort((a, b) => sc(b) - sc(a));
  const chosen = ranked.find((p) => p.availability !== "unavailable") ?? ranked[0];
  // Would the user's preferred/top-rated product have won if it were in stock? Then say so.
  const byPreference = [...eligible].sort((a, b) => sc({ ...b, availability: "available" }) - sc({ ...a, availability: "available" }))[0];
  const skippedPreferred = byPreference && byPreference.availability === "unavailable" && byPreference.id !== chosen?.id ? byPreference : undefined;
  return {
    chosen,
    alternatives: ranked.filter((p) => p.id !== chosen?.id).slice(0, 4),
    excluded,
    skippedPreferred,
  };
}

const PEOPLE_WORD = (n?: number) => (n ? `${n} ${n === 1 ? "person" : "people"}` : "your household");

/** Short, factual reason built only from returned product data + the user's constraints. */
export function explain(intent: Intent, p: Product, qty: number, c: Constraints, pick: Pick): string {
  const parts: string[] = [];
  const slot = intent.slot.toLowerCase();
  if (intent.forDishes?.length) {
    const dishes = intent.forDishes.join(" & ");
    parts.push(intent.pantry ? `Pantry staple for ${dishes}, so remove it if you already have some` : `For ${dishes}${c.people ? ` (serves ${c.people})` : ""}`);
  } else if (intent.priority === "must_have" && c.mustHaves.some((m) => m.toLowerCase() === intent.query.toLowerCase()))
    parts.push(`You asked for ${slot}`);
  else parts.push(`Covers ${slot} for ${PEOPLE_WORD(c.people)}${qty > 1 && p.quantityLabel ? ` (${qty} × ${p.quantityLabel})` : ""}`);
  if (pick.skippedPreferred) parts.push(`${[pick.skippedPreferred.brand, pick.skippedPreferred.name].filter(Boolean).join(" ")} is out of stock, so this is the closest in-stock match`);
  else if (c.brands.some((b) => p.brand?.toLowerCase().includes(b.toLowerCase()))) parts.push(`matches your ${p.brand} preference`);
  else if ((c.preferTrusted || false) && (p.rating ?? 0) >= 4.4) parts.push(`well rated (${p.rating}★)`);
  const cheaper = pick.alternatives.every((a) => a.price === undefined || p.price === undefined || p.price <= a.price);
  if (!pick.skippedPreferred && cheaper && pick.alternatives.length && p.price !== undefined) parts.push("lowest price among the options");
  if (intent.strict && relevance(intent.query, p) < 1) parts.push(`closest match we found for "${intent.query}", please check it`);
  if (p.availability === "low_stock") parts.push("few left");
  return parts.join(" · ") + ".";
}
