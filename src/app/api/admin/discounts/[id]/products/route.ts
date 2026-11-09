import type { NextRequest } from "next/server";
import { withAdminSession } from "@/features/admin/server/access";
import { adminApi } from "@/features/admin/server/api";
import { assignmentInput } from "@/features/admin/validation";
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
      const { action, ...fields } = await readJsonObject(request);
      input(action === "assign" || action === "remove");
      const body = assignmentInput(fields);
      if (action === "remove") input(body.product_ids.length === 1);
      return context.store.withLock(`admin-discount:${id}`, async () => {
        const api = adminApi(context.session.token!);
        if (action === "assign")
          return privateJson({ data: await api.assign(id, body) });
        await api.unassign(id, body.product_ids[0]);
        return privateJson({ message: "Product assignment removed." });
      });
    }),
  );
}
