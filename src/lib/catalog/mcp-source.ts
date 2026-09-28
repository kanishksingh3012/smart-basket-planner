import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { normaliseProducts } from "./normalise";
import { IM_SERVER_URL, swiggyOAuthProvider } from "./swiggy-oauth";
import type { CatalogErrorKind, SearchOutcome } from "@/lib/types";
import type { CatalogSource } from "./source";

/** Read-only allowlist. Every mutating Instamart tool (update_cart, checkout, …) is refused here. */
const ALLOWED_TOOLS = new Set(["get_addresses", "search_products", "your_go_to_items", "get_cart"]);
const TIMEOUT_MS = 12_000;

export class BlockedToolError extends Error {}

/** One MCP session per server process (Swiggy rate-limits auth handshakes separately). */
let clientPromise: Promise<Client> | null = null;
let addressId: string | null = null;

async function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const transport = new StreamableHTTPClientTransport(new URL(IM_SERVER_URL), {
        authProvider: swiggyOAuthProvider(),
      });
      const client = new Client({ name: "smart-basket-planner", version: "0.1.0" });
      await client.connect(transport);
      return client;
    })().catch((e) => {
      clientPromise = null;
      throw e;
    });
  }
  return clientPromise;
}

export async function callReadTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (!ALLOWED_TOOLS.has(name)) throw new BlockedToolError(`Tool "${name}" is blocked in this prototype`);
  const client = await getClient();
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: TIMEOUT_MS });
  const payload = extractPayload(res);
  if (payload && typeof payload === "object" && (payload as { success?: boolean }).success === false) {
    const msg = (payload as { error?: { message?: string } }).error?.message ?? "Tool error";
    throw Object.assign(new Error(msg), { domain: true });
  }
  return (payload as { data?: unknown })?.data ?? payload;
}

/** Tools return the envelope as structuredContent or as JSON text content. */
function extractPayload(res: unknown): unknown {
  const r = res as { structuredContent?: unknown; content?: { type: string; text?: string }[]; isError?: boolean };
  if (r.structuredContent) return r.structuredContent;
  const text = r.content?.find((c) => c.type === "text")?.text;
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    if (r.isError) throw Object.assign(new Error(text.slice(0, 200)), { domain: true });
    return undefined;
  }
}

export function classify(e: unknown): { kind: CatalogErrorKind; message: string } {
  const err = e as { message?: string; code?: number; status?: number; domain?: boolean };
  const m = (err?.message ?? String(e)).toLowerCase();
  if (e instanceof BlockedToolError) return { kind: "blocked", message: err.message! };
  // The SDK's own request timeout also uses -32001, so match timeout text before the auth code.
  if (m.includes("timeout") || m.includes("timed out")) return { kind: "timeout", message: "Instamart search timed out." };
  if (m.includes("auth_required") || m.includes("unauthorized") || err.code === -32001 || err.status === 401)
    return { kind: "auth_required", message: "Connect your Swiggy account to search live." };
  if (m.includes("429") || m.includes("rate limit")) return { kind: "rate_limited", message: "Instamart is rate-limiting requests." };
  if (m.startsWith("invalid") || m.startsWith("missing")) return { kind: "bad_input", message: err.message! };
  return { kind: "tool_error", message: err.domain ? err.message! : "Instamart returned an error." };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries only safe read calls, only for transient failures, max 2 attempts total. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const { kind } = classify(e);
    if (kind !== "timeout" && kind !== "tool_error") throw e;
    if ((e as { domain?: boolean }).domain) throw e;
    await sleep(500 + Math.random() * 300);
    return fn();
  }
}

async function getAddressId(): Promise<string> {
  if (addressId) return addressId;
  const data = (await withRetry(() => callReadTool("get_addresses", {}))) as unknown;
  const list = Array.isArray(data) ? data : ((data as { addresses?: unknown[] })?.addresses ?? []);
  const first = (list as { id?: string; addressId?: string }[])[0];
  const id = first?.id ?? first?.addressId;
  if (!id) throw Object.assign(new Error("No saved delivery address on this Swiggy account."), { domain: true });
  addressId = id;
  return id;
}

export const mcpSource: CatalogSource = {
  mode: "live",
  async search(query, slot): Promise<SearchOutcome> {
    try {
      const id = await getAddressId();
      const data = await withRetry(() => callReadTool("search_products", { addressId: id, query }));
      return { ok: true, products: normaliseProducts(data, slot, "instamart-mcp").slice(0, 12) };
    } catch (e) {
      const { kind, message } = classify(e);
      if (kind === "auth_required") clientPromise = null;
      return { ok: false, error: kind, message };
    }
  },
};
