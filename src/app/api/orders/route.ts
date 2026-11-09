import type { NextRequest } from "next/server";
import { withBrowserSession } from "@/features/auth/server/session";
import { ordersApi } from "@/features/orders/server/api";
import { orderPageNumber } from "@/features/orders/validation";
import { endpoint, privateJson } from "@/lib/bff/response";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return endpoint(() =>
    withBrowserSession(request, true, false, async (context) =>
      privateJson(
        await ordersApi(context.session.token!).list(
          orderPageNumber(request.nextUrl.searchParams.get("page")),
        ),
      ),
    ),
  );
}
