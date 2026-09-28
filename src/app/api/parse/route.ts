import { z } from "zod";
import { parseMission } from "@/lib/planner/parse";
import { MISSION_DEFAULT_CATEGORIES } from "@/lib/planner/intents";
import { clarifyQuestions } from "@/lib/planner/plan";

const Body = z.object({ text: z.string().trim().min(3).max(600) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Describe what you need in a few words." }, { status: 400 });
  const { c: parsed, parser } = await parseMission(body.data.text);
  // Pre-select the mission's default categories so the review screen shows exactly what will be searched.
  const c = parsed.categories.length ? parsed : { ...parsed, categories: MISSION_DEFAULT_CATEGORIES[parsed.missionType] };
  const catalogMode = process.env.CATALOG_MODE === "live" ? "live" : "mock";
  return Response.json({ constraints: c, parser, questions: clarifyQuestions(c), catalogMode });
}
