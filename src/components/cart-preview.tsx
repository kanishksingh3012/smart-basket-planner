"use client";

import { Alert, Button } from "@heroui/react";
import { Copy, Save } from "lucide-react";
import { useState } from "react";
import { inr } from "@/lib/format";
import { totalOf } from "@/lib/planner/basket";
import type { BasketPlan } from "@/lib/types";
import { AvailabilityChip } from "./item-card";
import { SendToCart } from "./send-to-cart";

type Props = { plan: BasketPlan; onBack: () => void; onSave: (name: string) => void; onCopy: () => void };

/** Final check before any consequential action. Nothing here writes to Instamart. */
export function CartPreview({ plan, onBack, onSave, onCopy }: Props) {
  const [name, setName] = useState("");
  const items = plan.items;
  const mrpTotal = items.reduce((s, i) => s + (i.product.mrp ?? i.product.price ?? 0) * i.quantity, 0);
  const total = totalOf(items);
  const flagged = items.filter((i) => i.product.availability !== "available");
  const noPrice = items.filter((i) => i.product.price === undefined).length;

  return (
    <div className="flex flex-1 flex-col gap-4 pb-8">
      <div className="pt-2">
        <h1 className="text-2xl font-semibold tracking-tight">Basket preview</h1>
        <p className="text-sm text-muted">Review your basket before you send it.</p>
      </div>

      <Alert status="default">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Your basket is a draft. No order has been placed.</Alert.Title>
          <Alert.Description>Prices and stock can change before checkout on Instamart.</Alert.Description>
        </Alert.Content>
      </Alert>

      <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {items.map((i) => (
          <li key={i.slot} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {i.quantity} × {i.product.name}
              </p>
              <p className="text-xs text-muted">{[i.product.brand, i.product.quantityLabel].filter(Boolean).join(" · ")}</p>
              {i.product.availability !== "available" && (
                <div className="mt-1">
                  <AvailabilityChip a={i.product.availability} />
                </div>
              )}
            </div>
            <p className="shrink-0 text-sm tabular">{i.product.price === undefined ? "N/A" : inr(i.product.price * i.quantity)}</p>
          </li>
        ))}
      </ul>

      <dl className="space-y-1 rounded-2xl border border-border bg-surface p-4 text-sm tabular">
        <div className="flex justify-between">
          <dt className="text-muted">Item total (MRP)</dt>
          <dd>{inr(mrpTotal)}</dd>
        </div>
        {mrpTotal > total && (
          <div className="flex justify-between text-success">
            <dt>Offer savings</dt>
            <dd>−{inr(mrpTotal - total)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
          <dt>Estimated total</dt>
          <dd>{inr(total)}</dd>
        </div>
        {plan.constraints.budget && (
          <p className={total > plan.constraints.budget ? "text-danger" : "text-muted"}>
            {total > plan.constraints.budget ? `${inr(total - plan.constraints.budget)} over` : `${inr(plan.constraints.budget - total)} under`} your {inr(plan.constraints.budget)} budget
          </p>
        )}
        <p className="pt-1 text-xs text-muted">Delivery, handling and coupons aren&apos;t included. Instamart adds them at checkout.</p>
        {noPrice > 0 && <p className="text-xs text-warning">{noPrice} item(s) without a price are not included.</p>}
        {flagged.length > 0 && <p className="text-xs text-warning">{flagged.length} item(s) are not confirmed in stock.</p>}
      </dl>

      <SendToCart plan={plan} />

      <form
        className="space-y-2 rounded-2xl border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name);
          setName("");
        }}
      >
        <label htmlFor="basket-name" className="text-sm font-medium">
          Save as a reusable basket
        </label>
        <div className="flex gap-2">
          <input
            id="basket-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. House party"
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <Button type="submit" variant="secondary">
            <Save className="size-4" /> Save
          </Button>
        </div>
      </form>

      <div className="flex gap-2">
        <Button variant="tertiary" className="flex-1" onPress={onBack}>
          Keep editing
        </Button>
        <Button variant="tertiary" className="flex-1" onPress={onCopy}>
          <Copy className="size-4" /> Copy list
        </Button>
      </div>
    </div>
  );
}
