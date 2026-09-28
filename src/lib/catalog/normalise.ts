import type { Availability, Product } from "@/lib/types";

/** Shape of Instamart `search_products` / `your_go_to_items` products (see docs/swiggy/DIGEST.md). */
export type McpVariation = {
  spinId?: string;
  skuId?: string;
  quantityDescription?: string;
  displayName?: string;
  brandName?: string;
  price?: { mrp?: number; offerPrice?: number; unitLevelPrice?: string };
  isInStockAndAvailable?: boolean;
  imageUrl?: string;
  rating?: { value?: string; count?: string };
  sla?: { value?: string; unit?: string };
  vegClassifier?: string;
  maxQuantity?: number;
};

export type McpProduct = {
  displayName?: string;
  brand?: string;
  inStock?: boolean;
  isAvail?: boolean;
  productId?: string;
  isPromoted?: boolean;
  badges?: { type?: string; text?: string }[];
  variations?: McpVariation[];
};

const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

function availabilityOf(p: McpProduct, v: McpVariation): Availability {
  const flag = v.isInStockAndAvailable ?? (p.inStock !== undefined || p.isAvail !== undefined ? Boolean(p.inStock && p.isAvail) : undefined);
  if (flag === undefined) return "unknown";
  if (!flag) return "unavailable";
  if (v.maxQuantity !== undefined && v.maxQuantity > 0 && v.maxQuantity <= 2) return "low_stock";
  return "available";
}

function slaMinutes(sla?: McpVariation["sla"]): number | undefined {
  const n = num(sla?.value);
  if (n === undefined || !sla?.unit) return undefined;
  const u = sla.unit.toLowerCase();
  if (u.startsWith("min")) return n;
  if (u.startsWith("h")) return n * 60;
  return undefined;
}

function vegOf(c?: string): boolean | undefined {
  if (!c) return undefined;
  const s = c.toLowerCase();
  if (s.includes("non")) return false;
  if (s.includes("veg")) return true;
  if (s.includes("egg")) return false;
  return undefined;
}

/**
 * One Product per variation. Only copies fields the MCP returned — never fills gaps.
 * `category` is the search slot so ranking can group results.
 */
export function normaliseProducts(raw: unknown, category: string, source: Product["source"]): Product[] {
  const list = (raw as { products?: McpProduct[] } | undefined)?.products;
  if (!Array.isArray(list)) return [];
  const out: Product[] = [];
  for (const p of list) {
    for (const v of p.variations ?? []) {
      const id = v.skuId ?? v.spinId;
      const name = v.displayName ?? p.displayName;
      if (!id || !name) continue;
      const veg = vegOf(v.vegClassifier);
      const tags = [
        ...(veg === true ? ["veg"] : veg === false ? ["non-veg"] : []),
        ...(p.badges ?? []).map((b) => b.text).filter((t): t is string => Boolean(t)),
        ...(p.isPromoted ? ["promoted"] : []),
      ];
      out.push({
        id,
        name,
        brand: v.brandName ?? p.brand ?? undefined,
        category,
        imageUrl: v.imageUrl,
        price: num(v.price?.offerPrice),
        mrp: num(v.price?.mrp),
        quantityLabel: v.quantityDescription,
        availability: availabilityOf(p, v),
        deliveryPromiseMinutes: slaMinutes(v.sla),
        rating: num(v.rating?.value),
        tags,
        veg,
        source,
      });
    }
  }
  return out;
}
