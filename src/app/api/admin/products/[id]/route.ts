import type { NextRequest } from "next/server";
import { withAdminSession } from "@/features/admin/server/access";
import { adminApi } from "@/features/admin/server/api";
import { productInput } from "@/features/admin/validation";
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
        data: await adminApi(context.session.token!).product(
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
      const { action, ...fields } = await readJsonObject(request, 64_000);
      input(action === "update" || action === "delete");
      const body = action === "update" ? productInput(fields, true) : null;
      if (!body) input(Object.keys(fields).length === 0);
      return context.store.withLock(`admin-product:${id}`, async () => {
        const api = adminApi(context.session.token!);
        if (body)
          return privateJson({ data: await api.updateProduct(id, body) });
        await api.deleteProduct(id);
        return privateJson({
          message:
            "Product deleted from the catalog. Purchase history is retained.",
        });
      });
    }),
  );
}
