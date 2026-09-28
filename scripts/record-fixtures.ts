/**
 * Records live Instamart search results for every playbook query into src/fixtures/recorded.json,
 * so mock mode demos real catalogue data. Writes straight to disk (no LLM involved).
 * Stores only the product list — never addresses or account data. Paced to stay far under 70 req/min.
 */
import fs from "node:fs";
import path from "node:path";
import { callReadTool } from "../src/lib/catalog/mcp-source";
import { PLAYBOOK } from "../src/lib/planner/intents";

async function main() {
  const addrs = (await callReadTool("get_addresses", {})) as { addresses?: { id: string }[] };
  const addressId = addrs.addresses?.[0]?.id;
  if (!addressId) throw new Error("No saved address on the Swiggy account");
  const queries = [...new Set(Object.values(PLAYBOOK).flat().map((i) => i.query))];
  const out: Record<string, unknown> = {};
  for (const q of queries) {
    try {
      const data = (await callReadTool("search_products", { addressId, query: q })) as { products?: unknown[] };
      out[q] = { products: (data.products ?? []).slice(0, 8) };
      console.log(`✔ ${q} (${(data.products ?? []).length})`);
    } catch (e) {
      console.log(`✖ ${q}: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  const file = path.join(process.cwd(), "src", "fixtures", "recorded.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(`Saved ${Object.keys(out).length} queries → ${path.relative(process.cwd(), file)}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
