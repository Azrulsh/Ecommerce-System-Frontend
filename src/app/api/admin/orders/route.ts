import type { NextRequest } from "next/server";
import { withAdminSession } from "@/features/admin/server/access";
import { adminApi } from "@/features/admin/server/api";
import { dateFilters } from "@/features/admin/validation";
import { pageNumber } from "@/lib/api/pagination";
import { endpoint, privateJson } from "@/lib/bff/response";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return endpoint(() =>
    withAdminSession(request, false, async (context) =>
      privateJson(
        await adminApi(context.session.token!).orders(
          pageNumber(request.nextUrl.searchParams.get("page")),
          dateFilters(request.nextUrl.searchParams, true),
        ),
      ),
    ),
  );
}
