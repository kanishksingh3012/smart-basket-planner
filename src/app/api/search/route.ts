import { z } from "zod";
import { getSource } from "@/lib/catalog/source";
import { pickForIntent } from "@/lib/planner/rank";
import { ConstraintsSchema } from "@/lib/types";

const Body = z.object({ query: z.string().trim().min(2).max(80), constraints: ConstraintsSchema });

/** Read-only: suggestions for an item the shopper wants to add themselves. Respects their diet and avoid list. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_input", message: "Type at least two letters." }, { status: 400 });
  const { query, constraints } = body.data;
  const source = await getSource();
  const res = await source.search(query, query);
  if (!res.ok) return Response.json({ error: res.error, message: res.message }, { status: 502 });
  const pick = pickForIntent(res.products, constraints, "coverage", query, true);
  const products = [pick.chosen, ...pick.alternatives].filter((p): p is NonNullable<typeof p> => Boolean(p));
  return Response.json({ products, excluded: pick.excluded });
}
