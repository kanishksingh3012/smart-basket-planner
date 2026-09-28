"use client";

import { Button, Chip, toast, Toast } from "@heroui/react";
import { ArrowLeft, ShoppingBasket } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { removeItem, setNote, setPriority, setQty, swap } from "@/lib/planner/basket";
import { deleteSaved, listSaved, saveBasket, type SavedBasket } from "@/lib/saved";
import type { BasketPlan, BudgetMode, CatalogErrorKind, ClarifyQuestion, Constraints } from "@/lib/types";
import { BasketView } from "./basket-view";
import { CartPreview } from "./cart-preview";
import { ConstraintsReview } from "./constraints-review";
import { ItemSheet } from "./item-sheet";
import { MissionInput } from "./mission-input";
import { SavedBaskets } from "./saved-baskets";
import { BasketSkeleton, StateView } from "./state-view";

type Stage = "input" | "review" | "basket" | "cart" | "saved";
type ErrorKind = CatalogErrorKind | "network";

export function PlannerApp() {
  const [stage, setStage] = useState<Stage>("input");
  const [text, setText] = useState("");
  const [constraints, setConstraints] = useState<Constraints | null>(null);
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([]);
  const [parser, setParser] = useState<"llm" | "rules">("rules");
  const [catalogMode, setCatalogMode] = useState<"live" | "mock">("mock");
  const [budgetMode, setBudgetMode] = useState<BudgetMode>("under_budget");
  const [plan, setPlanState] = useState<BasketPlan | null>(null);
  const [history, setHistory] = useState<BasketPlan[]>([]);
  const [busy, setBusy] = useState<null | "parse" | "plan">(null);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedBasket[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Saved baskets come from localStorage, which only exists after hydration.
  useEffect(() => {
    const id = requestAnimationFrame(() => setSaved(listSaved()));
    return () => cancelAnimationFrame(id);
  }, []);

  // Each screen starts at the top (buttons live in a bottom bar, so scroll position would otherwise carry over).
  const planning = busy === "plan";
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stage, planning]);

  /** Every basket change goes through here so Undo always works and changes are announced. */
  const commit = (next: BasketPlan, message?: string) => {
    if (plan) setHistory((h) => [...h.slice(-19), plan]);
    setPlanState(next);
    if (message) toast(message, { variant: "default" });
  };

  async function parse() {
    setBusy("parse");
    setError(null);
    try {
      const res = await fetch("/api/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await res.json();
      if (!res.ok) throw Object.assign(new Error(data.error), { kind: "bad_input" as const });
      setConstraints(data.constraints);
      setQuestions(data.questions);
      setParser(data.parser);
      setCatalogMode(data.catalogMode);
      setStage("review");
    } catch (e) {
      setError((e as { kind?: ErrorKind }).kind ?? "network");
    } finally {
      setBusy(null);
    }
  }

  async function build(c: Constraints = constraints!, mode = budgetMode, missionText = text) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy("plan");
    setError(null);
    setStage("basket");
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission: missionText, constraints: c, budgetMode: mode, parser }),
        signal: ac.signal,
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "tool_error");
      if (plan) setHistory((h) => [...h.slice(-19), plan]);
      setPlanState(data.plan);
      setCatalogMode(data.plan.catalogMode);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        toast("Search cancelled. Your mission is unchanged.");
        setStage(plan ? "basket" : "review");
      } else setError("network");
    } finally {
      if (abortRef.current === ac) setBusy(null);
    }
  }

  const openItem = plan?.items.find((i) => i.slot === openSlot) ?? null;
  const back = () => setStage(stage === "cart" ? "basket" : stage === "basket" ? "review" : "input");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
      <Toast.Provider placement="top" />
      <header className="flex items-center justify-between gap-2 py-3">
        <div className="flex items-center gap-2">
          {stage !== "input" ? (
            <Button isIconOnly size="sm" variant="ghost" aria-label="Back" onPress={back}>
              <ArrowLeft className="size-5" />
            </Button>
          ) : (
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
              <ShoppingBasket aria-hidden className="size-4" />
            </span>
          )}
          <span className="font-semibold">Basket Planner</span>
        </div>
        <Chip size="sm" variant="soft" color={catalogMode === "live" ? "success" : "warning"}>
          {catalogMode === "live" ? "Live Instamart" : "Sample data"} · Prototype
        </Chip>
      </header>

      <main className="flex flex-1 flex-col">
        {error ? (
          <StateView
            kind={error}
            onRetry={() => (stage === "input" ? parse() : build())}
            onEdit={() => {
              setError(null);
              setStage(constraints ? "review" : "input");
            }}
          />
        ) : busy === "plan" ? (
          <>
            <BasketSkeleton label={`Searching Instamart${catalogMode === "mock" ? " (sample data)" : ""} and checking stock…`} />
            <Button variant="ghost" className="mt-4 self-center" onPress={() => abortRef.current?.abort()}>
              Cancel
            </Button>
          </>
        ) : stage === "input" ? (
          <MissionInput value={text} onChange={setText} onSubmit={parse} busy={busy === "parse"} savedCount={saved.length} onSaved={() => setStage("saved")} />
        ) : stage === "review" && constraints ? (
          <ConstraintsReview
            mission={text}
            constraints={constraints}
            questions={questions}
            parser={parser}
            budgetMode={budgetMode}
            busy={busy !== null}
            onChange={setConstraints}
            onBudgetMode={setBudgetMode}
            onEditMission={() => setStage("input")}
            onBuild={() => build()}
          />
        ) : stage === "basket" && plan ? (
          <BasketView
            plan={plan}
            canUndo={history.length > 0}
            busy={busy !== null}
            onPlan={commit}
            onUndo={() => {
              setPlanState(history.at(-1)!);
              setHistory((h) => h.slice(0, -1));
            }}
            onQty={(slot, q) => commit(setQty(plan, slot, q), q <= 0 ? "Item removed" : undefined)}
            onOpenItem={setOpenSlot}
            onEditConstraints={() => {
              setConstraints(plan.constraints);
              setStage("review");
            }}
            onAddHealthier={() => {
              const c = { ...plan.constraints, categories: [...new Set([...plan.constraints.categories, "healthy_snacks"])] };
              setConstraints(c);
              build(c);
            }}
            onReview={() => setStage("cart")}
          />
        ) : stage === "cart" && plan ? (
          <CartPreview
            plan={plan}
            onBack={() => setStage("basket")}
            onSave={(name) => {
              const s = saveBasket(name, plan);
              setSaved(listSaved());
              toast(s ? `Saved “${s.name}”` : "Couldn't save — browser storage is unavailable");
            }}
            onCopy={async () => {
              const list = plan.items.map((i) => `${i.quantity} × ${i.product.name}${i.product.quantityLabel ? ` (${i.product.quantityLabel})` : ""}`).join("\n");
              try {
                await navigator.clipboard.writeText(list);
                toast("Shopping list copied");
              } catch {
                toast("Couldn't access the clipboard");
              }
            }}
          />
        ) : stage === "saved" ? (
          <SavedBaskets
            saved={saved}
            onOpen={(s) => {
              setText(s.plan.mission);
              setConstraints(s.plan.constraints);
              setHistory([]);
              setPlanState(s.plan);
              setStage("basket");
            }}
            onReplan={(s) => {
              setText(s.plan.mission);
              setConstraints(s.plan.constraints);
              setBudgetMode(s.plan.budgetMode);
              build(s.plan.constraints, s.plan.budgetMode, s.plan.mission);
            }}
            onDelete={(id) => {
              deleteSaved(id);
              setSaved(listSaved());
            }}
            onNew={() => setStage("input")}
          />
        ) : (
          <MissionInput value={text} onChange={setText} onSubmit={parse} busy={busy === "parse"} savedCount={saved.length} onSaved={() => setStage("saved")} />
        )}
      </main>

      {stage === "input" && (
        <footer className="py-6 text-center text-xs text-muted">
          Independent prototype, not an official Swiggy or Instamart product. It never places orders or makes payments.
        </footer>
      )}

      {plan && (
        <ItemSheet
          key={openSlot ?? "none"}
          item={openItem}
          onClose={() => setOpenSlot(null)}
          onSwap={(id) => {
            commit(swap(plan, openSlot!, id), "Swapped");
            setOpenSlot(null);
          }}
          onRemove={() => {
            commit(removeItem(plan, openSlot!), "Item removed");
            setOpenSlot(null);
          }}
          onPriority={(pr) => commit(setPriority(plan, openSlot!, pr))}
          onNote={(n) => commit(setNote(plan, openSlot!, n))}
        />
      )}
    </div>
  );
}
