import type { McpProduct } from "./normalise";

/**
 * SAMPLE catalogue for mock mode — fictional brands, illustrative prices.
 * Emitted in the exact Instamart `search_products` shape so the normaliser is exercised end-to-end.
 * Row: [name, brand, pack, offerPrice, mrp, veg (1 veg / 0 non-veg / null unknown), stock (1 in / 0 out / 2 low), rating]
 */
type Row = [string, string, string, number, number, 1 | 0 | null, 0 | 1 | 2, number | null];

const R: Record<string, Row[]> = {
  "potato chips": [
    ["Classic Salted Potato Chips", "Crunchworks", "150 g", 50, 60, 1, 1, 4.4],
    ["Masala Potato Chips", "Everyday Basics", "130 g", 35, 40, 1, 1, 4.0],
    ["Sour Cream & Onion Chips", "Trusted Select", "160 g", 70, 80, 1, 0, 4.6],
    ["Peri Peri Potato Chips", "Crunchworks", "90 g", 30, 30, 1, 2, 4.2],
  ],
  namkeen: [
    ["Aloo Bhujia", "Desi Bites", "400 g", 110, 125, 1, 1, 4.5],
    ["Classic Mixture Namkeen", "Everyday Basics", "400 g", 85, 99, 1, 1, 4.0],
    ["Khatta Meetha", "Trusted Select", "350 g", 120, 130, 1, 1, 4.6],
  ],
  cookies: [
    ["Butter Cookies", "Oven Fresh", "200 g", 60, 70, 1, 1, 4.3],
    ["Choco Chip Cookies", "Trusted Select", "250 g", 99, 120, 1, 1, 4.6],
    ["Marie Biscuits", "Everyday Basics", "250 g", 30, 35, 1, 1, 4.1],
  ],
  "soft drink": [
    ["Cola Soft Drink", "Fizzup", "1.25 L", 65, 70, 1, 1, 4.4],
    ["Lemon Soda", "Everyday Basics", "1.25 L", 45, 50, 1, 1, 4.0],
    ["Orange Soft Drink", "Fizzup", "750 ml", 40, 40, 1, 0, 4.2],
  ],
  "fruit juice": [
    ["Mixed Fruit Juice", "Orchard Valley", "1 L", 110, 125, 1, 1, 4.3],
    ["Guava Juice", "Everyday Basics", "1 L", 85, 99, 1, 1, 4.0],
  ],
  bread: [
    ["Whole Wheat Bread", "Oven Fresh", "400 g", 50, 55, 1, 1, 4.4],
    ["White Sandwich Bread", "Everyday Basics", "400 g", 40, 45, 1, 1, 4.0],
    ["Multigrain Bread", "Trusted Select", "450 g", 65, 70, 1, 2, 4.6],
  ],
  butter: [
    ["Salted Butter", "Daily Dairy", "100 g", 58, 60, 1, 1, 4.6],
    ["Salted Butter", "Everyday Basics", "100 g", 52, 56, 1, 1, 4.1],
  ],
  milk: [
    ["Toned Milk", "Daily Dairy", "1 L", 68, 68, 1, 1, 4.5],
    ["Full Cream Milk", "Trusted Select", "1 L", 74, 74, 1, 0, 4.7],
    ["Toned Milk", "Everyday Basics", "500 ml", 30, 30, 1, 1, 4.0],
  ],
  eggs: [
    ["Farm Eggs", "Farmgate", "6 pcs", 54, 60, 0, 1, 4.4],
    ["Brown Eggs", "Trusted Select", "6 pcs", 75, 84, 0, 1, 4.6],
  ],
  cornflakes: [
    ["Corn Flakes", "Morning Grain", "475 g", 175, 199, 1, 1, 4.4],
    ["Corn Flakes", "Everyday Basics", "500 g", 140, 160, 1, 1, 4.0],
    ["Honey Oat Flakes", "Trusted Select", "400 g", 220, 250, 1, 1, 4.6],
  ],
  jam: [
    ["Mixed Fruit Jam", "Orchard Valley", "200 g", 75, 85, 1, 1, 4.3],
    ["Strawberry Jam", "Everyday Basics", "200 g", 60, 65, 1, 1, 4.0],
  ],
  makhana: [
    ["Roasted Makhana Peri Peri", "Leafline", "70 g", 99, 120, 1, 1, 4.4],
    ["Roasted Makhana Salted", "Everyday Basics", "80 g", 80, 90, 1, 1, 4.0],
  ],
  "trail mix": [
    ["Nut & Berry Trail Mix", "Leafline", "150 g", 180, 220, 1, 1, 4.5],
    ["Seed Trail Mix", "Trusted Select", "200 g", 240, 260, 1, 0, 4.6],
  ],
  "greek yogurt": [
    ["Greek Yogurt Plain", "Daily Dairy", "100 g", 45, 50, 1, 1, 4.3],
    ["Greek Yogurt Blueberry", "Trusted Select", "100 g", 60, 60, 1, 2, 4.5],
  ],
  "paper cups": [["Paper Cups", "Glow Home", "50 pcs", 70, 90, null, 1, 4.1]],
  "paper plates": [
    ["Paper Plates", "Glow Home", "25 pcs", 85, 99, null, 1, 4.0],
    ["Areca Leaf Plates", "Trusted Select", "25 pcs", 160, 180, null, 1, 4.6],
  ],
  atta: [
    ["Whole Wheat Atta", "Farmgate", "5 kg", 260, 290, 1, 1, 4.5],
    ["Whole Wheat Atta", "Everyday Basics", "5 kg", 230, 250, 1, 1, 4.0],
  ],
  rice: [
    ["Basmati Rice", "Trusted Select", "1 kg", 160, 190, 1, 1, 4.6],
    ["Sona Masoori Rice", "Everyday Basics", "5 kg", 380, 420, 1, 1, 4.1],
  ],
  "toor dal": [
    ["Toor Dal", "Farmgate", "1 kg", 165, 180, 1, 1, 4.4],
    ["Toor Dal", "Everyday Basics", "1 kg", 150, 170, 1, 0, 4.0],
  ],
  "sunflower oil": [
    ["Refined Sunflower Oil", "Everyday Basics", "1 L", 145, 160, 1, 1, 4.1],
    ["Cold Pressed Sunflower Oil", "Trusted Select", "1 L", 260, 290, 1, 1, 4.5],
  ],
  tea: [
    ["Assam Tea", "Chai Co", "250 g", 140, 160, 1, 1, 4.5],
    ["Premium Tea", "Everyday Basics", "250 g", 110, 125, 1, 1, 4.0],
  ],
  onion: [["Onion", "Fresh Picks", "1 kg", 38, 45, 1, 1, null]],
  tomato: [
    ["Tomato Hybrid", "Fresh Picks", "500 g", 22, 30, 1, 1, null],
    ["Tomato Local", "Fresh Picks", "500 g", 18, 25, 1, 0, null],
  ],
  banana: [["Banana Robusta", "Fresh Picks", "6 pcs", 45, 55, 1, 1, null]],
  "dishwash liquid": [
    ["Lemon Dishwash Liquid", "Glow Home", "750 ml", 115, 130, null, 1, 4.3],
    ["Dishwash Liquid", "Everyday Basics", "500 ml", 75, 85, null, 1, 4.0],
  ],
  detergent: [
    ["Matic Liquid Detergent", "Glow Home", "1 L", 199, 240, null, 1, 4.4],
    ["Detergent Powder", "Everyday Basics", "1 kg", 99, 110, null, 1, 4.0],
  ],
  paneer: [
    ["Fresh Paneer", "Daily Dairy", "200 g", 90, 95, 1, 1, 4.5],
    ["Malai Paneer", "Trusted Select", "200 g", 110, 120, 1, 2, 4.7],
  ],
  "instant noodles": [
    ["Masala Instant Noodles (Pack of 4)", "Quickbowl", "280 g", 56, 60, 1, 1, 4.4],
    ["Atta Noodles (Pack of 4)", "Everyday Basics", "280 g", 48, 52, 1, 1, 4.0],
  ],
  "dog food": [
    ["Adult Dog Food Chicken", "HappyPaws", "1.2 kg", 320, 360, 0, 1, 4.5],
    ["Adult Dog Food Veg", "HappyPaws", "1.2 kg", 290, 320, 1, 0, 4.2],
  ],
  "dog treats": [["Chicken Jerky Dog Treats", "HappyPaws", "70 g", 150, 175, 0, 1, 4.3]],
  diapers: [
    ["Diaper Pants M", "Tiny Steps", "34 pcs", 499, 649, null, 1, 4.5],
    ["Diaper Pants M", "Everyday Basics", "30 pcs", 399, 450, null, 1, 4.0],
  ],
  "baby wipes": [["Gentle Baby Wipes", "Tiny Steps", "72 pcs", 99, 149, null, 1, 4.6]],
  "chocolate gift box": [
    ["Assorted Chocolate Gift Box", "Cocoa Lane", "250 g", 399, 450, 1, 1, 4.6],
    ["Milk Chocolate Gift Pack", "Trusted Select", "180 g", 299, 320, 1, 0, 4.5],
  ],
  "dry fruits gift": [["Dry Fruits Gift Box", "Farmgate", "400 g", 549, 650, 1, 1, 4.5]],
  batteries: [
    ["AA Alkaline Batteries", "Spark", "4 pcs", 120, 140, null, 1, 4.4],
    ["AA Batteries", "Everyday Basics", "4 pcs", 80, 90, null, 1, 3.9],
  ],
  candles: [["Emergency Candles", "Glow Home", "6 pcs", 60, 70, null, 1, 4.1]],
};

const toMcp = (query: string, rows: Row[]): McpProduct[] =>
  rows.map(([name, brand, pack, price, mrp, veg, stock, rating], i) => {
    const id = `sample-${query.replace(/\s+/g, "-")}-${i}`;
    return {
      displayName: name,
      brand,
      inStock: stock !== 0,
      isAvail: stock !== 0,
      productId: id,
      variations: [
        {
          spinId: `${id}-spin`,
          skuId: id,
          quantityDescription: pack,
          displayName: name,
          brandName: brand,
          price: { mrp, offerPrice: price },
          isInStockAndAvailable: stock !== 0,
          imageUrl: undefined,
          rating: rating == null ? undefined : { value: String(rating), count: "1k+" },
          sla: { value: "12", unit: "MINS" },
          vegClassifier: veg == null ? undefined : veg ? "VEG" : "NONVEG",
          maxQuantity: stock === 2 ? 2 : 10,
        },
      ],
    };
  });

export const SAMPLE_QUERIES = Object.keys(R);

/** Exact query match first, then loose keyword match (so user must-haves like "coke" can still miss → zero-result state). */
export function sampleSearch(query: string): { products: McpProduct[] } {
  const q = query.toLowerCase().trim();
  if (R[q]) return { products: toMcp(q, R[q]) };
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  const hits = Object.entries(R).flatMap(([k, rows]) =>
    toMcp(k, rows).filter((p) => words.some((w) => (p.displayName ?? "").toLowerCase().includes(w) || k.includes(w))),
  );
  return { products: hits.slice(0, 8) };
}
