import type { NextRequest } from "next/server";
import { withAdminSession } from "@/features/admin/server/access";
import { adminApi } from "@/features/admin/server/api";
import { discountInput } from "@/features/admin/validation";
import { pageNumber } from "@/lib/api/pagination";
import { endpoint, privateJson } from "@/lib/bff/response";
import { readJsonObject } from "@/lib/bff/security";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return endpoint(() =>
    withAdminSession(request, false, async (context) =>
      privateJson(
        await adminApi(context.session.token!).discounts(
          pageNumber(request.nextUrl.searchParams.get("page")),
        ),
      ),
    ),
  );
}
export async function POST(request: NextRequest) {
  return endpoint(() =>
    withAdminSession(request, true, async (context) =>
      privateJson(
        {
          data: await adminApi(context.session.token!).createDiscount(
            discountInput(await readJsonObject(request)),
          ),
        },
        201,
      ),
    ),
  );
}
