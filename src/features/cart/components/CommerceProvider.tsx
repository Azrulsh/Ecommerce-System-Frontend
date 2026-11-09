"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiError } from "@/lib/api/errors";
import {
  browserRequest,
  parseMessage,
  browserAuthLock,
} from "@/lib/bff/browser-client";
import { parseBrowserSession } from "@/features/auth/browser-validation";
import type { BrowserSession, Credentials } from "@/features/auth/types";
import {
  acknowledgeImport,
  beginImport,
  emptyGuestCart,
  GUEST_CART_KEY,
  restoreGuestCart,
  updateGuestCart,
} from "../guest-cart";
import { parseAccountCart, parseMergeResult } from "../browser-validation";
import type { AccountCart, GuestCart, MergeResult } from "../types";

interface CommerceContext {
  session: BrowserSession | null;
  loading: boolean;
  busy: boolean;
  guest: GuestCart;
  cart: AccountCart | null;
  notice: string;
  error: string;
  storageAvailable: boolean;
  refresh: () => Promise<void>;
  signIn: (credentials: Credentials, register: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  add: (productId: number, quantity: number) => Promise<void>;
  updateGuest: (productId: number, quantity: number) => Promise<void>;
  updateAccount: (itemId: number, quantity: number) => Promise<void>;
  merge: (acceptCurrent?: number[]) => Promise<MergeResult | null>;
}
const Context = createContext<CommerceContext | null>(null);
const AUTH_EVENT = "everyday.auth-change";

export function CommerceProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<BrowserSession | null>(null);
  const sessionRef = useRef<BrowserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const epoch = useRef(0);
  const [guest, setGuest] = useState<GuestCart>(emptyGuestCart);
  const guestRef = useRef<GuestCart>(emptyGuestCart());
  const [cart, setCart] = useState<AccountCart | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const storageHealthy = useRef(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    const currentEpoch = ++epoch.current;
    return browserAuthLock(() =>
      browserRequest("/api/session", parseBrowserSession),
    )
      .then(async (state) => {
        if (currentEpoch !== epoch.current) return;
        const previousUser = sessionRef.current?.user;
        sessionRef.current = state;
        setSession(state);
        if (previousUser && !state.user)
          setNotice(
            "Your session ended. Sign in again to access your saved account cart.",
          );
        if (state.user) {
          try {
            const accountCart = await browserRequest(
              "/api/cart",
              parseAccountCart,
            );
            if (currentEpoch === epoch.current) setCart(accountCart);
          } catch (failure) {
            if (
              failure instanceof ApiError &&
              failure.code === "unauthenticated"
            )
              throw failure;
            if (currentEpoch === epoch.current)
              setError(
                "Your session is valid, but the account cart could not be loaded. Please retry the cart.",
              );
          }
        }
      })
      .catch((failure) => {
        if (currentEpoch !== epoch.current) return;
        setError(
          failure instanceof ApiError
            ? failure.message
            : "Sign-in is temporarily unavailable. Please retry.",
        );
        sessionRef.current = null;
        setCart(null);
        setSession(null);
      })
      .finally(() => {
        if (currentEpoch === epoch.current) setLoading(false);
      });
  }, []);

  async function retrySession() {
    setLoading(true);
    setCart(null);
    setError("");
    await refresh();
  }

  const changeGuest = useCallback(
    async (
      change: (cart: GuestCart) => GuestCart,
      requireStorage = false,
    ): Promise<GuestCart> => {
      const action = async () => {
        let current = guestRef.current;
        let persistent = true;
        try {
          const restored = storageHealthy.current
            ? restoreGuestCart(localStorage.getItem(GUEST_CART_KEY))
            : { cart: current, corrupted: false };
          current = restored.cart;
          if (restored.corrupted)
            setNotice("Stored guest cart data was invalid and has been reset.");
        } catch {
          persistent = false;
          storageHealthy.current = false;
          setStorageAvailable(false);
        }
        if (requireStorage && !persistent)
          throw new Error(
            "Enable browser storage before importing guest items safely.",
          );
        const next = change(current);
        try {
          localStorage.setItem(GUEST_CART_KEY, JSON.stringify(next));
          storageHealthy.current = true;
          setStorageAvailable(true);
        } catch {
          storageHealthy.current = false;
          setStorageAvailable(false);
          if (requireStorage)
            throw new Error(
              "Could not persist import progress. Enable browser storage and retry.",
            );
          setNotice(
            "Browser storage is unavailable. Your guest cart is kept only in this tab and may be lost on reload.",
          );
        }
        guestRef.current = next;
        setGuest(next);
        return next;
      };
      return navigator.locks
        ? navigator.locks.request("everyday-guest-cart", action)
        : action();
    },
    [],
  );

  useEffect(() => {
    void changeGuest((cart) => cart);
    void refresh();
    const storage = (event: StorageEvent) => {
      if (event.key === GUEST_CART_KEY) {
        const restored = restoreGuestCart(event.newValue);
        guestRef.current = restored.cart;
        setGuest(restored.cart);
      }
      if (event.key === AUTH_EVENT) {
        sessionRef.current = null;
        setCart(null);
        setSession(null);
        setLoading(true);
        void refresh();
      }
    };
    const focus = () => {
      if (!busyRef.current) {
        setLoading(true);
        setCart(null);
        void refresh();
      }
    };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", focus);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", focus);
    };
  }, [changeGuest, refresh]);

  function broadcast() {
    try {
      localStorage.setItem(AUTH_EVENT, crypto.randomUUID());
    } catch {
      /* Auth discovery still revalidates on focus. */
    }
  }
  async function exclusive<T>(action: () => Promise<T>): Promise<T> {
    if (busyRef.current)
      throw new Error("Please wait for the current cart action.");
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      return await action();
    } catch (failure) {
      const message =
        failure instanceof Error
          ? failure.message
          : "This action could not be completed.";
      setError(message);
      if (failure instanceof ApiError && failure.code === "unauthenticated") {
        setCart(null);
        setSession(null);
        setLoading(true);
        await refresh();
      }
      throw failure;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function csrf() {
    if (!sessionRef.current)
      throw new Error("Please retry session discovery first.");
    return sessionRef.current.csrfToken;
  }

  async function signIn(credentials: Credentials, register: boolean) {
    return exclusive(async () => {
      const currentEpoch = ++epoch.current;
      setCart(null);
      const state = await browserAuthLock(async () => {
        const fresh = await browserRequest("/api/session", parseBrowserSession);
        return browserRequest(
          register ? "/api/auth/register" : "/api/auth/login",
          parseBrowserSession,
          fresh.csrfToken,
          credentials,
        );
      });
      if (currentEpoch !== epoch.current)
        throw new Error(
          "The session changed. Please review your account state.",
        );
      sessionRef.current = state;
      setSession(state);
      broadcast();
      try {
        const accountCart = await browserRequest("/api/cart", parseAccountCart);
        if (currentEpoch === epoch.current) setCart(accountCart);
      } catch (failure) {
        if (failure instanceof ApiError && failure.code === "unauthenticated")
          throw failure;
        if (currentEpoch === epoch.current)
          setError(
            "You are signed in, but the saved account cart is temporarily unavailable. Please retry it.",
          );
      }
      if (currentEpoch !== epoch.current)
        throw new Error(
          "The session changed. Please review your account state.",
        );
      setNotice(
        state.warning ??
          "You are signed in. Review any guest items before importing them.",
      );
      return guestRef.current.items.length > 0 || !!guestRef.current.pending;
    });
  }
  async function logout() {
    if (
      guestRef.current.items.length &&
      !window.confirm(
        "Signing out will clear the unimported guest items on this browser. Your account cart stays saved. Continue?",
      )
    )
      return;
    return exclusive(async () => {
      ++epoch.current;
      setCart(null);
      setSession(null);
      let message: string;
      try {
        message = await browserAuthLock(() =>
          browserRequest("/api/auth/logout", parseMessage, csrf(), {}),
        );
      } catch (failure) {
        if (failure instanceof ApiError && failure.code === "unauthenticated")
          message = "Your session has ended.";
        else throw failure;
      }
      await changeGuest(() => emptyGuestCart());
      sessionRef.current = null;
      broadcast();
      await refresh();
      setNotice(message);
    });
  }
  async function add(productId: number, quantity: number) {
    return exclusive(async () => {
      if (!session || loading)
        throw new Error(
          "Please retry session discovery before adding products.",
        );
      if (session.user) {
        if (guestRef.current.pending)
          throw new Error("Finish reviewing the pending guest import first.");
        const currentEpoch = epoch.current;
        const accountCart = await browserRequest(
          "/api/cart",
          parseAccountCart,
          csrf(),
          {
            action: "add",
            productId,
            quantity,
            operationId: crypto.randomUUID(),
          },
        );
        if (currentEpoch === epoch.current) setCart(accountCart);
      } else
        await changeGuest((cart) =>
          updateGuestCart(cart, productId, quantity, true),
        );
      setNotice("Added to your cart. Inventory is not reserved.");
    });
  }
  async function updateGuest(productId: number, quantity: number) {
    return exclusive(async () => {
      await changeGuest((cart) => updateGuestCart(cart, productId, quantity));
      setNotice("Guest cart updated.");
    });
  }
  async function updateAccount(itemId: number, quantity: number) {
    return exclusive(async () => {
      const currentEpoch = epoch.current;
      const accountCart = await browserRequest(
        "/api/cart",
        parseAccountCart,
        csrf(),
        {
          action: quantity === 0 ? "remove" : "set",
          itemId,
          quantity,
          operationId: crypto.randomUUID(),
        },
      );
      if (currentEpoch === epoch.current) setCart(accountCart);
      setNotice("Account cart updated.");
    });
  }
  async function merge(acceptCurrent: number[] = []) {
    return exclusive(async () => {
      if (!sessionRef.current?.user)
        throw new Error("Sign in before importing guest items.");
      const currentEpoch = epoch.current;
      let snapshot = await changeGuest(
        (cart) => beginImport(cart, crypto.randomUUID()),
        true,
      );
      if (!snapshot.pending) return null;
      let result: MergeResult;
      let first = true;
      do {
        result = await browserRequest(
          "/api/cart/merge",
          parseMergeResult,
          csrf(),
          {
            confirm: true,
            batch: snapshot.pending,
            acceptCurrent,
            retryFailures: first,
          },
        );
        first = false;
        if (currentEpoch !== epoch.current)
          throw new Error(
            "The session changed. Review the guest import after signing in again.",
          );
        setCart(result.cart);
        const confirmed = result.items.filter(
          (line) => line.state === "confirmed",
        );
        const unresolved = result.items.some((line) =>
          ["pending", "intent", "uncertain", "conflict"].includes(line.state),
        );
        snapshot = await changeGuest(
          (cart) => acknowledgeImport(cart, confirmed, unresolved),
          true,
        );
      } while (result.items.some((line) => line.state === "pending"));
      const incomplete = result.items.some(
        (line) => line.state !== "confirmed",
      );
      setNotice(
        incomplete
          ? "Some guest items need attention. Untransferred items have been kept."
          : "Guest items synchronized. Your account cart is saved.",
      );
      return result;
    });
  }
  return (
    <Context.Provider
      value={{
        session,
        loading,
        busy,
        guest,
        cart,
        notice,
        error,
        storageAvailable,
        refresh: retrySession,
        signIn,
        logout,
        add,
        updateGuest,
        updateAccount,
        merge,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCommerce() {
  const value = useContext(Context);
  if (!value) throw new Error("CommerceProvider is required.");
  return value;
}
