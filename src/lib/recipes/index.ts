import fs from "node:fs";
import path from "node:path";
import type { Constraints, Intent } from "@/lib/types";
import { CURATED, INGREDIENTS, type Ingredient, type Recipe } from "./data";

/** Optional import from TheMealDB (`npm run recipes:import`, gitignored). Curated recipes always win. */
type MealDbRow = { name: string; area: string; category: string; ingredients: string[] };
const PANTRY_WORDS = /^(salt|pepper|black pepper|water|oil|vegetable oil|olive oil|sugar|butter|flour|plain flour|garlic|onion)$/;
const NON_VEG = /chicken|beef|pork|lamb|mutton|fish|prawn|shrimp|bacon|ham|sausage|turkey|duck|anchov|salmon|tuna|egg/;

const dynamicIngredients = new Map<string, Ingredient>();
export const ingredient = (key: string): Ingredient | undefined => INGREDIENTS[key] ?? dynamicIngredients.get(key);

let cache: Recipe[] | null = null;
export function allRecipes(): Recipe[] {
  if (cache) return cache;
  let imported: Recipe[] = [];
  try {
    if (process.env.VITEST || process.env.CURATED_ONLY) throw new Error("curated only"); // deterministic tests/eval
    const rows = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "lib", "recipes", "mealdb.json"), "utf8")) as MealDbRow[];
    const known = new Set(CURATED.flatMap((r) => [r.name.toLowerCase(), ...r.aliases]));
    imported = rows
      .filter((r) => !known.has(r.name.toLowerCase()))
      .map((r) => {
        const items = r.ingredients.map((raw) => {
          const name = raw.toLowerCase().trim();
          const hit = Object.values(INGREDIENTS).find((i) => i.query === name || i.label.toLowerCase() === name);
          if (hit) return { key: hit.key, per2: 1 };
          const key = `mdb:${name}`;
          if (!dynamicIngredients.has(key))
            dynamicIngredients.set(key, { key, label: raw.trim(), query: name, pantry: PANTRY_WORDS.test(name), veg: !NON_VEG.test(name) });
          return { key, per2: 1 };
        });
        return {
          id: `mdb-${r.name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
          name: r.name,
          cuisine: r.area.toLowerCase(),
          course: r.category === "Dessert" ? ("snack" as const) : r.category === "Breakfast" ? ("breakfast" as const) : ("main" as const),
          veg: r.category === "Vegetarian" || r.category === "Vegan" || !r.ingredients.some((i) => NON_VEG.test(i.toLowerCase())),
          aliases: [r.name.toLowerCase()],
          items,
          source: "themealdb" as const,
        };
      });
  } catch {
    /* no import present — curated only */
  }
  cache = [...CURATED, ...imported];
  return cache;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MEAL_CUE = /\b(dinner|lunch|breakfast|brunch|cook|cooking|make|making|prepare|preparing|recipe|meal)\b/;

/** Dish names mentioned in the text. Single-word aliases ("rice", "pasta") only count in a cooking context. */
export function findDishes(text: string): string[] {
  let t = ` ${text.toLowerCase()} `;
  const cooking = MEAL_CUE.test(t);
  const pairs = allRecipes()
    .flatMap((r) => r.aliases.map((a) => ({ a, r })))
    .sort((x, y) => y.a.length - x.a.length);
  const found: string[] = [];
  for (const { a, r } of pairs) {
    if (!cooking && !a.includes(" ")) continue;
    const re = new RegExp(`(^|[^a-z])(no |without |not )?${esc(a)}([^a-z]|$)`);
    const m = t.match(re);
    if (!m) continue;
    t = t.replace(re, " ");
    if (!m[2] && !found.includes(r.name)) found.push(r.name);
  }
  return found;
}

export function resolveDish(name: string): Recipe | undefined {
  const n = name.toLowerCase().trim();
  const all = allRecipes();
  return all.find((r) => r.name.toLowerCase() === n) ?? all.find((r) => r.aliases.includes(n)) ?? all.find((r) => r.name.toLowerCase().includes(n));
}

const violates = (r: Recipe, c: Constraints) => {
  const vegOnly = c.dietary.includes("veg") || c.dietary.includes("vegan");
  if (vegOnly && !r.veg) return true;
  const hay = [r.name, ...r.items.map((i) => ingredient(i.key)?.label ?? "")].join(" ").toLowerCase();
  return c.avoid.some((a) => a && hay.includes(a.toLowerCase()));
};

/**
 * The menu: dishes the user named, otherwise a sensible pick for the cuisine
 * (a main, plus a side for 3+ people or a Chinese/Indian dinner). Veg-first when diet is unknown.
 */
export function pickMenu(c: Constraints): { menu: Recipe[]; unknown: string[]; note?: string } {
  const unknown: string[] = [];
  const named = c.dishes.flatMap((d) => {
    const r = resolveDish(d);
    if (!r) unknown.push(d);
    return r ? [r] : [];
  });
  if (named.length || c.dishes.length) return { menu: named, unknown };
  if (c.missionType !== "meal_prep" && !c.cuisine) return { menu: [], unknown };
  const wanted = c.cuisine ?? "indian";
  const has = (k: string) => allRecipes().some((r) => r.cuisine === k && !violates(r, c));
  const cuisine = has(wanted) ? wanted : "indian";
  const note = cuisine !== wanted ? `We don't have ${wanted.replace(/^\w/, (ch) => ch.toUpperCase())} recipes that fit yet, so we planned an Indian meal instead. You can change the dishes in Edit.` : undefined;
  const breakfast = c.categories.includes("breakfast") && !/dinner|lunch/.test(c.categories.join(" "));
  const pool = allRecipes()
    .filter((r) => r.cuisine === cuisine && !violates(r, c))
    .sort((a, b) => Number(b.veg) - Number(a.veg) || Number(b.source === "curated") - Number(a.source === "curated"));
  if (breakfast) return { menu: pool.filter((r) => r.course === "breakfast").slice(0, 1), unknown, note };
  const main = pool.find((r) => r.course === "main") ?? pool[0];
  const side = pool.find((r) => r !== main && (r.course === "side" || r.course === "starter"));
  const wantSide = (c.people ?? 2) >= 3 || ["chinese", "indian"].includes(cuisine);
  return { menu: [main, wantSide ? side : undefined].filter((r): r is Recipe => Boolean(r)), unknown, note };
}

/** Main-ingredient packs scale with headcount; aromatics and sauces go further (one pack per ~6 people). */
const SCALES = new Set(["hakka_noodles", "basmati", "paneer", "chicken", "egg", "pasta", "dosa_batter", "poha", "rava", "atta", "chana", "rajma", "toor", "tortilla", "pizza_base", "pancake_mix", "milk", "potato", "curd", "coconut_milk", "cheese", "mushroom"]);

export function recipeIntents(menu: Recipe[], c: Constraints): Intent[] {
  const people = c.people ?? 2;
  const merged = new Map<string, { per2: number; dishes: string[] }>();
  for (const r of menu)
    for (const it of r.items) {
      const m = merged.get(it.key) ?? { per2: 0, dishes: [] };
      m.per2 = Math.max(m.per2, it.per2);
      m.dishes.push(r.name);
      merged.set(it.key, m);
    }
  const out: Intent[] = [];
  for (const [key, { per2, dishes }] of merged) {
    const ing = ingredient(key);
    if (!ing || (ing.pantry && !c.includePantry)) continue;
    const scales = SCALES.has(key) || key.startsWith("mdb:");
    const qty = Math.min(6, Math.max(1, Math.ceil(scales ? (per2 * people) / 2 : people / 6)));
    out.push({
      slot: ing.label,
      query: ing.query,
      priority: ing.pantry ? "optional" : scales ? "must_have" : "recommended",
      perPerson: 0,
      qty,
      forDishes: dishes,
      strict: true,
      pantry: ing.pantry,
    });
  }
  return out.sort((a, b) => ["must_have", "recommended", "optional"].indexOf(a.priority) - ["must_have", "recommended", "optional"].indexOf(b.priority));
}

/** Pantry staples the menu assumes you already have (shown to the user, not searched). */
export function assumedPantry(menu: Recipe[]): string[] {
  return [...new Set(menu.flatMap((r) => r.items.map((i) => ingredient(i.key)).filter((i) => i?.pantry).map((i) => i!.label)))];
}
