const KEY = "sbp.address.v1";

/** The shopper's chosen delivery address id, remembered in this browser. Storage can be blocked, so both calls are guarded. */
export function currentAddressId(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function rememberAddressId(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* not remembered — the first saved address is used */
  }
}
