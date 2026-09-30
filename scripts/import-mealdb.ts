/**
 * Optional: import ~300 global recipes from TheMealDB's free API (test key "1": development/educational use,
 * see https://www.themealdb.com/api.php). Output is gitignored — every fork imports its own copy.
 * Stores only dish name, cuisine, category and ingredient names (no instructions, images or measures).
 * Runs automatically before `npm run build` (`--if-missing --soft`): deployments fetch their own copy,
 * and a TheMealDB outage never breaks a build — the app falls back to the curated recipes.
 */
import fs from "node:fs";
import path from "node:path";

const API = "https://www.themealdb.com/api/json/v1/1";
const AREAS = ["Indian", "Chinese", "Italian", "Thai", "Mexican", "Japanese", "American", "British", "French", "Greek", "Spanish", "Vietnamese", "Malaysian"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Meal = Record<string, string | null>;

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

const args = new Set(process.argv.slice(2));
const FILE = path.join(process.cwd(), "src", "lib", "recipes", "mealdb.json");

async function main() {
  if (args.has("--if-missing") && fs.existsSync(FILE)) return console.log("Recipes already imported, skipping.");
  const out: { name: string; area: string; category: string; ingredients: string[] }[] = [];
  for (const area of AREAS) {
    const { meals } = await get<{ meals: { idMeal: string }[] | null }>(`${API}/filter.php?a=${area}`);
    const ids = (meals ?? []).map((m) => m.idMeal);
    // 3 requests at a time with a short pause: quick enough for a build, polite to a free API.
    for (let i = 0; i < ids.length; i += 3) {
      const batch = await Promise.all(ids.slice(i, i + 3).map((id) => get<{ meals: Meal[] }>(`${API}/lookup.php?i=${id}`)));
      for (const { meals: [m] } of batch) {
        const ingredients = Array.from({ length: 20 }, (_, k) => m[`strIngredient${k + 1}`]?.trim()).filter((x): x is string => Boolean(x));
        out.push({ name: m.strMeal!, area, category: m.strCategory ?? "", ingredients });
      }
      await sleep(150);
    }
    console.log(`✔ ${area}: ${meals?.length ?? 0}`);
  }
  fs.writeFileSync(FILE, JSON.stringify(out));
  console.log(`Saved ${out.length} recipes → ${path.relative(process.cwd(), FILE)} (gitignored)`);
}

main().catch((e) => {
  console.error("Recipe import failed:", e instanceof Error ? e.message : e);
  if (args.has("--soft")) console.warn("Continuing with curated recipes only.");
  else process.exit(1);
});
