# Swiggy MCP — verified digest (fetched 2026-09-29)

Source: https://mcp.swiggy.com/builders/llms.txt + the raw pages in this folder. Read this instead of re-fetching.

## Servers & tool counts (from llms.txt)
- Food: **20 tools** (the "14" in older smoke-test notes is outdated).
- Instamart `POST https://mcp.swiggy.com/im`: 19 tools: apply_coupon, check_payment_status, checkout, clear_cart, confirm_order, create_address, delete_address, get_addresses, get_cart, get_delivery_status, get_order_details, get_orders, get_payment_options, list_coupons, report_error, search_products, track_order, update_cart, your_go_to_items.

## Tools this project uses
| Tool | Behaviour | Args | Use |
|---|---|---|---|
| `get_addresses` | read | — | Once per session, cache. Needed for every search. Show label only, never full address. |
| `search_products` | read | `addressId` (req, from get_addresses), `query` (req, non-empty), `offset?` | One call per search intent. |
| `your_go_to_items` | read | `addressId` | Optional "your usuals" (1 call replaces 3–5 searches). |
| `get_cart` | read | — | Optional, read-only. |
| `update_cart` | **mutating** | `selectedAddressId`, `items[]` (needs spinId+skuId) | **BLOCKED** in prototype. |
| checkout, confirm_order, payments, create/delete_address, clear_cart, apply_coupon | mutating | — | **BLOCKED**. |

## search_products / your_go_to_items response
Envelope: `{ success: true, data, message? }` or `{ success: false, error: { message, reportLink?, reportHint? } }`.
```ts
data: { nextOffset: string; products: SearchProduct[]; similarProducts?: SearchProduct[] }
type SearchProduct = { displayName; brand; inStock: boolean; isAvail: boolean; productId; parentProductId;
  isPromoted?; badges?: {type; text; backgroundColor?}[];
  variations: { spinId; skuId; quantityDescription; displayName; brandName;
    price: { mrp: number; offerPrice: number; unitLevelPrice?: string };
    isInStockAndAvailable: boolean; imageUrl?; rating?: { value: string; count: string };
    sla?: { value: string; unit: string }; vegClassifier?: string; maxQuantity?; maxQuantityMessage? }[] }
```
Mapping → our `Product`: one Product per variation; id=`skuId`; price=`offerPrice`; mrp; quantityLabel=`quantityDescription`; availability from `isInStockAndAvailable` (+ `maxQuantity` small → low_stock); deliveryPromiseMinutes from `sla` if unit is minutes; rating=Number(value); tags from `vegClassifier` + badges. Optional fields may be missing → leave undefined, UI shows "Not available".

## Auth (OAuth 2.1 + PKCE, no API key)
- DCR at `POST /auth/register`; `/auth/authorize` (phone+OTP in browser) → `/auth/token` (authorization_code only, **no refresh token in v1**). Scope `mcp:tools`.
- Access token 5 days; auth code 120 s single-use. `http://localhost` redirect allowed for dev.
- MCP TS SDK handles DCR+PKCE via an `OAuthClientProvider` (`authProvider` on StreamableHTTP transport).
- 401 / JSON-RPC -32001 → re-run login. 419 → full re-auth.
- Developer production access is **invite-based**; staging `mcp-staging.swiggy.com/{server}` after application. Consumer OAuth in Claude clients works today.

## Rate limits
70 req/min per user per server (write 30/min), burst 2× per 10 s. 429 + `Retry-After` → stop, back off.
**One MCP session per server process** — never re-initialize per call (auth events are rate-limited separately). get_addresses once per session.

## Errors (classify by HTTP status + message; no error.code yet)
401/-32001 auth → re-login · 400 "Invalid…/Missing…" → fix args, no retry · 504/"timeout" & 502/503 → exp backoff w/ jitter 500 ms→8 s, max 5 (we cap at 2 for UX) · 200 + success:false → domain failure, surface, no retry · 500/-32603 → backoff once. `report_error` exists on each server.
