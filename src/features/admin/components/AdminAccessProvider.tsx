"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useCommerce } from "@/features/cart/components/CommerceProvider";
import { useCustomerQuery } from "@/features/auth/use-customer-query";
import { parseAccess } from "../validation";
import type { ApiError } from "@/lib/api/errors";
interface Access {
  allowed: boolean;
  checking: boolean;
  scope: string;
  error: ApiError | null;
  refresh: () => void;
}
const Context = createContext<Access | null>(null);
export function AdminAccessProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const commerce = useCommerce();
  const { refresh: refreshSession } = commerce;
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const query = useCustomerQuery(
    `/api/admin/access?revision=${revision}`,
    parseAccess,
  );
  useEffect(() => {
    if (query.error?.code === "unauthenticated") void refreshSession();
  }, [query.error, refreshSession]);
  const userId = commerce.session?.user?.id;
  return (
    <Context.Provider
      value={{
        scope: `${userId}:${commerce.session?.csrfToken}`,
        allowed:
          !commerce.loading &&
          query.data?.userId === userId &&
          !!query.data?.allowed,
        checking: commerce.loading || (!!userId && query.loading),
        error: query.error,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAdminAccess() {
  const value = useContext(Context);
  if (!value) throw new Error("AdminAccessProvider is required.");
  return value;
}
