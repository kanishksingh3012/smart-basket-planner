"use client";

import { Alert, Button, Chip } from "@heroui/react";
import { ChevronDown, Pencil, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DIETARY_LABEL, inr, PRIORITY_LABEL } from "@/lib/format";
import { addItem, applyBudgetPlan, budgetPlan, fewerBrands, replaceUnavailable, unknownPriceCount } from "@/lib/planner/basket";
import { MISSION_LABEL, type BasketPlan, type Priority } from "@/lib/types";
import { AddItem } from "./add-item";
import { ItemCard } from "./item-card";

type Props = {
  plan: BasketPlan;
  canUndo: boolean;
  busy: boolean;
  onPlan: (p: BasketPlan, message?: string) => void;
  onUndo: () => void;
  onQty: (slot: string, q: number) => void;
  onOpenItem: (slot: string) => void;
  onEditConstraints: () => void;
  onAddHealthier: () => void;
  onReview: () => void;
};

const ALERT_STATUS = { partial: "warning", no_results: "default", unavailable: "danger", uncertain: "warning", conflict: "warning", budget: "warning" } as const;

export function BasketView(p: Props) {
  const { plan } = p;
  const c = plan.constraints;
  const [essentialsOnly, setEssentialsOnly] = useState(false);
  const [confirmMust, setConfirmMust] = useState(false);
  const reduction = useMemo(() => budgetPlan(plan, c.budget, confirmMust), [plan, c.budget, confirmMust]);
  const over = c.budget ? plan.estimatedTotal - c.budget : 0;
  const pct = c.budget ? Math.min(100, (plan.estimatedTotal / c.budget) * 100) : 0;
  const unknownPrices = unknownPriceCount(plan.items);
  const hasUnavailable = plan.items.some((i) => i.product.availability === "unavailable");
  const visible = essentialsOnly ? plan.items.filter((i) => i.priority === "must_have") : plan.items;
  const groups = (["must_have", "recommended", "optional"] as Priority[]).map((k) => ({ k, items: visible.filter((i) => i.priority === k) }));
  const liveWarnings = plan.warnings.filter((w) => w.kind !== "budget" && (w.kind !== "unavailable" || hasUnavailable));

  const quick = (label: string, fn: () => { plan: BasketPlan; changes: string[] }) => {
    const r = fn();
    p.onPlan(r.plan, r.changes.length ? `${label}: ${r.changes.length} change${r.changes.length > 1 ? "s" : ""}` : `${label}: nothing to change`);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pb-32">
      {/* Goal stays visible */}
      <section aria-label="Your request" className="sticky top-0 z-10 -mx-4 border-b border-border bg-app/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Chip size="sm" color="accent" variant="primary">
              {MISSION_LABEL[c.missionType]}
            </Chip>
            {c.people && <Chip size="sm" variant="secondary">{c.people} people</Chip>}
            {c.dietary.map((d) => (
              <Chip key={d} size="sm" variant="secondary">
                {DIETARY_LABEL[d]}
              </Chip>
            ))}
            {c.urgency === "asap" && <Chip size="sm" variant="secondary">ASAP</Chip>}
          </div>
          <Button size="sm" variant="ghost" onPress={p.onEditConstraints} aria-label="Edit your request">
            <Pencil className="size-4" /> Edit
          </Button>
        </div>
        {c.budget ? (
          <div className="mt-3">
            <div className="flex justify-between text-sm tabular">
              <span className={over > 0 ? "font-semibold text-danger" : "font-semibold"}>{inr(plan.estimatedTotal)}</span>
              <span className="text-muted">of {inr(c.budget)} budget</span>
            </div>
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-surface-secondary"
              role="meter"
              aria-label="Budget used"
              aria-valuemin={0}
              aria-valuemax={c.budget}
              aria-valuenow={Math.round(plan.estimatedTotal)}
            >
              <div className={`h-full rounded-full transition-all ${over > 0 ? "bg-danger" : "bg-accent"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm tabular text-muted">Estimated total {inr(plan.estimatedTotal)} · no budget set</p>
        )}
      </section>

      {over > 0 && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{inr(over)} over budget</Alert.Title>
            <Alert.Description>
              {reduction.steps.length ? (
                <>
                  Here&apos;s how to bring it back under budget:
                  <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                    {reduction.steps.map((s) => (
                      <li key={s.slot + s.kind}>
                        {s.text} <span className="whitespace-nowrap tabular text-muted">(−{inr(s.saving)})</span>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                "Only must-have items are left to change."
              )}
              {reduction.mustHaveOver && !confirmMust && (
                <p className="mt-2">
                  That still leaves you {inr(reduction.over)} over.{" "}
                  <button type="button" className="font-medium underline" onClick={() => setConfirmMust(true)}>
                    Find cheaper options for must-haves too
                  </button>
                </p>
              )}
            </Alert.Description>
            {reduction.steps.length > 0 && (
              <Button
                size="sm"
                className="mt-2"
                onPress={() => {
                  p.onPlan(applyBudgetPlan(plan, reduction.steps), `Applied ${reduction.steps.length} budget change(s)`);
                  setConfirmMust(false);
                }}
              >
                Apply these changes
              </Button>
            )}
          </Alert.Content>
        </Alert>
      )}

      {plan.menu?.length > 0 && (
        <section aria-label="Menu" className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Menu for {c.people ?? 2}</p>
          <p className="mt-1 font-semibold">{plan.menu.map((m) => m.name).join(" + ")}</p>
          {plan.assumedPantry?.length > 0 && <p className="mt-1 text-sm text-muted">Assumes you have {plan.assumedPantry.join(", ").toLowerCase()}.</p>}
          <button type="button" onClick={p.onEditConstraints} className="mt-2 text-sm font-medium text-accent underline-offset-2 hover:underline">
            Change dishes
          </button>
        </section>
      )}

      {liveWarnings.map((w, i) => (
        <Alert key={w.kind + i} status={ALERT_STATUS[w.kind]}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{w.text}</Alert.Description>
          </Alert.Content>
        </Alert>
      ))}
      {unknownPrices > 0 && <p className="text-sm text-muted">Instamart didn&apos;t return a price for {unknownPrices} item(s), so they aren&apos;t in the total.</p>}

      <nav aria-label="Quick actions" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Button size="sm" variant="secondary" className="shrink-0" onPress={() => p.onPlan({ ...plan, constraints: { ...c, budget: 1000 } }, "Budget set to ₹1,000")}>
          Under ₹1,000
        </Button>
        <Button size="sm" variant="secondary" className="shrink-0" isDisabled={p.busy} onPress={p.onAddHealthier}>
          Add healthier options
        </Button>
        <Button size="sm" variant="secondary" className="shrink-0" onPress={() => quick("Fewer brands", () => fewerBrands(plan))}>
          Use fewer brands
        </Button>
        <Button size="sm" variant="secondary" className="shrink-0" isDisabled={!hasUnavailable} onPress={() => quick("Replaced unavailable", () => replaceUnavailable(plan))}>
          Replace unavailable
        </Button>
        <Button size="sm" variant={essentialsOnly ? "primary" : "secondary"} className="shrink-0" aria-pressed={essentialsOnly} onPress={() => setEssentialsOnly((v) => !v)}>
          Only essentials
        </Button>
        {p.canUndo && (
          <Button size="sm" variant="ghost" className="shrink-0" onPress={p.onUndo}>
            <Undo2 className="size-4" /> Undo
          </Button>
        )}
      </nav>

      {plan.items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="font-medium">Your basket is empty</p>
          <p className="mt-1 text-sm text-muted">Add items below, or edit your request to plan again.</p>
        </div>
      )}

      {groups.map(
        ({ k, items }) =>
          items.length > 0 && (
            <section key={k} aria-labelledby={`g-${k}`} className="space-y-2">
              <h2 id={`g-${k}`} className="flex items-baseline justify-between text-sm font-semibold">
                {PRIORITY_LABEL[k]} <span className="font-normal text-muted">{items.length}</span>
              </h2>
              <ul className="space-y-2">
                {items.map((i) => (
                  <ItemCard key={i.slot} item={i} onQty={(q) => p.onQty(i.slot, q)} onOpen={() => p.onOpenItem(i.slot)} />
                ))}
              </ul>
            </section>
          ),
      )}
      <AddItem
        constraints={c}
        remaining={c.budget ? c.budget - plan.estimatedTotal : undefined}
        onAdd={(product, alts, query) => p.onPlan(addItem(plan, product, alts, query), `Added ${product.name}`)}
      />

      {essentialsOnly && plan.items.length > visible.length && (
        <p className="text-center text-sm text-muted">{plan.items.length - visible.length} non-essential item(s) hidden. They&apos;re still in your basket.</p>
      )}

      <details className="group rounded-2xl border border-border bg-surface p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
          How this basket was planned <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
          {plan.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
          <li>Nothing was added to your Instamart cart. This is a draft.</li>
        </ol>
      </details>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="tabular">
            <p className="text-xs text-muted">{plan.items.reduce((s, i) => s + i.quantity, 0)} items · estimate</p>
            <p className="text-lg font-semibold">{inr(plan.estimatedTotal)}</p>
          </div>
          <Button size="lg" onPress={p.onReview} isDisabled={plan.items.length === 0}>
            Review basket
          </Button>
        </div>
      </div>
    </div>
  );
}
