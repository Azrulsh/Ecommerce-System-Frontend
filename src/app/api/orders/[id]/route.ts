import type { NextRequest } from "next/server";
import { withBrowserSession } from "@/features/auth/server/session";
import { ordersApi } from "@/features/orders/server/api";
import { orderId } from "@/features/orders/validation";
import { endpoint, privateJson } from "@/lib/bff/response";
export const runtime = "nodejs";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(() =>
    withBrowserSession(request, true, false, async (context) =>
      privateJson({
        data: await ordersApi(context.session.token!).get(
          orderId((await params).id),
        ),
      }),
    ),
  );
}
