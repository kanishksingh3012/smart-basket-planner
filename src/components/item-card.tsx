"use client";

import { Button, Chip } from "@heroui/react";
import { ChevronRight, Minus, Plus, ShoppingBasket } from "lucide-react";
import { AVAILABILITY, inr } from "@/lib/format";
import type { BasketItem } from "@/lib/types";

export function ProductThumb({ src, name, size = 56 }: { src?: string; name: string; size?: number }) {
  return (
    <div className="grid shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-secondary" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote catalogue images, unknown hosts
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <ShoppingBasket aria-hidden className="size-6 text-muted" />
      )}
      <span className="sr-only">{name}</span>
    </div>
  );
}

export function AvailabilityChip({ a }: { a: BasketItem["product"]["availability"] }) {
  const { label, color } = AVAILABILITY[a];
  return (
    <Chip size="sm" color={color} variant="soft">
      {label}
    </Chip>
  );
}

type Props = {
  item: BasketItem;
  onQty: (q: number) => void;
  onOpen: () => void;
};

/** One basket line: what, why, stock, price, quantity. Details & swaps open in a sheet. */
export function ItemCard({ item, onQty, onOpen }: Props) {
  const p = item.product;
  const unavailable = p.availability === "unavailable";
  return (
    <li className={`rounded-2xl border border-border bg-surface p-3 ${unavailable ? "border-danger/40" : ""}`}>
      <div className="flex gap-3">
        <ProductThumb src={p.imageUrl} name={p.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{item.slot}</p>
              <p className="truncate font-semibold leading-snug">{p.name}</p>
              <p className="text-sm text-muted">
                {[p.brand, p.quantityLabel].filter(Boolean).join(" · ") || "Pack size not available"}
              </p>
            </div>
            <div className="text-right tabular">
              <p className="font-semibold">{p.price === undefined ? "N/A" : inr(p.price * item.quantity)}</p>
              {p.price !== undefined && item.quantity > 1 && <p className="text-xs text-muted">{inr(p.price)} each</p>}
              {p.price === undefined && <p className="text-xs text-muted">Price not available</p>}
            </div>
          </div>
          <p className="mt-2 text-sm text-ink-soft">{item.reason}</p>
          {item.note && <p className="mt-1 text-sm italic text-muted">Note: {item.note}</p>}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <AvailabilityChip a={p.availability} />
          {p.deliveryPromiseMinutes !== undefined && (
            <Chip size="sm" variant="soft">
              ~{p.deliveryPromiseMinutes} min
            </Chip>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center rounded-full border border-border" role="group" aria-label={`Quantity of ${p.name}`}>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Decrease quantity" onPress={() => onQty(item.quantity - 1)}>
              <Minus className="size-4" />
            </Button>
            <span className="w-6 text-center text-sm font-semibold tabular" aria-live="polite">
              {item.quantity}
            </span>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Increase quantity" onPress={() => onQty(item.quantity + 1)}>
              <Plus className="size-4" />
            </Button>
          </div>
          <Button size="sm" variant={unavailable ? "primary" : "tertiary"} onPress={onOpen} aria-label={`Details and swaps for ${p.name}`}>
            {unavailable ? "Swap" : "Edit"}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}
