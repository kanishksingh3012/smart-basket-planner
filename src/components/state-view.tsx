"use client";

import { Button } from "@heroui/react";
import { Clock, KeyRound, SearchX, ShieldAlert, WifiOff } from "lucide-react";
import type { CatalogErrorKind } from "@/lib/types";

const COPY: Record<CatalogErrorKind | "network", { icon: typeof Clock; title: string; body: string }> = {
  timeout: { icon: Clock, title: "Instamart search timed out", body: "Try fewer constraints or search again." },
  rate_limited: { icon: Clock, title: "Too many searches right now", body: "Instamart asked us to slow down. Wait a few seconds, then try again." },
  auth_required: {
    icon: KeyRound,
    title: "Connect your Swiggy account",
    body: "Live search needs a Swiggy login. Run `npm run swiggy:login` on the server, or switch to sample data (CATALOG_MODE=mock).",
  },
  tool_error: { icon: ShieldAlert, title: "Instamart returned an error", body: "Nothing was changed. You can try again or edit your mission." },
  bad_input: { icon: SearchX, title: "That request didn't work", body: "Try describing your mission a little differently." },
  blocked: { icon: ShieldAlert, title: "Action blocked", body: "This prototype only reads from Instamart. Cart, checkout and payment are disabled." },
  network: { icon: WifiOff, title: "You seem to be offline", body: "Check your connection and try again." },
};

export function StateView({ kind, onRetry, onEdit }: { kind: CatalogErrorKind | "network"; onRetry: () => void; onEdit: () => void }) {
  const { icon: Icon, title, body } = COPY[kind];
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-surface-secondary">
        <Icon aria-hidden className="size-6 text-muted" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-xs text-sm text-ink-soft">{body}</p>
      <div className="mt-2 flex gap-2">
        {kind !== "blocked" && kind !== "auth_required" && <Button onPress={onRetry}>Try again</Button>}
        <Button variant="secondary" onPress={onEdit}>
          Edit mission
        </Button>
      </div>
    </div>
  );
}

export function BasketSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-1 flex-col gap-3 pt-2">
      <p className="text-sm text-muted">{label}</p>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-3 rounded-2xl border border-border bg-surface p-3">
          <div className="size-14 animate-pulse rounded-xl bg-surface-secondary" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-surface-secondary" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface-secondary" />
            <div className="h-3 w-full animate-pulse rounded bg-surface-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}
