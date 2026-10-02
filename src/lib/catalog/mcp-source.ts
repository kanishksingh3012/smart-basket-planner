import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { normaliseProducts } from "./normalise";
import { IM_SERVER_URL, swiggyOAuthProvider } from "./swiggy-oauth";
import type { CatalogErrorKind, SearchOutcome } from "@/lib/types";
import type { CatalogSource } from "./source";
import { mergeCart, type CartLine } from "@/lib/planner/basket";

/** Read-only allowlist. Every mutating Instamart tool (update_cart, checkout, …) is refused here. */
const ALLOWED_TOOLS = new Set(["get_addresses", "search_products", "your_go_to_items", "get_cart"]);
const TIMEOUT_MS = 12_000;

export class BlockedToolError extends Error {}

/** One MCP session per server process (Swiggy rate-limits auth handshakes separately). */
let clientPromise: Promise<Client> | null = null;

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
  return callTool(name, args);
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
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

export type Address = { id: string; label: string };
let addresses: Address[] | null = null;

/** Saved addresses as id + label only. The address line and phone number never leave this function. */
export async function listAddresses(): Promise<Address[]> {
  if (addresses) return addresses;
  const data = (await withRetry(() => callReadTool("get_addresses", {}))) as { addresses?: { id: string; addressTag?: string; addressCategory?: string }[] };
  addresses = (data.addresses ?? []).map((a, i) => ({ id: a.id, label: a.addressTag || a.addressCategory || `Address ${i + 1}` }));
  return addresses;
}

async function resolveAddress(id?: string): Promise<Address> {
  const list = await listAddresses();
  const a = list.find((x) => x.id === id) ?? list[0];
  if (!a) throw Object.assign(new Error("No saved delivery address on this Swiggy account."), { domain: true });
  return a;
}

/** Stock and prices depend on the delivery address, so every search is bound to one. */
export function liveSource(addressId?: string): CatalogSource {
  return {
    mode: "live",
    async search(query, slot): Promise<SearchOutcome> {
      try {
        const { id } = await resolveAddress(addressId);
        const data = await withRetry(() => callReadTool("search_products", { addressId: id, query }));
        return { ok: true, products: normaliseProducts(data, slot, "instamart-mcp").slice(0, 24) };
      } catch (e) {
        const { kind, message } = classify(e);
        if (kind === "auth_required") clientPromise = null;
        return { ok: false, error: kind, message };
      }
    },
  };
}
export const mcpSource = liveSource();

type RawCart = { items?: { spinId: string; skuId: string; itemName?: string; quantity: number }[]; cartTotalAmount?: string; billBreakdown?: { toPay?: { value?: string } } };
const lines = (c: RawCart): CartLine[] => (c.items ?? []).map((i) => ({ spinId: i.spinId, skuId: i.skuId, quantity: i.quantity, name: i.itemName }));

export async function getCart(): Promise<{ items: CartLine[]; total?: string }> {
  const c = (await withRetry(() => callReadTool("get_cart", {}))) as RawCart;
  return { items: lines(c), total: c.billBreakdown?.toPay?.value ?? c.cartTotalAmount };
}

export const cartWriteEnabled = () => process.env.CATALOG_MODE === "live" && process.env.ENABLE_CART_WRITE === "1";

/**
 * The ONLY write this app can make: fill the Instamart cart, after the shopper confirmed this exact send.
 * Never retried (a second call could double quantities). Checkout, payment and orders stay blocked.
 */
export async function sendToCart(args: { addressId?: string; items: CartLine[]; mode: "add" | "replace"; confirmed: boolean }) {
  if (args.confirmed !== true) throw new BlockedToolError("Cart write needs the shopper's confirmation");
  if (!cartWriteEnabled()) throw new BlockedToolError("Cart write is switched off (ENABLE_CART_WRITE)");
  const address = await resolveAddress(args.addressId);
  const items = args.mode === "add" ? mergeCart((await getCart()).items, args.items) : args.items;
  const c = (await callTool("update_cart", {
    selectedAddressId: address.id,
    items: items.map(({ spinId, skuId, quantity }) => ({ spinId, skuId, quantity })),
  })) as RawCart & { removedOutOfStockItems?: { itemName?: string }[]; reducedQuantityItems?: { itemName: string; requestedQuantity: number; cappedQuantity: number }[] };
  return {
    address: address.label,
    count: lines(c).reduce((n, l) => n + l.quantity, 0),
    total: c.billBreakdown?.toPay?.value ?? c.cartTotalAmount,
    removed: (c.removedOutOfStockItems ?? []).map((i) => i.itemName ?? "An item"),
    reduced: (c.reducedQuantityItems ?? []).map((i) => `${i.itemName}: ${i.requestedQuantity} → ${i.cappedQuantity}`),
  };
}
