import "server-only";
import type { NextRequest } from "next/server";
import {
  withBrowserSession,
  type SessionContext,
} from "@/features/auth/server/session";
import { apiRequest } from "@/lib/api/client";
import { parseCategoryPage } from "../validation";
// This endpoint is guarded by EnsureAdmin before binding; the user resource has no role.
export async function verifyAdmin(token: string) {
  await apiRequest("admin/categories?per_page=1&page=1", parseCategoryPage, {
    token,
  });
}
export function withAdminSession<T>(
  request: NextRequest,
  mutate: boolean,
  action: (context: SessionContext) => Promise<T>,
) {
  return withBrowserSession(request, true, mutate, async (context) => {
    await verifyAdmin(context.session.token!);
    return action(context);
  });
}
