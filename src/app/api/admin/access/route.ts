import type { NextRequest } from "next/server";
import { withAdminSession } from "@/features/admin/server/access";
import { endpoint, privateJson } from "@/lib/bff/response";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return endpoint(() =>
    withAdminSession(request, false, async (context) =>
      privateJson({ allowed: true, userId: context.user!.id }),
    ),
  );
}
