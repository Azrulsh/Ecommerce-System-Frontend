import type { NextRequest } from "next/server";
import { withAdminSession } from "@/features/admin/server/access";
import { adminApi } from "@/features/admin/server/api";
import { categoryInput } from "@/features/admin/validation";
import { resourceId } from "@/lib/api/pagination";
import { endpoint, privateJson } from "@/lib/bff/response";
import { readJsonObject } from "@/lib/bff/security";
import { input } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  route: { params: Promise<{ id: string }> },
) {
  return endpoint(() =>
    withAdminSession(request, true, async (context) => {
      const id = resourceId((await route.params).id);
      const { action, ...fields } = await readJsonObject(request, 64_000);
      input(action === "update" || action === "delete");
      const body = action === "update" ? categoryInput(fields) : null;
      if (!body) input(Object.keys(fields).length === 0);
      return context.store.withLock(`admin-category:${id}`, async () => {
        const api = adminApi(context.session.token!);
        if (body)
          return privateJson({ data: await api.updateCategory(id, body) });
        await api.deleteCategory(id);
        return privateJson({ message: "Category deleted." });
      });
    }),
  );
}
