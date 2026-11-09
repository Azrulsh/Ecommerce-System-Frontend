import type { NextRequest } from "next/server";
import { authenticate, revokeToken } from "@/features/auth/server/actions";
import { withBrowserSession } from "@/features/auth/server/session";
import { parseCredentials } from "@/features/auth/validation";
import { sessionCookieOptions } from "@/lib/bff/config";
import { readJson } from "@/lib/bff/security";
import { endpoint, privateJson } from "@/lib/bff/response";
import { ApiError } from "@/lib/api/errors";

export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  return endpoint(async () => {
    const { action } = await params;
    if (!["login", "register", "logout"].includes(action))
      throw new ApiError("not_found", 404);
    return withBrowserSession(request, false, true, async (context) => {
      if (action === "logout") {
        await context.store.remove("session", context.id);
        const revoked =
          !context.session.token || (await revokeToken(context.session.token));
        const response = privateJson({
          revoked,
          message: revoked
            ? "You are signed out."
            : "You are signed out on this browser. The API session could not be revoked and may remain valid until its expiry.",
        });
        response.cookies.set(
          context.config.cookieName,
          "",
          sessionCookieOptions(context.config, 0),
        );
        return response;
      }
      const credentials = parseCredentials(
        await readJson(request),
        action === "register",
      );
      const result = await authenticate(
        context,
        credentials,
        action === "register",
      );
      const response = privateJson({
        user: result.user,
        csrfToken: result.session.csrfToken,
        warning: result.previousTokenRevoked
          ? null
          : "The previous API session could not be revoked.",
      });
      response.cookies.set(
        context.config.cookieName,
        result.id,
        sessionCookieOptions(context.config, result.session.expiresAt),
      );
      return response;
    });
  });
}
