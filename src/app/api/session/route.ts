import type { NextRequest } from "next/server";
import { discoverSession } from "@/features/auth/server/session";
import { sessionCookieOptions } from "@/lib/bff/config";
import { endpoint, privateJson } from "@/lib/bff/response";
import { ApiError } from "@/lib/api/errors";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return endpoint(async () => {
    if (request.headers.get("sec-fetch-site") === "cross-site")
      throw new ApiError("forbidden", 403);
    const context = await discoverSession(request);
    const response = privateJson({
      user: context.user,
      csrfToken: context.session.csrfToken,
    });
    if (request.cookies.get(context.config.cookieName)?.value !== context.id)
      response.cookies.set(
        context.config.cookieName,
        context.id,
        sessionCookieOptions(context.config, context.session.expiresAt),
      );
    return response;
  });
}
