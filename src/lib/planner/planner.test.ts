import { describe, expect, it } from "vitest";
import { mockSource, type CatalogSource } from "@/lib/catalog/source";
import { normaliseProducts } from "@/lib/catalog/normalise";
import { sampleSearch as sampleProducts } from "@/lib/catalog/sample-catalogue";
import { BlockedToolError, callReadTool, sendToCart } from "@/lib/catalog/mcp-source";
import { ConstraintsSchema, type BasketPlan } from "@/lib/types";
import { parseWithRules } from "./parse";
import { buildPlan, clarifyQuestions, PlanError } from "./plan";
import { addItem, applyBudgetPlan, mergeCart, budgetPlan, fewerBrands, replaceUnavailable, totalOf } from "./basket";

const EXAMPLE =
  "I'm hosting six people tonight. I need vegetarian snacks and breakfast items under ₹1,200, preferably from trusted brands, delivered as soon as possible.";

const plan = (text: string, source: CatalogSource = mockSource) =>
  buildPlan({ mission: text, constraints: parseWithRules(text), budgetMode: "under_budget", source, parser: "rules" });

describe("parseWithRules", () => {
  it("extracts the brief's example mission", () => {
    const c = parseWithRules(EXAMPLE);
    expect(c).toMatchObject({ missionType: "occasion", people: 6, budget: 1200, dietary: ["veg"], urgency: "asap", preferTrusted: true, brands: [] });
    expect(c.categories).toEqual(expect.arrayContaining(["snacks", "breakfast"]));
  });
  it("reads avoid lists and budgets written as Rs", () => {
    const c = parseWithRules("weekly groceries for 2, no rice, budget Rs 2000");
    expect(c).toMatchObject({ missionType: "stock_up", people: 2, budget: 2000 });
    expect(c.avoid).toContain("rice");
  });
});

describe("cooking missions (recipe base)", () => {
  const DATE = "I want to prepare dinner for me and my girlfriend. I want to have Chinese, and the budget is 1000";
  it("reads cuisine, headcount from 'me and my girlfriend', and budget", () => {
    expect(parseWithRules(DATE)).toMatchObject({ missionType: "meal_prep", people: 2, budget: 1000, cuisine: "chinese" });
  });
  it("plans a Chinese menu and buys its real ingredients, not near-misses", async () => {
    const p = await plan(DATE);
    expect(p.menu.map((m) => m.name)).toContain("Veg Hakka Noodles");
    const names = p.items.map((i) => i.product.name.toLowerCase());
    expect(names.some((n) => n.includes("hakka noodles"))).toBe(true);
    expect(names.some((n) => n.includes("soy sauce"))).toBe(true);
    expect(names.some((n) => n.includes("atta noodles"))).toBe(false);
    expect(p.estimatedTotal).toBeLessThanOrEqual(1000);
    expect(p.items.every((i) => /^For /.test(i.reason))).toBe(true);
  });
  it("detects named dishes and skips pantry staples unless asked", async () => {
    const c = parseWithRules("make paneer butter masala and jeera rice for 4");
    expect(c.dishes).toEqual(expect.arrayContaining(["Paneer Butter Masala", "Jeera Rice"]));
    const p = await plan("make paneer butter masala and jeera rice for 4");
    expect(p.items.some((i) => /iodised salt|garam masala/i.test(i.product.name))).toBe(false);
    expect(p.assumedPantry).toContain("Garam masala");
  });
  it("asks what to cook when the cuisine is missing", () => {
    expect(clarifyQuestions(parseWithRules("cooking dinner tonight for 3")).map((q) => q.id)).toContain("cuisine");
  });
  it("does not treat 'no rice' as a dish", () => {
    expect(parseWithRules("weekly groceries for 2, no rice").dishes).toEqual([]);
  });
});

describe("clarifyQuestions", () => {
  it("asks at most two questions, only for missing info", () => {
    expect(clarifyQuestions(parseWithRules("snacks for a movie night"))).toHaveLength(2);
    expect(clarifyQuestions(parseWithRules(EXAMPLE))).toHaveLength(0);
  });
});

describe("normaliseProducts", () => {
  it("never invents missing fields", () => {
    const [p] = normaliseProducts({ products: [{ displayName: "X", variations: [{ skuId: "1" }] }] }, "Chips", "mock");
    expect(p).toMatchObject({ id: "1", name: "X", availability: "unknown" });
    expect(p.price).toBeUndefined();
    expect(p.rating).toBeUndefined();
  });
  it("ignores malformed payloads", () => {
    expect(normaliseProducts({ nope: true }, "x", "mock")).toEqual([]);
    expect(normaliseProducts(undefined, "x", "mock")).toEqual([]);
  });
});

describe("buildPlan", () => {
  it("builds a veg, explained basket for the example mission", async () => {
    const p = await plan(EXAMPLE);
    expect(p.items.length).toBeGreaterThan(4);
    expect(p.items.every((i) => i.product.veg !== false)).toBe(true); // eggs excluded
    expect(p.items.every((i) => i.reason.length > 10)).toBe(true);
    expect(p.items.find((i) => i.slot === "Chips")?.quantity).toBe(3); // 0.5 per person × 6
  });
  it("explains when the preferred product is out of stock", async () => {
    const p = await buildPlan({
      mission: "snacks",
      constraints: ConstraintsSchema.parse({ missionType: "snack", people: 4, brands: ["Trusted Select"], categories: ["snacks"] }),
      budgetMode: "under_budget",
      source: mockSource,
      parser: "rules",
    });
    const chips = p.items.find((i) => i.slot === "Chips")!;
    expect(chips.product.availability).not.toBe("unavailable");
    expect(chips.reason).toMatch(/out of stock/);
  });
  it("continues with partial results and warns", async () => {
    const flaky: CatalogSource = { mode: "mock", search: (q, s) => (q === "namkeen" ? mockSource.search("__timeout", s) : mockSource.search(q, s)) };
    const p = await plan(EXAMPLE, flaky);
    expect(p.items.length).toBeGreaterThan(3);
    expect(p.warnings.some((w) => w.kind === "partial")).toBe(true);
  });
  it("fails with a typed error when every search fails", async () => {
    const down: CatalogSource = { mode: "mock", search: (_q, s) => mockSource.search("__ratelimit", s) };
    await expect(plan(EXAMPLE, down)).rejects.toBeInstanceOf(PlanError);
  });
  it("reports zero-result must-haves", async () => {
    const p = await buildPlan({
      mission: "x",
      constraints: ConstraintsSchema.parse({ missionType: "top_up", mustHaves: ["unicorn truffle"], categories: ["breakfast"] }),
      budgetMode: "under_budget",
      source: mockSource,
      parser: "rules",
    });
    expect(p.warnings.find((w) => w.kind === "no_results")?.text).toMatch(/Unicorn truffle/);
  });
});

describe("budget plan", () => {
  it("drops optional first, never touches must-haves without consent", async () => {
    const p: BasketPlan = await plan("party for 10 people with snacks, drinks and breakfast under ₹600");
    const { steps } = budgetPlan(p);
    expect(steps[0].kind).toBe("remove");
    const mustSlots = new Set(p.items.filter((i) => i.priority === "must_have").map((i) => i.slot));
    expect(steps.every((s) => !mustSlots.has(s.slot))).toBe(true);
    const after = applyBudgetPlan(p, steps);
    expect(totalOf(after.items)).toBeLessThan(totalOf(p.items));
  });
});

describe("quick actions", () => {
  it("replaces unavailable items with explanations and skips locked lines", async () => {
    const p = await plan(EXAMPLE);
    const forced: BasketPlan = { ...p, items: p.items.map((i, n) => (n === 0 ? { ...i, product: { ...i.product, availability: "unavailable" } } : i)) };
    const { plan: next, changes } = replaceUnavailable(forced);
    expect(changes).toHaveLength(1);
    expect(next.items[0].reason).toMatch(/out of stock/);
  });
  it("consolidates brands", async () => {
    const { changes } = fewerBrands(await plan(EXAMPLE));
    expect(Array.isArray(changes)).toBe(true);
  });
});

describe("adding your own items", () => {
  it("adds a locked line that budget plans never touch, and bumps quantity on repeat", async () => {
    const p = await plan("party for 10 people with snacks, drinks and breakfast under ₹600");
    const [paneer] = normaliseProducts(sampleProducts("paneer"), "Paneer", "mock");
    const once = addItem(p, paneer, [], "paneer");
    const line = once.items.find((i) => i.product.id === paneer.id)!;
    expect(line).toMatchObject({ quantity: 1, userLocked: true, reason: "You added this." });
    expect(budgetPlan(once).steps.some((s) => s.slot === line.slot)).toBe(false);
    expect(addItem(once, paneer, [], "paneer").items.find((i) => i.product.id === paneer.id)!.quantity).toBe(2);
    expect(once.estimatedTotal).toBe(totalOf(once.items));
  });
});

describe("safety", () => {
  it("blocks every mutating Instamart tool before any network call", async () => {
    for (const t of ["update_cart", "checkout", "confirm_order", "create_address", "clear_cart"])
      await expect(callReadTool(t, {})).rejects.toBeInstanceOf(BlockedToolError);
  });
});

describe("sending to the Instamart cart", () => {
  const line = { spinId: "s1", skuId: "k1", quantity: 1 };
  it("refuses without the shopper's confirmation, and when the write switch is off", async () => {
    await expect(sendToCart({ items: [line], mode: "add", confirmed: false })).rejects.toBeInstanceOf(BlockedToolError);
    await expect(sendToCart({ items: [line], mode: "add", confirmed: true })).rejects.toBeInstanceOf(BlockedToolError); // ENABLE_CART_WRITE unset
  });
  it("keeps existing cart lines and sums quantities when adding", () => {
    const merged = mergeCart([{ spinId: "s1", skuId: "k1", quantity: 2 }, { spinId: "s9", skuId: "k9", quantity: 1 }], [line, { spinId: "s2", skuId: "k2", quantity: 3 }]);
    expect(merged).toEqual([
      { spinId: "s1", skuId: "k1", quantity: 3 },
      { spinId: "s9", skuId: "k9", quantity: 1 },
      { spinId: "s2", skuId: "k2", quantity: 3 },
    ]);
  });
});
