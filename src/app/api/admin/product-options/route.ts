import type { NextRequest } from "next/server";
import { withAdminSession } from "@/features/admin/server/access";
import { adminApi } from "@/features/admin/server/api";
import { endpoint, privateJson } from "@/lib/bff/response";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return endpoint(() =>
    withAdminSession(request, false, async (context) =>
      privateJson({ data: await adminApi(context.session.token!).options() }),
    ),
  );
}
