"use client";

import { Button, Spinner } from "@heroui/react";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { inr } from "@/lib/format";
import type { Constraints, Product } from "@/lib/types";
import { AvailabilityChip, ProductThumb } from "./item-card";

type Props = {
  constraints: Constraints;
  /** Budget left before this item; undefined when there's no budget. */
  remaining?: number;
  onAdd: (product: Product, alternatives: Product[], query: string) => void;
};

/** true = fits the budget, false = pushes it over, null = can't tell (no budget or no price). */
const fitsBudget = (p: Product, remaining?: number) =>
  remaining === undefined || p.price === undefined
    ? null
    : p.price <= remaining;

/** Lets the shopper add anything the plan missed: type it, see matches, tap to add. */
export function AddItem({ constraints, remaining, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [results, setResults] = useState<Product[] | null>(null);
  const [excluded, setExcluded] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    const q = query.trim();
    if (q.length < 2) return setError("Type at least two letters.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, constraints }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setResults(data.products);
      setExcluded(data.excluded ?? 0);
      setSearched(q);
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Couldn't search right now. Try again.",
      );
      setResults(null);
    } finally {
      setBusy(false);
    }
  }

  const add = (p: Product) => {
    onAdd(p, results ?? [], searched);
    setResults(null);
    setQuery("");
  };

  return (
    <section
      aria-labelledby="add-h"
      className="space-y-3 rounded-2xl border border-border bg-surface p-4"
    >
      <div>
        <h2 id="add-h" className="font-semibold">
          Anything else?
        </h2>
        <p className="text-sm text-muted">
          Add whatever you need. We&apos;ll find it and keep it in your basket.
          {remaining !== undefined && (
            <span className="block tabular">
              {remaining >= 0
                ? `${inr(remaining)} left in your budget.`
                : `You're already ${inr(-remaining)} over budget.`}
            </span>
          )}
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <label htmlFor="add-query" className="sr-only">
          Item to add
        </label>
        <input
          id="add-query"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (error) setError("");
          }}
          placeholder="Ice cream, lemons, candles…"
          enterKeyHint="search"
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <Button
          type="submit"
          variant="secondary"
          isDisabled={busy}
          aria-label="Find item"
        >
          {busy ? (
            <Spinner size="sm" color="current" />
          ) : (
            <Search className="size-4" />
          )}
          Find
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {results && (
        <div aria-live="polite" className="space-y-2">
          {results.length === 0 ? (
            <p className="text-sm text-muted">
              Couldn&apos;t find &ldquo;{searched}&rdquo;
              {excluded ? " that fits your diet or avoid list" : ""}. Try
              another name.
            </p>
          ) : (
            <ul className="space-y-2">
              {[...results]
                .sort(
                  (a, b) =>
                    Number(fitsBudget(b, remaining) === true) -
                    Number(fitsBudget(a, remaining) === true),
                )
                .map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 rounded-xl border border-border p-2"
                  >
                    <ProductThumb src={r.imageUrl} name={r.name} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="truncate text-xs text-muted">
                        {[
                          r.brand,
                          r.quantityLabel,
                          r.price !== undefined ? inr(r.price) : undefined,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {fitsBudget(r, remaining) === true && (
                        <p className="text-xs font-medium text-success">
                          Fits your budget
                        </p>
                      )}
                      {fitsBudget(r, remaining) === false && (
                        <p className="text-xs font-medium text-warning tabular">
                          {inr(r.price! - Math.max(remaining!, 0))} over budget
                        </p>
                      )}
                      {r.availability !== "available" && (
                        <AvailabilityChip a={r.availability} />
                      )}
                    </div>
                    <Button
                      size="sm"
                      isDisabled={r.availability === "unavailable"}
                      onPress={() => add(r)}
                      aria-label={`Add ${r.name}`}
                    >
                      <Plus className="size-4" /> Add
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
