import type { NextRequest } from "next/server";
import { withAdminSession } from "@/features/admin/server/access";
import { adminApi } from "@/features/admin/server/api";
import { discountInput } from "@/features/admin/validation";
import { resourceId } from "@/lib/api/pagination";
import { endpoint, privateJson } from "@/lib/bff/response";
import { readJsonObject } from "@/lib/bff/security";
import { input } from "@/lib/validation";
export const runtime = "nodejs";
type Route = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, route: Route) {
  return endpoint(() =>
    withAdminSession(request, false, async (context) =>
      privateJson({
        data: await adminApi(context.session.token!).discount(
          resourceId((await route.params).id),
        ),
      }),
    ),
  );
}
export async function POST(request: NextRequest, route: Route) {
  return endpoint(() =>
    withAdminSession(request, true, async (context) => {
      const id = resourceId((await route.params).id);
      const { action, ...fields } = await readJsonObject(request);
      input(action === "update" || action === "deactivate");
      const body = action === "update" ? discountInput(fields) : null;
      if (!body) input(Object.keys(fields).length === 0);
      return context.store.withLock(`admin-discount:${id}`, async () => {
        const api = adminApi(context.session.token!);
        if (body)
          return privateJson({ data: await api.updateDiscount(id, body) });
        await api.deactivateDiscount(id);
        return privateJson({
          message: "Discount deactivated. Assignments are retained.",
        });
      });
    }),
  );
}
