import type { NextRequest } from "next/server";
import { withAdminSession } from "@/features/admin/server/access";
import { adminApi } from "@/features/admin/server/api";
import { statusInput } from "@/features/admin/validation";
import { resourceId } from "@/lib/api/pagination";
import { endpoint, privateJson } from "@/lib/bff/response";
import { readJsonObject } from "@/lib/bff/security";
export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  route: { params: Promise<{ id: string }> },
) {
  return endpoint(() =>
    withAdminSession(request, true, async (context) => {
      const id = resourceId((await route.params).id);
      const body = statusInput(await readJsonObject(request));
      return context.store.withLock(`admin-order:${id}`, async () =>
        privateJson({
          data: await adminApi(context.session.token!).status(id, body),
        }),
      );
    }),
  );
}
