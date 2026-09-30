import { ConstraintsSchema, MISSION_TYPES, type Constraints, type MissionType } from "@/lib/types";
import { CUISINES } from "@/lib/recipes/data";
import { findDishes } from "@/lib/recipes";
import { CATEGORY_KEYS } from "./intents";

const WORD_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20,
};

const CATEGORY_WORDS: [string, RegExp][] = [
  ["healthy_snacks", /\bhealthy|makhana|protein snack|diet snack/],
  ["snacks", /\bsnack|chips|namkeen|munch|nibbl/],
  ["beverages", /\bdrinks?\b|beverage|soda|juice|cola/],
  ["breakfast", /\bbreakfast|morning|bread|cereal/],
  ["party_supplies", /\bparty|plates|cups|disposable/],
  ["staples", /\bstaples?|groceries|monthly|ration|atta|rice|dal\b/],
  ["fruits_veg", /\bveggies|vegetables|fruits?\b|sabzi/],
  ["cleaning", /\bclean|detergent|dishwash|household/],
  ["pet", /\bpet|dog|cat|puppy/],
  ["baby", /\bbaby|diaper|infant|toddler/],
  ["gifting", /\bgift|present|birthday|diwali|festive/],
  ["emergency", /\bemergency|power cut|outage|urgent supplies/],
];

const CUISINE_WORDS: [string, RegExp][] = [
  ["south indian", /south indian|dosa|idli|sambar/],
  ["chinese", /chinese|indo-?chinese|schezwan|szechuan|hakka|manchurian/],
  ["italian", /italian|pasta|pizza|risotto/],
  ["thai", /\bthai\b/],
  ["mexican", /mexican|burrito|taco|quesadilla|nachos/],
  ["continental", /continental|pancake/],
  ["indian", /\bindian|north indian|punjabi|desi|curry|dal\b|roti|paneer butter/],
  // Cuisines available via the optional TheMealDB import
  ...["japanese", "american", "british", "french", "greek", "spanish", "vietnamese", "malaysian"].map((k) => [k, new RegExp(`\\b${k}\\b`)] as [string, RegExp]),
];

const MISSION_WORDS: [MissionType, RegExp][] = [
  ["emergency", /\bemergency|power cut|urgent/],
  ["gifting", /\bgift|present/],
  ["occasion", /\bhost|party|guests|friends (?:coming |come )?over|coming over|celebrat|get-?together|potluck/],
  ["stock_up", /\bweekly|monthly|stock ?up|restock|replenish|ration/],
  ["meal_prep", /\bmeal prep|cook|dinner|lunch|recipe|prepare|preparing|make .{0,20}(for|at home)/],
  ["snack", /\bsnack|munch|movie night/],
  ["top_up", /\brunning out|ran out|top ?up|need some|quick/],
];

/** Deterministic parser: zero tokens, always available, used when no LLM key is set or the LLM fails. */
export function parseWithRules(text: string): Constraints {
  const t = text.toLowerCase().replace(/,(?=\d{3})/g, "");
  const peopleM = t.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty)\s*(?:people|persons|guests|friends|adults|of us|members|pax)/);
  const forM = peopleM ?? t.match(/\b(?:for|family of|party of)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\b(?!\s*(?:rs|₹|rupees|inr|kg|g\b|l\b|ml|days?|weeks?|hours?|mins?))/);
  const pair = /\b(me and my (girlfriend|boyfriend|wife|husband|partner|friend|roommate|flatmate|mom|mother|dad|father|sister|brother)|for (the )?two( of us)?|both of us|a couple|date night)\b/.test(t);
  const people = forM ? (WORD_NUM[forM[1]] ?? Number(forM[1])) : pair ? 2 : undefined;
  const budgetM = t.match(/(?:under|below|within|less than|max(?:imum)?|budget(?: of| is)?|upto|up to)\s*(?:₹|rs\.?|inr)?\s*(\d{2,6})/) ?? t.match(/(?:₹|rs\.?\s?|inr\s?)(\d{2,6})/);
  const budget = budgetM ? Number(budgetM[1]) : undefined;
  const dietary: Constraints["dietary"] = [];
  if (/\bvegan\b/.test(t)) dietary.push("vegan");
  else if (/\b(veg|vegetarian|veggie)\b/.test(t) && !/non[- ]?veg/.test(t)) dietary.push("veg");
  if (/no onion|jain/.test(t)) dietary.push("no_onion_garlic");
  if (/sugar[- ]?free|diabetic/.test(t)) dietary.push("sugar_free");
  if (/gluten[- ]?free/.test(t)) dietary.push("gluten_free");
  const avoid = [...t.matchAll(/\b(?:no|without|avoid|except|not)\s+([a-z]+(?:\s[a-z]+)?)/g)]
    .map((m) => m[1].trim())
    .filter((w) => !/^(more|need|sure|too|onion|garlic|sugar)/.test(w));
  const matched = CATEGORY_WORDS.filter(([, re]) => re.test(t)).map(([k]) => k);
  const categories = matched.includes("healthy_snacks") ? matched.filter((k) => k !== "snacks") : matched;
  const dishes = findDishes(text);
  const cuisine = CUISINE_WORDS.find(([, re]) => re.test(t))?.[0];
  const matchedMission = MISSION_WORDS.find(([, re]) => re.test(t))?.[0];
  const missionType = (dishes.length || (cuisine && !matchedMission)) && !/party|host|guests/.test(t) ? "meal_prep" : MISSION_WORDS.find(([, re]) => re.test(t))?.[0] ?? (categories.includes("snacks") ? "snack" : "top_up");
  const urgency = /\b(asap|now|tonight|immediately|as soon as|urgent|right away|in \d+ ?min)/.test(t) ? "asap" : /\btoday|this evening\b/.test(t) ? "today" : "flexible";
  const mustHaves = [...t.matchAll(/\bmust (?:have|include)\s+([a-z ]+?)(?:[,.;]|$| and )/g)].map((m) => m[1].trim());
  return ConstraintsSchema.parse({
    missionType,
    people,
    budget,
    dietary,
    brands: [...t.matchAll(/\b(?:only|prefer(?:ably)?|from)\s+([a-z]+)\s+brand/g)].map((m) => m[1]).filter((b) => !/^(trusted|good|premium|quality|known|big|top)$/.test(b)),
    preferTrusted: /trusted|good brands?|premium|quality|branded/.test(t),
    mustHaves,
    avoid,
    urgency,
    categories,
    cuisine,
    dishes,
  });
}

const PROMPT = `Extract grocery shopping constraints from the user's request. Use ONLY facts stated in the text; leave unknown fields out.
missionType: one of ${MISSION_TYPES.join(", ")}.
categories: pick from ${CATEGORY_KEYS.join(", ")} (only what the request needs).
mustHaves: specific products the user explicitly named that are not covered by a category. avoid: items/ingredients to exclude.
preferTrusted: true if they ask for trusted/good/premium brands without naming one. budget in rupees.
cuisine (cooking missions): one of ${CUISINES.join(", ")}. dishes: dish names they want to cook, e.g. "Veg Hakka Noodles".`;

/** Rules are trusted when they found both a mission keyword and at least one category. */
export function rulesConfident(text: string, c: Constraints): boolean {
  const t = text.toLowerCase();
  if (c.missionType === "meal_prep") return Boolean(c.cuisine || c.dishes.length);
  return c.categories.length > 0 && MISSION_WORDS.some(([, re]) => re.test(t));
}

const cache = new Map<string, { c: Constraints; parser: "llm" | "rules" }>();

/**
 * One small LLM call per unique mission (cached). The model sees only the user's sentence —
 * never catalogue data — so it cannot invent prices or stock. Falls back to rules on any failure.
 */
export async function parseMission(text: string): Promise<{ c: Constraints; parser: "llm" | "rules" }> {
  const key = text.trim().toLowerCase().replace(/\s+/g, " ");
  const hit = cache.get(key);
  if (hit) return hit;
  let result: { c: Constraints; parser: "llm" | "rules" } = { c: parseWithRules(text), parser: "rules" };
  const provider = process.env.LLM_PROVIDER ?? "none";
  // Token economy: clear requests are fully handled by rules (0 tokens, instant). Only ambiguous ones reach the LLM.
  if (provider !== "none" && !rulesConfident(text, result.c)) {
    try {
      const [{ generateText, Output }, model] = await Promise.all([import("ai"), getModel(provider)]);
      const { output } = await generateText({
        model,
        output: Output.object({ schema: ConstraintsSchema }),
        system: PROMPT,
        prompt: text.slice(0, 600),
        maxOutputTokens: 400,
        temperature: 0,
        abortSignal: AbortSignal.timeout(Number(process.env.PARSE_TIMEOUT_MS ?? 4000)),
      });
      const c = ConstraintsSchema.parse(output);
      // Guard: numbers must appear in the text (the model may not invent a budget or headcount).
      const rules = result.c;
      if (c.budget && !text.replace(/,/g, "").includes(String(c.budget))) c.budget = rules.budget;
      const word = Object.keys(WORD_NUM).find((w) => WORD_NUM[w] === c.people);
      if (rules.people) c.people = rules.people;
      else if (c.people && !new RegExp(`\\b(${c.people}${word ? `|${word}` : ""})\\b`, "i").test(text)) c.people = undefined;
      c.categories = c.categories.filter((k) => CATEGORY_KEYS.includes(k));
      if (!c.categories.length) c.categories = rules.categories;
      if (c.cuisine && !(CUISINES as readonly string[]).includes(c.cuisine.toLowerCase())) c.cuisine = rules.cuisine;
      c.dishes = [...new Set([...rules.dishes, ...c.dishes])];
      result = { c, parser: "llm" };
    } catch (e) {
      console.warn("[parse] LLM unavailable, using rules:", e instanceof Error ? e.message.slice(0, 120) : e);
    }
  }
  cache.set(key, result);
  return result;
}

async function getModel(provider: string) {
  if (provider === "groq") {
    const { groq } = await import("@ai-sdk/groq");
    return groq(process.env.GROQ_MODEL ?? "llama-3.1-8b-instant");
  }
  const { google } = await import("@ai-sdk/google");
  return google(process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite");
}
