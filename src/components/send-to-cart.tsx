"use client";

import { Alert, Button, Drawer, Spinner } from "@heroui/react";
import { Lock, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { currentAddressId } from "@/lib/address";
import type { BasketPlan } from "@/lib/types";

type Status = { live: boolean; writeEnabled?: boolean; addresses?: { id: string; label: string }[]; cartCount?: number; error?: string };
type Result = { address: string; count: number; total?: string; removed: string[]; reduced: string[] };

/** The one consequential action in the app: fill the Instamart cart, only after an explicit confirmation. */
export function SendToCart({ plan }: { plan: BasketPlan }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<null | "add" | "replace">(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const live = plan.catalogMode === "live";
  const sendable = plan.items.filter((i) => i.product.source === "instamart-mcp" && i.product.spinId && i.product.availability !== "unavailable");
  const skipped = plan.items.length - sendable.length;
  const addressId = currentAddressId();
  const address = status?.addresses?.find((a) => a.id === addressId) ?? status?.addresses?.[0];

  async function start() {
    setOpen(true);
    setResult(null);
    setError("");
    setStatus(null);
    try {
      setStatus(await (await fetch("/api/cart")).json());
    } catch {
      setStatus({ live: true, error: "network" });
    }
  }

  async function send(mode: "add" | "replace") {
    setBusy(mode);
    setError("");
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: address?.id,
          mode,
          confirm: true,
          items: sendable.map((i) => ({ spinId: i.product.spinId, skuId: i.product.id, quantity: i.quantity, name: i.product.name })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "We couldn't confirm the update. Please check your cart in Swiggy before trying again.");
    } finally {
      setBusy(null);
    }
  }

  if (!live)
    return (
      <>
        <Button className="w-full" size="lg" isDisabled aria-describedby="send-note">
          <Lock className="size-4" /> Send to Instamart cart
        </Button>
        <p id="send-note" className="-mt-2 text-center text-xs text-muted">
          This basket uses sample products, so it can&apos;t be sent. Connect Swiggy and run in live mode to send a real one.
        </p>
      </>
    );

  const hasCart = (status?.cartCount ?? 0) > 0;
  return (
    <>
      <Button className="w-full" size="lg" onPress={start} isDisabled={sendable.length === 0}>
        <ShoppingCart className="size-4" /> Send to Instamart cart
      </Button>
      <p className="-mt-2 text-center text-xs text-muted">You&apos;ll confirm first. Nothing is ordered until you check out in Swiggy.</p>
      <Drawer>
        <Drawer.Backdrop isOpen={open} onOpenChange={(o) => !busy && setOpen(o)}>
          <Drawer.Content placement="bottom">
            <Drawer.Dialog className="max-h-[88dvh]">
              <Drawer.Header>
                <Drawer.Heading>{result ? "Added to your Instamart cart" : "Send to your Instamart cart?"}</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body className="space-y-4">
                {!status ? (
                  <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
                    <Spinner size="sm" /> Checking your Instamart cart…
                  </p>
                ) : status.error ? (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>
                        {status.error === "auth_required" ? "Your Swiggy login has expired. Run npm run swiggy:login again." : "Couldn't reach your Instamart cart. Nothing was sent."}
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                ) : result ? (
                  <>
                    <p className="text-sm">
                      Your cart for <b>{result.address}</b> now has <b>{result.count} items</b>
                      {result.total ? (
                        <>
                          {" "}
                          and Swiggy&apos;s total is <b className="tabular">₹{result.total}</b>
                        </>
                      ) : null}
                      .
                    </p>
                    {result.removed.length > 0 && <p className="text-sm text-warning">Swiggy left out (out of stock): {result.removed.join(", ")}.</p>}
                    {result.reduced.length > 0 && <p className="text-sm text-warning">Swiggy reduced: {result.reduced.join("; ")}.</p>}
                    <p className="text-sm text-ink-soft">Open the Swiggy app to review and check out. Nothing is ordered until you do.</p>
                  </>
                ) : (
                  <>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted">Deliver to</dt>
                        <dd className="font-medium">{address?.label ?? "Your saved address"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">Sending</dt>
                        <dd className="font-medium">{sendable.reduce((n, i) => n + i.quantity, 0)} items</dd>
                      </div>
                    </dl>
                    {skipped > 0 && <p className="text-sm text-warning">{skipped} item(s) won&apos;t be sent because they&apos;re out of stock.</p>}
                    {hasCart && (
                      <Alert status="warning">
                        <Alert.Indicator />
                        <Alert.Content>
                          <Alert.Title>Your Instamart cart already has {status.cartCount} items</Alert.Title>
                          <Alert.Description>Add this basket to them, or replace the cart with this basket.</Alert.Description>
                        </Alert.Content>
                      </Alert>
                    )}
                    {!status.writeEnabled && <p className="text-sm text-muted">Sending to cart is turned off on this server.</p>}
                    {error && (
                      <p role="alert" className="text-sm text-danger">
                        {error}
                      </p>
                    )}
                    <p className="text-xs text-muted">This only fills your cart. It never checks out or pays.</p>
                  </>
                )}
              </Drawer.Body>
              <Drawer.Footer className="flex-wrap justify-end gap-2">
                {result || status?.error || !status ? (
                  <Button slot="close">Close</Button>
                ) : (
                  <>
                    <Button slot="close" variant="tertiary" isDisabled={Boolean(busy)}>
                      Cancel
                    </Button>
                    {hasCart && (
                      <Button variant="secondary" isDisabled={Boolean(busy) || !status.writeEnabled} onPress={() => send("replace")}>
                        {busy === "replace" && <Spinner size="sm" color="current" />} Replace my cart
                      </Button>
                    )}
                    <Button isDisabled={Boolean(busy) || !status.writeEnabled} onPress={() => send("add")}>
                      {busy === "add" && <Spinner size="sm" color="current" />} {hasCart ? "Add to my cart" : "Send to my cart"}
                    </Button>
                  </>
                )}
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </>
  );
}
