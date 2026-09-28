"use client";

import { Button } from "@heroui/react";
import { RefreshCw, Trash2 } from "lucide-react";
import { inr } from "@/lib/format";
import type { SavedBasket } from "@/lib/saved";
import { MISSION_LABEL } from "@/lib/types";

type Props = { saved: SavedBasket[]; onOpen: (s: SavedBasket) => void; onReplan: (s: SavedBasket) => void; onDelete: (id: string) => void; onNew: () => void };

export function SavedBaskets({ saved, onOpen, onReplan, onDelete, onNew }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-4 pt-2">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Saved baskets</h1>
        <p className="text-sm text-muted">Reuse a mission. Re-planning fetches fresh prices and stock.</p>
      </div>
      {saved.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="font-medium">No saved baskets yet</p>
          <p className="mt-1 text-sm text-muted">Save one from the basket preview — e.g. &ldquo;Weekly essentials&rdquo; or &ldquo;Friday snacks&rdquo;.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {saved.map((s) => (
            <li key={s.id} className="rounded-2xl border border-border bg-surface p-4">
              <button type="button" onClick={() => onOpen(s)} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <p className="font-semibold">{s.name}</p>
                <p className="text-sm text-muted tabular">
                  {MISSION_LABEL[s.plan.constraints.missionType]} · {s.plan.items.length} items · {inr(s.plan.estimatedTotal)}
                  {s.plan.constraints.budget ? ` · budget ${inr(s.plan.constraints.budget)}` : ""}
                </p>
                <p className="text-xs text-muted">Last edited {new Date(s.savedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
              </button>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onPress={() => onReplan(s)}>
                  <RefreshCw className="size-4" /> Re-plan with fresh prices
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Delete ${s.name}`} onPress={() => onDelete(s.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button variant="tertiary" onPress={onNew}>
        Start a new mission
      </Button>
    </div>
  );
}
