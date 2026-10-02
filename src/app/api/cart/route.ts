import { z } from "zod";
import { BlockedToolError, cartWriteEnabled, classify, getCart, listAddresses, sendToCart } from "@/lib/catalog/mcp-source";

const live = () => process.env.CATALOG_MODE === "live";

/** Connection status, address labels and what's already in the Instamart cart. Read-only. */
export async function GET() {
  if (!live()) return Response.json({ live: false });
  try {
    const [addresses, cart] = await Promise.all([listAddresses(), getCart()]);
    return Response.json({ live: true, writeEnabled: cartWriteEnabled(), addresses, cartCount: cart.items.reduce((n, i) => n + i.quantity, 0) });
  } catch (e) {
    return Response.json({ live: true, error: classify(e).kind });
  }
}

const Body = z.object({
  addressId: z.string().max(64).optional(),
  mode: z.enum(["add", "replace"]),
  confirm: z.literal(true),
  items: z.array(z.object({ spinId: z.string().min(1), skuId: z.string().min(1), quantity: z.number().int().min(1).max(20), name: z.string().optional() })).min(1).max(40),
});

/** Fills the shopper's Instamart cart after an explicit confirmation. Never checks out or pays. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_input", message: "Nothing was sent." }, { status: 400 });
  try {
    const { confirm, ...rest } = body.data;
    return Response.json({ result: await sendToCart({ ...rest, confirmed: confirm }) });
  } catch (e) {
    if (e instanceof BlockedToolError) return Response.json({ error: "blocked", message: e.message }, { status: 403 });
    const { kind } = classify(e);
    // A failed write may still have landed, so never claim "nothing changed" and never retry.
    return Response.json({ error: kind, message: "We couldn't confirm the update. Please check your cart in Swiggy before trying again." }, { status: 502 });
  }
}
