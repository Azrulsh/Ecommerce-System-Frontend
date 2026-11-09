"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useCommerce } from "@/features/cart/components/CommerceProvider";
import { useCustomerQuery } from "@/features/auth/use-customer-query";
import { browserAuthLock, browserRequest } from "@/lib/bff/browser-client";
import { ApiError } from "@/lib/api/errors";
import { integer, object } from "@/lib/validation";
import { parseWishlistItem, parseWishlistPage } from "../validation";

interface WishlistContext {
  count: number | null;
  busy: boolean;
  revision: number;
  membership: (productId: number) => boolean | undefined;
  mutate: (productId: number, save: boolean) => Promise<void>;
  refresh: () => void;
}
const Context = createContext<WishlistContext | null>(null);
const EVENT = "everyday.wishlist-change";
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const commerce = useCommerce();
  const key = commerce.loading
    ? ""
    : `${commerce.session?.user?.id ?? ""}:${commerce.session?.csrfToken ?? ""}`;
  const current = useRef(key);
  useEffect(() => {
    current.current = key;
    return () => {
      current.current = "";
    };
  }, [key]);
  const [revision, setRevision] = useState(0);
  const [known, setKnown] = useState<{
    key: string;
    values: Record<number, boolean>;
  }>({ key: "", values: {} });
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // One bounded page, never a per-card request or an unbounded wishlist scan.
  const query = useCustomerQuery(
    `/api/wishlist?page=1&revision=${revision}`,
    parseWishlistPage,
  );
  useEffect(() => {
    const invalidate = () => {
      setKnown({ key: "", values: {} });
      setRevision((value) => value + 1);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === EVENT) invalidate();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", invalidate);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", invalidate);
    };
  }, []);
  function refresh() {
    setKnown({ key: "", values: {} });
    setRevision((value) => value + 1);
  }
  function membership(productId: number) {
    if (!key || !commerce.session?.user) return undefined;
    if (known.key === key && productId in known.values)
      return known.values[productId];
    if (!query.data) return undefined;
    if (query.data.data.some((item) => item.product_id === productId))
      return true;
    return query.data.meta.total === query.data.data.length ? false : undefined;
  }
  async function mutate(productId: number, save: boolean) {
    if (inFlight.current) throw new ApiError("conflict", 409);
    if (!commerce.session?.user || !key)
      throw new ApiError("unauthenticated", 401);
    const csrf = commerce.session.csrfToken;
    inFlight.current = true;
    setBusy(true);
    try {
      await browserAuthLock(async () => {
        if (current.current !== key) throw new ApiError("unauthenticated", 401);
        await browserRequest(
          "/api/wishlist",
          (value) => {
            const data = object(value);
            const returnedId = save
              ? parseWishlistItem(data.item).product_id
              : integer(data.removed, 1);
            if (returnedId !== productId)
              throw new ApiError("invalid_response");
          },
          csrf,
          { action: save ? "save" : "remove", productId },
        );
      });
      if (current.current !== key) throw new ApiError("unauthenticated", 401);
      setKnown((previous) => ({
        key,
        values: {
          ...(previous.key === key ? previous.values : {}),
          [productId]: save,
        },
      }));
      setRevision((value) => value + 1);
      try {
        localStorage.setItem(EVENT, crypto.randomUUID());
      } catch {
        /* Focus refresh works without storage. */
      }
    } catch (error) {
      if (current.current === key) refresh();
      if (
        current.current === key &&
        error instanceof ApiError &&
        error.code === "unauthenticated"
      )
        void commerce.refresh();
      throw error;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <Context.Provider
      value={{
        count:
          key && commerce.session?.user
            ? (query.data?.meta.total ?? null)
            : null,
        busy: busy || (!!commerce.session?.user && query.loading),
        revision,
        membership,
        mutate,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWishlist() {
  const context = useContext(Context);
  if (!context) throw new Error("WishlistProvider is required.");
  return context;
}
