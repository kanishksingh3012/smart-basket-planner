"use client";

import { Button, Drawer } from "@heroui/react";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { useState } from "react";

type Address = { id: string; label: string };
type Props = { addresses: Address[]; value?: string; onChange: (id: string) => void };

/** Delivery address chooser. Shows labels only ("Home", "Work"), never the address line or phone number. */
export function AddressPicker({ addresses, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = addresses.find((a) => a.id === value) ?? addresses[0];
  if (!current) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="mb-2 flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="flex items-center gap-2 text-muted">
          <MapPin aria-hidden className="size-4" /> Deliver to
        </span>
        <span className="flex min-w-0 items-center gap-1 font-medium">
          <span className="truncate">{current.label}</span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted" />
        </span>
      </button>
      <Drawer>
        <Drawer.Backdrop isOpen={open} onOpenChange={setOpen}>
          <Drawer.Content placement="bottom">
            <Drawer.Dialog className="max-h-[80dvh]">
              <Drawer.Header>
                <Drawer.Heading>Deliver to</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body className="space-y-3">
                <p className="text-sm text-muted">Stock and prices depend on the address, so we search the store that delivers there.</p>
                <ul className="space-y-2">
                  {addresses.map((a) => {
                    const selected = a.id === current.id;
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            onChange(a.id);
                            setOpen(false);
                          }}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${selected ? "border-accent bg-accent-soft font-semibold" : "border-border bg-surface hover:bg-surface-secondary"}`}
                        >
                          <span className="truncate">{a.label}</span>
                          {selected && <Check aria-hidden className="size-5 shrink-0 text-accent" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Drawer.Body>
              <Drawer.Footer>
                <Button slot="close" variant="tertiary">
                  Close
                </Button>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </>
  );
}
