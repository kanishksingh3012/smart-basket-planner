"use client";

import { Button, Chip, Spinner, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Pencil, X } from "lucide-react";
import { useState } from "react";
import { CATEGORY_LABEL, DIETARY_LABEL } from "@/lib/format";
import { CATEGORY_KEYS } from "@/lib/planner/intents";
import { MISSION_LABEL, MISSION_TYPES, type BudgetMode, type ClarifyQuestion, type Constraints } from "@/lib/types";

type Props = {
  mission: string;
  constraints: Constraints;
  questions: ClarifyQuestion[];
  parser: "llm" | "rules";
  budgetMode: BudgetMode;
  busy: boolean;
  onChange: (c: Constraints) => void;
  onBudgetMode: (m: BudgetMode) => void;
  onEditMission: () => void;
  onBuild: () => void;
};

const BUDGET_MODES: { id: BudgetMode; label: string }[] = [
  { id: "under_budget", label: "Under budget" },
  { id: "coverage", label: "Cover all" },
  { id: "quality", label: "Quality" },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

function ListEditor({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <Row label={label}>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Remove ${v}`}
          >
            {v} <X aria-hidden className="size-3.5" />
          </button>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={placeholder}
          aria-label={label}
          className="min-w-32 flex-1 rounded-full border border-dashed border-border bg-transparent px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
    </Row>
  );
}

export function ConstraintsReview(p: Props) {
  const c = p.constraints;
  const set = (patch: Partial<Constraints>) => p.onChange({ ...c, ...patch });
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="flex flex-1 flex-col gap-5 pb-28">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-ink-soft">&ldquo;{p.mission}&rdquo;</p>
          <Button isIconOnly size="sm" variant="ghost" aria-label="Edit mission text" onPress={p.onEditMission}>
            <Pencil className="size-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">
          {p.parser === "llm" ? "Understood with AI — check and correct anything below." : "Understood with basic parsing — check and correct anything below."}
        </p>
      </div>

      {p.questions.length > 0 && (
        <section aria-label="Quick questions" className="space-y-4 rounded-2xl bg-accent-soft p-4">
          {p.questions.map((q) => {
            const current = q.id === "people" ? c.people : c.budget;
            return (
              <Row key={q.id} label={q.text}>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((o) => {
                    const selected = current === o.value || (o.value === 0 && current === undefined);
                    return (
                      <Button
                        key={o.label}
                        size="sm"
                        variant={selected ? "primary" : "secondary"}
                        aria-pressed={selected}
                        onPress={() => set(q.id === "people" ? { people: o.value } : { budget: o.value || undefined })}
                      >
                        {o.label}
                      </Button>
                    );
                  })}
                </div>
              </Row>
            );
          })}
        </section>
      )}

      <Row label="Mission">
        <div className="flex flex-wrap gap-2">
          {MISSION_TYPES.map((m) => (
            <button key={m} type="button" onClick={() => set({ missionType: m })} aria-pressed={c.missionType === m} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <Chip color={c.missionType === m ? "accent" : "default"} variant={c.missionType === m ? "primary" : "secondary"}>
                {MISSION_LABEL[m]}
              </Chip>
            </button>
          ))}
        </div>
      </Row>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-2">
          <span className="text-sm font-medium">People</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            value={c.people ?? ""}
            placeholder="—"
            onChange={(e) => set({ people: e.target.value ? Math.max(1, Math.min(50, Number(e.target.value))) : undefined })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 tabular outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Budget (₹)</span>
          <input
            type="number"
            inputMode="numeric"
            min={50}
            step={50}
            value={c.budget ?? ""}
            placeholder="No limit"
            onChange={(e) => set({ budget: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 tabular outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
      </div>

      <Row label="What to include">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_KEYS.map((k) => {
            const on = c.categories.includes(k);
            return (
              <button key={k} type="button" onClick={() => set({ categories: toggle(c.categories, k) })} aria-pressed={on} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <Chip size="sm" color={on ? "accent" : "default"} variant={on ? "primary" : "secondary"}>
                  {CATEGORY_LABEL[k]}
                </Chip>
              </button>
            );
          })}
        </div>
      </Row>

      <Row label="Dietary">
        <div className="flex flex-wrap gap-2">
          {(["veg", "vegan", "no_onion_garlic", "sugar_free", "gluten_free"] as const).map((d) => {
            const on = c.dietary.includes(d);
            return (
              <button key={d} type="button" onClick={() => set({ dietary: toggle(c.dietary, d) })} aria-pressed={on} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <Chip size="sm" color={on ? "success" : "default"} variant={on ? "primary" : "secondary"}>
                  {DIETARY_LABEL[d]}
                </Chip>
              </button>
            );
          })}
        </div>
        {c.dietary.some((d) => d !== "veg" && d !== "vegan") && (
          <p className="text-xs text-muted">Instamart may not label this — flagged items will need your check. This is not dietary advice.</p>
        )}
      </Row>

      <ListEditor label="Must-have items" values={c.mustHaves} onChange={(v) => set({ mustHaves: v })} placeholder="Add item…" />
      <ListEditor label="Avoid" values={c.avoid} onChange={(v) => set({ avoid: v })} placeholder="Add ingredient or item…" />
      <ListEditor label="Preferred brands" values={c.brands} onChange={(v) => set({ brands: v })} placeholder="Add brand…" />

      <Row label="Budget strategy">
        <ToggleButtonGroup
          aria-label="Budget strategy"
          className="w-full"
          size="sm"
          selectionMode="single"
          selectedKeys={[p.budgetMode]}
          onSelectionChange={(keys) => {
            const k = [...keys][0] as BudgetMode | undefined;
            if (k) p.onBudgetMode(k);
          }}
        >
          {BUDGET_MODES.map((m) => (
            <ToggleButton key={m.id} id={m.id} className="flex-1">
              {m.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Row>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <Button className="w-full" size="lg" onPress={p.onBuild} isDisabled={p.busy || (!c.categories.length && !c.mustHaves.length)}>
            {p.busy && <Spinner size="sm" color="current" />}
            {p.busy ? "Searching Instamart…" : "Build my basket"}
          </Button>
          {!c.categories.length && !c.mustHaves.length && <p className="mt-2 text-center text-xs text-muted">Pick at least one thing to include.</p>}
        </div>
      </div>
    </div>
  );
}
