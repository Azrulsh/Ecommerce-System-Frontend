import "server-only";
import { redirect } from "next/navigation";
import { serverIdentity } from "@/features/auth/server/session";
import { ApiError } from "@/lib/api/errors";
import { verifyAdmin } from "../server/access";
import { AdminFrame } from "./AdminFrame";
import { ApiNotice } from "@/components/ui/api-notice";
export async function AdminBoundary({
  children,
  returnTo = "/admin",
}: {
  children: React.ReactNode;
  returnTo?: string;
}) {
  const result = await (async () => {
    try {
      const identity = await serverIdentity();
      if (!identity) return { kind: "guest" as const };
      await verifyAdmin(identity.token);
      return { kind: "allowed" as const, userId: identity.user.id };
    } catch (error) {
      return {
        kind: "error" as const,
        error:
          error instanceof ApiError ? error : new ApiError("unavailable", 503),
      };
    }
  })();
  if (result.kind === "guest")
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (result.kind === "error" && result.error.code === "unauthenticated")
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (result.kind === "error")
    return (
      <div className="page-width py-14">
        {result.error.code === "forbidden" ? (
          <div role="alert">
            <h1 className="text-3xl font-medium">
              Administrator access required
            </h1>
            <p className="mt-4 text-slate-600">
              This account is not permitted to manage the store.
            </p>
          </div>
        ) : (
          <ApiNotice
            href="/admin"
            title="Store management is unavailable"
            message={result.error.message}
          />
        )}
      </div>
    );
  return <AdminFrame userId={result.userId}>{children}</AdminFrame>;
}
