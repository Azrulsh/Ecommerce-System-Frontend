"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/errors";
import { browserAuthLock, browserRequest } from "@/lib/bff/browser-client";
import { useCommerce } from "@/features/cart/components/CommerceProvider";
import { useAdminAccess } from "./components/AdminAccessProvider";
export function useAdminMutation() {
  const commerce = useCommerce();
  const access = useAdminAccess();
  const scope = access.scope;
  const current = useRef("");
  useEffect(() => {
    current.current = access.allowed && !access.checking ? scope : "";
    return () => {
      current.current = "";
    };
  }, [scope, access.allowed, access.checking]);
  const active = useRef(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState("");
  async function run<T>(
    path: string,
    parse: (value: unknown) => T,
    body: unknown,
  ): Promise<T | undefined> {
    if (active.current || blocked) return;
    if (!access.allowed || access.checking || !commerce.session?.user) {
      setError(new ApiError("forbidden", 403));
      return;
    }
    const csrf = commerce.session.csrfToken;
    active.current = true;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const result = await browserAuthLock(async () => {
        if (current.current !== scope)
          throw new ApiError("unauthenticated", 401);
        return browserRequest(path, parse, csrf, body);
      });
      if (current.current !== scope) return;
      setNotice("Saved. The confirmed result is shown below.");
      return result;
    } catch (failure) {
      if (current.current !== scope) return;
      const error =
        failure instanceof ApiError ? failure : new ApiError("network");
      setError(error);
      if (
        [
          "network",
          "timeout",
          "invalid_response",
          "unavailable",
          "http",
        ].includes(error.code)
      )
        setBlocked(true);
      if (error.code === "forbidden") access.refresh();
      if (error.code === "unauthenticated") void commerce.refresh();
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  return { busy, blocked, error, notice, run };
}
