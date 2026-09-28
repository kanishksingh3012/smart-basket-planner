import type { BasketPlan } from "@/lib/types";

export type SavedBasket = { id: string; name: string; plan: BasketPlan; savedAt: number };

const KEY = "sbp.saved.v1";

/** Saved baskets live in this browser only (prototype). Every access is guarded — storage can be blocked. */
export function listSaved(): SavedBasket[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as SavedBasket[];
  } catch {
    return [];
  }
}

export function saveBasket(name: string, plan: BasketPlan): SavedBasket | null {
  const entry: SavedBasket = { id: crypto.randomUUID(), name: name.trim() || "My basket", plan, savedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...listSaved()].slice(0, 20)));
    return entry;
  } catch {
    return null;
  }
}

export function deleteSaved(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(listSaved().filter((s) => s.id !== id)));
  } catch {
    /* storage unavailable — nothing to delete */
  }
}
