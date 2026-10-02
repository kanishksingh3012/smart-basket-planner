import { z } from "zod";
import { getSource } from "@/lib/catalog/source";
import { buildPlan, PlanError } from "@/lib/planner/plan";
import { BUDGET_MODES, ConstraintsSchema } from "@/lib/types";

const Body = z.object({
  mission: z.string().max(600),
  constraints: ConstraintsSchema,
  budgetMode: z.enum(BUDGET_MODES).default("under_budget"),
  parser: z.enum(["llm", "rules"]).default("rules"),
  addressId: z.string().max(64).optional(),
});

const STATUS = { auth_required: 401, rate_limited: 429, timeout: 504, tool_error: 502, bad_input: 400, blocked: 403 } as const;

/** Read-only planning endpoint. It never writes to the Instamart cart or places orders. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_input", message: "Invalid request." }, { status: 400 });
  try {
    const plan = await buildPlan({ ...body.data, source: await getSource(body.data.addressId) });
    return Response.json({ plan });
  } catch (e) {
    if (e instanceof PlanError) return Response.json({ error: e.kind, message: e.message }, { status: STATUS[e.kind] });
    console.error("[plan] unexpected", e instanceof Error ? e.message : "error");
    return Response.json({ error: "tool_error", message: "Something went wrong while planning." }, { status: 500 });
  }
}
