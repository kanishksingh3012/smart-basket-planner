"use client";

import { Button, Drawer, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { inr, PRIORITY_LABEL } from "@/lib/format";
import type { BasketItem, Priority, Product } from "@/lib/types";
import { AvailabilityChip, ProductThumb } from "./item-card";

type Props = {
  item: BasketItem | null;
  onClose: () => void;
  onSwap: (productId: string) => void;
  onRemove: () => void;
  onPriority: (p: Priority) => void;
  onNote: (note: string) => void;
};

/** Plain-language comparison against the current pick — only from returned data. */
function compare(alt: Product, cur: Product): string {
  const bits: string[] = [];
  if (alt.price !== undefined && cur.price !== undefined && alt.price !== cur.price)
    bits.push(alt.price < cur.price ? `${inr(cur.price - alt.price)} cheaper` : `${inr(alt.price - cur.price)} more`);
  if (alt.availability !== cur.availability && alt.availability === "available") bits.push("in stock");
  if (alt.brand && alt.brand !== cur.brand) bits.push(alt.brand);
  if (alt.quantityLabel && alt.quantityLabel !== cur.quantityLabel) bits.push(alt.quantityLabel);
  if (alt.rating !== undefined) bits.push(`${alt.rating}★`);
  return bits.join(" · ");
}

export function ItemSheet({ item, onClose, onSwap, onRemove, onPriority, onNote }: Props) {
  // Parent remounts this sheet per item (key), so the note initialises from props.
  const [note, setNote] = useState(item?.note ?? "");
  const p = item?.product;
  return (
    <Drawer>
      <Drawer.Backdrop
        isOpen={Boolean(item)}
        onOpenChange={(open) => {
          if (!open) {
            if (item && note !== (item.note ?? "")) onNote(note);
            onClose();
          }
        }}
      >
        <Drawer.Content placement="bottom">
          <Drawer.Dialog className="max-h-[88dvh]">
            {item && p && (
              <>
                <Drawer.Header>
                  <Drawer.Heading>{item.slot}</Drawer.Heading>
                </Drawer.Header>
                <Drawer.Body className="space-y-5">
                  <section className="flex gap-3" aria-label="Current pick">
                    <ProductThumb src={p.imageUrl} name={p.name} size={72} />
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-sm text-muted">{[p.brand, p.quantityLabel].filter(Boolean).join(" · ")}</p>
                      <p className="text-sm tabular">
                        {inr(p.price)}
                        {p.mrp !== undefined && p.price !== undefined && p.mrp > p.price && (
                          <span className="ml-2 text-muted line-through">{inr(p.mrp)}</span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <AvailabilityChip a={p.availability} />
                      </div>
                      <p className="text-xs text-muted">
                        {p.veg === true ? "Marked vegetarian by Instamart" : p.veg === false ? "Not vegetarian" : "No veg/non-veg label returned"}
                        {p.rating !== undefined ? ` · Rated ${p.rating}★` : ""}
                      </p>
                    </div>
                  </section>

                  <section>
                    <p className="mb-1 text-sm font-medium">Why it&apos;s here</p>
                    <p className="text-sm text-ink-soft">{item.reason}</p>
                  </section>

                  <section>
                    <p className="mb-2 text-sm font-medium" id="prio-label">
                      Priority
                    </p>
                    <ToggleButtonGroup
                      aria-labelledby="prio-label"
                      className="w-full"
                      size="sm"
                      selectionMode="single"
                      selectedKeys={[item.priority]}
                      onSelectionChange={(keys) => {
                        const k = [...keys][0] as Priority | undefined;
                        if (k) onPriority(k);
                      }}
                    >
                      {(["must_have", "recommended", "optional"] as const).map((k) => (
                        <ToggleButton key={k} id={k} className="flex-1">
                          {PRIORITY_LABEL[k]}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </section>

                  <section>
                    <p className="mb-2 text-sm font-medium">Substitutes</p>
                    {item.alternatives.length === 0 ? (
                      <p className="text-sm text-muted">No other matching products were returned for this search.</p>
                    ) : (
                      <ul className="space-y-2">
                        {item.alternatives.map((a) => (
                          <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border p-2">
                            <ProductThumb src={a.imageUrl} name={a.name} size={44} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{a.name}</p>
                              <p className="truncate text-xs text-muted">{compare(a, p) || inr(a.price)}</p>
                              {a.availability !== "available" && <AvailabilityChip a={a.availability} />}
                            </div>
                            <Button size="sm" variant="secondary" isDisabled={a.availability === "unavailable"} onPress={() => onSwap(a.id)}>
                              Use this
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section>
                    <label htmlFor="item-note" className="mb-1 block text-sm font-medium">
                      Note for this item
                    </label>
                    <input
                      id="item-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. less spicy if possible"
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    />
                  </section>
                </Drawer.Body>
                <Drawer.Footer className="justify-between">
                  <Button variant="danger" size="sm" onPress={onRemove}>
                    <Trash2 className="size-4" /> Remove
                  </Button>
                  <Button slot="close">Done</Button>
                </Drawer.Footer>
              </>
            )}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
