import { z } from "zod";

export const MISSION_TYPES = [
  "stock_up",
  "top_up",
  "snack",
  "occasion",
  "meal_prep",
  "gifting",
  "emergency",
] as const;
export type MissionType = (typeof MISSION_TYPES)[number];

export const MISSION_LABEL: Record<MissionType, string> = {
  stock_up: "Stock-up",
  top_up: "Top-up",
  snack: "Snacks",
  occasion: "Occasion",
  meal_prep: "Meal prep",
  gifting: "Gifting",
  emergency: "Emergency",
};

export const BUDGET_MODES = ["under_budget", "coverage", "quality"] as const;
export type BudgetMode = (typeof BUDGET_MODES)[number];

export const ConstraintsSchema = z.object({
  missionType: z.enum(MISSION_TYPES),
  people: z.number().int().positive().max(100).optional(),
  budget: z.number().positive().max(100000).optional(),
  dietary: z.array(z.enum(["veg", "vegan", "egg", "no_onion_garlic", "sugar_free", "gluten_free"])).default([]),
  brands: z.array(z.string()).default([]),
  /** "trusted / good brands" without naming one → favour well-rated products. */
  preferTrusted: z.boolean().default(false),
  mustHaves: z.array(z.string()).default([]),
  avoid: z.array(z.string()).default([]),
  urgency: z.enum(["asap", "today", "flexible"]).default("flexible"),
  /** Product categories the mission needs, e.g. ["snacks", "breakfast"]. */
  categories: z.array(z.string()).default([]),
});
export type Constraints = z.infer<typeof ConstraintsSchema>;

export type Availability = "available" | "low_stock" | "unavailable" | "unknown";

export type Product = {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  price?: number;
  mrp?: number;
  quantityLabel?: string;
  availability: Availability;
  deliveryPromiseMinutes?: number;
  rating?: number;
  tags?: string[];
  veg?: boolean;
  source: "instamart-mcp" | "mock";
};

export type Priority = "must_have" | "recommended" | "optional";

export type BasketItem = {
  product: Product;
  quantity: number;
  priority: Priority;
  reason: string;
  /** The search intent this line covers, e.g. "breakfast: bread". */
  slot: string;
  alternatives: Product[];
  userApproved: boolean;
  /** Set when the user pinned or edited this line; automatic changes must not touch it. */
  userLocked?: boolean;
  note?: string;
};

export type Warning = { kind: "partial" | "unavailable" | "budget" | "uncertain" | "no_results" | "conflict"; text: string };

export type BasketPlan = {
  mission: string;
  constraints: Constraints;
  budgetMode: BudgetMode;
  items: BasketItem[];
  estimatedTotal: number;
  warnings: Warning[];
  /** Human-readable log of what the planner did, shown under "What I did". */
  steps: string[];
  catalogMode: "live" | "mock";
  parser: "llm" | "rules";
};

export type ClarifyQuestion = {
  id: "people" | "budget";
  text: string;
  options: { label: string; value: number }[];
};

/** A search intent: one catalogue query that fills one basket slot. */
export type Intent = {
  slot: string;
  query: string;
  priority: Priority;
  /** Units needed per person (for quantity sizing); 0 = fixed 1 unit. */
  perPerson: number;
};

export type SearchOutcome =
  | { ok: true; products: Product[] }
  | { ok: false; error: CatalogErrorKind; message: string };

export type CatalogErrorKind = "auth_required" | "rate_limited" | "timeout" | "tool_error" | "bad_input" | "blocked";
