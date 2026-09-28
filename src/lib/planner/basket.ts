/**
 * Pure, client-safe basket operations. Every edit and quick action runs here in the browser:
 * zero LLM tokens, zero MCP calls. Automatic changes never touch lines the user locked.
 */
import type { BasketItem, BasketPlan, Priority, Product } from "@/lib/types";

export const lineTotal = (i: BasketItem) => (i.product.price ?? 0) * i.quantity;
export const totalOf = (items: BasketItem[]) => items.reduce((s, i) => s + lineTotal(i), 0);
export const unknownPriceCount = (items: BasketItem[]) => items.filter((i) => i.product.price === undefined).length;

const PRIORITY_RANK: Record<Priority, number> = { must_have: 0, recommended: 1, optional: 2 };

function withTotals(plan: BasketPlan, items: BasketItem[]): BasketPlan {
  return { ...plan, items, estimatedTotal: totalOf(items) };
}

const update = (plan: BasketPlan, slot: string, fn: (i: BasketItem) => BasketItem | null) =>
  withTotals(plan, plan.items.flatMap((i) => (i.slot === slot ? (fn(i) ?? []) : [i])));

export const setQty = (plan: BasketPlan, slot: string, q: number) =>
  update(plan, slot, (i) => (q <= 0 ? null : { ...i, quantity: Math.min(q, 20), userLocked: true }));

export const removeItem = (plan: BasketPlan, slot: string) => update(plan, slot, () => null);

export const setPriority = (plan: BasketPlan, slot: string, priority: Priority) =>
  update(plan, slot, (i) => ({ ...i, priority, userLocked: true }));

export const setNote = (plan: BasketPlan, slot: string, note: string) => update(plan, slot, (i) => ({ ...i, note }));

export function swap(plan: BasketPlan, slot: string, productId: string, reason?: string): BasketPlan {
  return update(plan, slot, (i) => {
    const next = i.alternatives.find((a) => a.id === productId);
    if (!next) return i;
    return {
      ...i,
      product: next,
      alternatives: [i.product, ...i.alternatives.filter((a) => a.id !== productId)],
      reason: reason ?? `You swapped this in for ${i.product.name}.`,
      userLocked: true,
      userApproved: true,
    };
  });
}

const bestAvailable = (alts: Product[]) => alts.find((a) => a.availability === "available") ?? alts.find((a) => a.availability === "low_stock");

/** Quick action: "Replace unavailable items" — explicit, explained, skips user-locked lines. */
export function replaceUnavailable(plan: BasketPlan): { plan: BasketPlan; changes: string[] } {
  const changes: string[] = [];
  let next = plan;
  for (const i of plan.items) {
    if (i.product.availability !== "unavailable" || i.userLocked) continue;
    const alt = bestAvailable(i.alternatives);
    if (!alt) continue;
    next = swap(next, i.slot, alt.id, `${i.product.name} is out of stock — replaced with the closest in-stock option.`);
    changes.push(`${i.product.name} → ${alt.name}`);
  }
  return { plan: next, changes };
}

/** Quick action: "Use fewer brands" — consolidate onto the most common brand where an in-stock option exists. */
export function fewerBrands(plan: BasketPlan): { plan: BasketPlan; changes: string[] } {
  const counts = new Map<string, number>();
  for (const i of plan.items) for (const p of [i.product, ...i.alternatives]) if (p.brand) counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const changes: string[] = [];
  if (!top) return { plan, changes };
  let next = plan;
  for (const i of plan.items) {
    if (i.userLocked || i.product.brand === top) continue;
    const alt = i.alternatives.find((a) => a.brand === top && a.availability !== "unavailable");
    if (!alt) continue;
    next = swap(next, i.slot, alt.id, `Switched to ${top} to keep your basket to fewer brands.`);
    changes.push(`${i.slot}: ${i.product.brand ?? "?"} → ${top}`);
  }
  return { plan: next, changes };
}

export type BudgetStep = { slot: string; kind: "remove" | "reduce" | "cheaper"; text: string; saving: number; toId?: string; toQty?: number };

/**
 * Transparent reduction plan (brief §6): 1 drop optional → 2 trim excess quantity → 3 cheaper alternatives.
 * Must-haves are never changed automatically — they are returned for the user to decide.
 */
export function budgetPlan(
  plan: BasketPlan,
  budget = plan.constraints.budget,
  /** Only after the user confirms: allow cheaper swaps on must-haves too. */
  includeMustHaves = false,
): { steps: BudgetStep[]; over: number; mustHaveOver: boolean } {
  if (!budget) return { steps: [], over: 0, mustHaveOver: false };
  let over = totalOf(plan.items) - budget;
  const steps: BudgetStep[] = [];
  if (over <= 0) return { steps, over: 0, mustHaveOver: false };
  const free = plan.items.filter((i) => !i.userLocked && i.priority !== "must_have");
  const byCost = (a: BasketItem, b: BasketItem) => lineTotal(b) - lineTotal(a);
  for (const i of free.filter((i) => i.priority === "optional").sort(byCost)) {
    if (over <= 0) break;
    steps.push({ slot: i.slot, kind: "remove", text: `Remove ${i.product.name} (optional)`, saving: lineTotal(i) });
    over -= lineTotal(i);
  }
  for (const i of free.filter((i) => i.priority === "recommended" && i.quantity > 1).sort(byCost)) {
    if (over <= 0) break;
    const drop = Math.min(i.quantity - 1, Math.ceil(over / (i.product.price || 1)));
    const saving = drop * (i.product.price ?? 0);
    steps.push({ slot: i.slot, kind: "reduce", text: `${i.product.name}: ${i.quantity} → ${i.quantity - drop}`, saving, toQty: i.quantity - drop });
    over -= saving;
  }
  const removed = new Set(steps.filter((s) => s.kind === "remove").map((s) => s.slot));
  const swappable = includeMustHaves ? plan.items.filter((i) => !i.userLocked) : free;
  for (const i of swappable.filter((i) => !removed.has(i.slot)).sort(byCost)) {
    if (over <= 0) break;
    const cheaper = i.alternatives
      .filter((a) => a.price !== undefined && i.product.price !== undefined && a.price < i.product.price && a.availability !== "unavailable")
      .sort((a, b) => a.price! - b.price!)[0];
    if (!cheaper) continue;
    const saving = (i.product.price! - cheaper.price!) * i.quantity;
    steps.push({ slot: i.slot, kind: "cheaper", text: `${i.product.name} → ${cheaper.name}`, saving, toId: cheaper.id });
    over -= saving;
  }
  return { steps, over: Math.max(0, Math.round(over)), mustHaveOver: over > 0 };
}

export function applyBudgetPlan(plan: BasketPlan, steps: BudgetStep[]): BasketPlan {
  let next = plan;
  for (const s of steps) {
    if (s.kind === "remove") next = removeItem(next, s.slot);
    if (s.kind === "cheaper" && s.toId) next = swap(next, s.slot, s.toId, "Swapped for a cheaper option to fit your budget.");
    if (s.kind === "reduce") {
      const to = s.toQty ?? 0;
      if (to > 0) next = update(next, s.slot, (x) => ({ ...x, quantity: to, reason: `${x.reason} Quantity trimmed to fit your budget.` }));
    }
  }
  return next;
}

export const sortByPriority = (items: BasketItem[]) => [...items].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
