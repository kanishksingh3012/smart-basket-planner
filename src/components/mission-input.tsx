"use client";

import { Button, Spinner } from "@heroui/react";
import { ArrowRight, Sparkles } from "lucide-react";

const EXAMPLES = [
  "Hosting 6 people tonight — veg snacks and breakfast under ₹1,200, trusted brands, ASAP",
  "Weekly groceries for 2, budget ₹2,000, no rice",
  "Healthy snacks for the office, 4 people, under ₹800",
  "Power cut emergency — need supplies now",
  "Birthday gift hamper under ₹1,000",
];

type Props = { value: string; onChange: (v: string) => void; onSubmit: () => void; busy: boolean; savedCount: number; onSaved: () => void };

export function MissionInput({ value, onChange, onSubmit, busy, savedCount, onSaved }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="space-y-2 pt-4">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">What are you shopping for?</h1>
        <p className="text-ink-soft">Describe the occasion or need. I&apos;ll build a basket you can check and edit before anything happens.</p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim().length >= 3 && !busy) onSubmit();
        }}
      >
        <label htmlFor="mission" className="sr-only">
          Your shopping mission
        </label>
        <textarea
          id="mission"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
          rows={4}
          maxLength={600}
          placeholder="e.g. Friends coming over at 8 — 5 people, veg snacks and drinks, under ₹1,000"
          className="w-full resize-none rounded-2xl border border-border bg-surface p-4 text-base leading-relaxed shadow-sm outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
        />
        <Button type="submit" className="w-full" size="lg" isDisabled={value.trim().length < 3 || busy}>
          {busy ? <Spinner size="sm" color="current" /> : <Sparkles className="size-4" />}
          {busy ? "Understanding your mission…" : "Plan my basket"}
        </Button>
      </form>

      <section aria-labelledby="examples-h" className="space-y-2">
        <h2 id="examples-h" className="text-sm font-medium text-muted">
          Try a mission
        </h2>
        <ul className="space-y-2">
          {EXAMPLES.map((ex) => (
            <li key={ex}>
              <button
                type="button"
                onClick={() => {
                  onChange(ex);
                  const box = document.getElementById("mission");
                  box?.scrollIntoView({ behavior: "smooth", block: "center" });
                  box?.focus({ preventScroll: true });
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span>{ex}</span>
                <ArrowRight aria-hidden className="size-4 shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {savedCount > 0 && (
        <Button variant="secondary" onPress={onSaved}>
          Saved baskets ({savedCount})
        </Button>
      )}
    </div>
  );
}
