"use client";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/errors";
import { browserRequest } from "@/lib/bff/browser-client";
import { useAdminAccess } from "./components/AdminAccessProvider";
// Retain drafts during same-session permission checks. AdminFrame hides this data
// while checking; scope changes immediately discard its visible result.
export function useAdminQuery<T>(path: string, parse: (value: unknown) => T) {
  const { scope, allowed, checking, refresh: refreshAccess } = useAdminAccess();
  const [version, setVersion] = useState(0);
  const key = `${scope}:${path}:${version}`;
  const [result, setResult] = useState<{
    key: string;
    data?: T;
    error?: ApiError;
  } | null>(null);
  useEffect(() => {
    if (!allowed || checking) return;
    let live = true;
    void browserRequest(path, parse).then(
      (data) => {
        if (live) setResult({ key, data });
      },
      (failure: unknown) => {
        if (live) {
          const error =
            failure instanceof ApiError ? failure : new ApiError("network");
          setResult({ key, error });
          if (error.code === "forbidden" || error.code === "unauthenticated")
            refreshAccess();
        }
      },
    );
    return () => {
      live = false;
    };
  }, [path, parse, key, allowed, checking, refreshAccess]);
  const current = result?.key === key ? result : null;
  return {
    key,
    data: current?.data,
    error: current?.error,
    loading: !current,
    reload: () => setVersion((value) => value + 1),
    accept: (data: T) => setResult({ key, data }),
  };
}
