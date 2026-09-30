import type { Constraints, Intent, MissionType } from "@/lib/types";

/**
 * Mission playbooks: category → catalogue searches. Deterministic, so turning a mission into
 * searches costs zero LLM tokens. `perPerson` sizes quantity (units per person; 0 = one unit).
 */
export const PLAYBOOK: Record<string, Intent[]> = {
  snacks: [
    { slot: "Chips", query: "potato chips", priority: "must_have", perPerson: 0.5 },
    { slot: "Namkeen", query: "namkeen", priority: "recommended", perPerson: 0.34 },
    { slot: "Biscuits", query: "cookies", priority: "optional", perPerson: 0.25 },
  ],
  beverages: [
    { slot: "Soft drinks", query: "soft drink", priority: "recommended", perPerson: 0.25 },
    { slot: "Juice", query: "fruit juice", priority: "optional", perPerson: 0.2 },
  ],
  breakfast: [
    { slot: "Bread", query: "bread", priority: "must_have", perPerson: 0.25 },
    { slot: "Butter", query: "butter", priority: "must_have", perPerson: 0 },
    { slot: "Milk", query: "milk", priority: "must_have", perPerson: 0.34 },
    { slot: "Eggs", query: "eggs", priority: "recommended", perPerson: 0.17 },
    { slot: "Cereal", query: "cornflakes", priority: "recommended", perPerson: 0.17 },
    { slot: "Jam", query: "jam", priority: "optional", perPerson: 0 },
  ],
  healthy_snacks: [
    { slot: "Makhana", query: "makhana", priority: "must_have", perPerson: 0.25 },
    { slot: "Trail mix", query: "trail mix", priority: "recommended", perPerson: 0.2 },
    { slot: "Greek yogurt", query: "greek yogurt", priority: "optional", perPerson: 0.5 },
  ],
  party_supplies: [
    { slot: "Paper cups", query: "paper cups", priority: "optional", perPerson: 0 },
    { slot: "Paper plates", query: "paper plates", priority: "optional", perPerson: 0 },
  ],
  staples: [
    { slot: "Atta", query: "atta", priority: "must_have", perPerson: 0 },
    { slot: "Rice", query: "rice", priority: "must_have", perPerson: 0 },
    { slot: "Dal", query: "toor dal", priority: "must_have", perPerson: 0 },
    { slot: "Cooking oil", query: "sunflower oil", priority: "recommended", perPerson: 0 },
    { slot: "Tea", query: "tea", priority: "optional", perPerson: 0 },
  ],
  fruits_veg: [
    { slot: "Onions", query: "onion", priority: "must_have", perPerson: 0 },
    { slot: "Tomatoes", query: "tomato", priority: "must_have", perPerson: 0 },
    { slot: "Bananas", query: "banana", priority: "recommended", perPerson: 0.17 },
  ],
  cleaning: [
    { slot: "Dishwash", query: "dishwash liquid", priority: "recommended", perPerson: 0 },
    { slot: "Detergent", query: "detergent", priority: "recommended", perPerson: 0 },
  ],
  pet: [
    { slot: "Dog food", query: "dog food", priority: "must_have", perPerson: 0 },
    { slot: "Pet treats", query: "dog treats", priority: "optional", perPerson: 0 },
  ],
  baby: [
    { slot: "Diapers", query: "diapers", priority: "must_have", perPerson: 0 },
    { slot: "Baby wipes", query: "baby wipes", priority: "must_have", perPerson: 0 },
  ],
  gifting: [
    { slot: "Chocolates", query: "chocolate gift box", priority: "must_have", perPerson: 0 },
    { slot: "Dry fruits", query: "dry fruits gift", priority: "recommended", perPerson: 0 },
  ],
  emergency: [
    { slot: "Batteries", query: "batteries", priority: "must_have", perPerson: 0 },
    { slot: "Candles", query: "candles", priority: "recommended", perPerson: 0 },
    { slot: "Instant noodles", query: "instant noodles", priority: "optional", perPerson: 0.5 },
  ],
};

export const CATEGORY_KEYS = Object.keys(PLAYBOOK);

export const MISSION_DEFAULT_CATEGORIES: Record<MissionType, string[]> = {
  stock_up: ["staples", "fruits_veg", "cleaning"],
  top_up: ["breakfast"],
  snack: ["snacks", "beverages"],
  occasion: ["snacks", "beverages", "party_supplies"],
  meal_prep: [], // cooking missions are driven by the recipe menu (src/lib/recipes)
  gifting: ["gifting"],
  emergency: ["emergency"],
};

export const MAX_INTENTS = 12;

/** Turns constraints into a small, capped set of searches (Swiggy rate-limit friendly). */
export function buildIntents(c: Constraints, max = MAX_INTENTS): Intent[] {
  const cats = (c.categories.length ? c.categories : MISSION_DEFAULT_CATEGORIES[c.missionType]).filter((k) => PLAYBOOK[k]);
  const out: Intent[] = c.mustHaves.map((m) => ({ slot: cap(m), query: m, priority: "must_have" as const, perPerson: 0, strict: true }));
  const vegOnly = c.dietary.includes("veg") || c.dietary.includes("vegan");
  const avoid = c.avoid.map((a) => a.toLowerCase());
  // Round-robin across categories so a capped list still covers every category.
  const lists = cats.map((k) => PLAYBOOK[k].filter((i) => !(vegOnly && i.query === "eggs") && !avoid.some((a) => i.query.includes(a))));
  for (let r = 0; out.length < max && lists.some((l) => l[r]); r++) {
    for (const l of lists) if (l[r] && out.length < max && !out.some((o) => o.query === l[r].query)) out.push(l[r]);
  }
  return out;
}

export function quantityFor(intent: Intent, people = 2): number {
  if (intent.qty) return intent.qty;
  if (!intent.perPerson) return 1;
  return Math.min(6, Math.max(1, Math.ceil(people * intent.perPerson)));
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
