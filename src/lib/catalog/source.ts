import fs from "node:fs";
import path from "node:path";
import { normaliseProducts } from "./normalise";
import { sampleSearch } from "./sample-catalogue";
import type { SearchOutcome } from "@/lib/types";

export interface CatalogSource {
  mode: "live" | "mock";
  search(query: string, slot: string): Promise<SearchOutcome>;
}

/** Live responses recorded by `npm run record` (products only — no addresses or PII). */
const RECORDED = path.join(process.cwd(), "src", "fixtures", "recorded.json");
let recorded: Record<string, unknown> | null | undefined;
function recordedFor(query: string): unknown {
  if (recorded === undefined) {
    try {
      recorded = JSON.parse(fs.readFileSync(RECORDED, "utf8"));
    } catch {
      recorded = null;
    }
  }
  return recorded?.[query.toLowerCase()];
}

/**
 * Deterministic mock. Recorded live fixtures win over the sample catalogue.
 * Test hooks: queries containing "__timeout" / "__error" / "__ratelimit" simulate failures.
 */
export const mockSource: CatalogSource = {
  mode: "mock",
  async search(query, slot) {
    await new Promise((r) => setTimeout(r, process.env.VITEST || process.env.NO_MOCK_LATENCY ? 0 : 120 + Math.random() * 200));
    if (query.includes("__timeout")) return { ok: false, error: "timeout", message: "Instamart search timed out." };
    if (query.includes("__error")) return { ok: false, error: "tool_error", message: "Instamart returned an error." };
    if (query.includes("__ratelimit")) return { ok: false, error: "rate_limited", message: "Instamart is rate-limiting requests." };
    const raw = recordedFor(query) ?? sampleSearch(query);
    return { ok: true, products: normaliseProducts(raw, slot, "mock").slice(0, 12) };
  },
};

export async function getSource(): Promise<CatalogSource> {
  if (process.env.CATALOG_MODE === "live") return (await import("./mcp-source")).mcpSource;
  return mockSource;
}
