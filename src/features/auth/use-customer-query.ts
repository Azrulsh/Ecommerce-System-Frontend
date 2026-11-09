"use client";
import { useEffect, useState } from "react";
import { useCommerce } from "@/features/cart/components/CommerceProvider";
import { browserRequest } from "@/lib/bff/browser-client";
import { ApiError } from "@/lib/api/errors";

// Private responses are visible only for the identity, session and URL that requested them.
export function useCustomerQuery<T>(
  path: string,
  parse: (value: unknown) => T,
) {
  const { session, loading: discovering } = useCommerce();
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data: T | null;
    error: ApiError | null;
  } | null>(null);
  const userId = session?.user?.id;
  const key = `${userId}:${session?.csrfToken}:${path}:${version}`;
  useEffect(() => {
    if (!userId || discovering) return;
    let live = true;
    void browserRequest(path, parse).then(
      (data) => {
        if (live) setResult({ key, data, error: null });
      },
      (failure) => {
        if (live)
          setResult({
            key,
            data: null,
            error:
              failure instanceof ApiError ? failure : new ApiError("network"),
          });
      },
    );
    return () => {
      live = false;
    };
  }, [path, parse, key, userId, discovering]);
  const current = !discovering && result?.key === key ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: !current,
    reload: () => setVersion((version) => version + 1),
    accept: (data: T) => setResult({ key, data, error: null }),
  };
}
