import "server-only";
import { apiRequest } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { opaqueId } from "@/lib/bff/security";
import { parseTokenResponse } from "../validation";
import type { Credentials } from "../types";
import type { SessionContext } from "./session";

export async function revokeToken(token: string): Promise<boolean> {
  try {
    await apiRequest("logout", () => null, { method: "POST", token });
    return true;
  } catch (error) {
    return error instanceof ApiError && error.code === "unauthenticated";
  }
}
export async function authenticate(
  context: SessionContext,
  credentials: Credentials,
  registration: boolean,
) {
  await context.store.withLock(`auth-rate:${credentials.email}`, async () => {
    const now = Date.now();
    const attempts =
      (await context.store.read("rate", credentials.email, (value) => {
        if (!Array.isArray(value)) return [];
        return value.filter(
          (item): item is number =>
            typeof item === "number" && item > now - 60_000,
        );
      })) ?? [];
    if (attempts.length >= 5) throw new ApiError("rate_limited", 429, 60);
    await context.store.write("rate", credentials.email, [...attempts, now]);
  });
  const result = await apiRequest(
    registration ? "register" : "login",
    parseTokenResponse,
    { method: "POST", body: credentials },
  );
  const id = opaqueId();
  const session = {
    token: result.token,
    userId: result.user.id,
    csrfToken: opaqueId(),
    createdAt: Date.now(),
    expiresAt: Date.now() + context.config.lifetimeMs,
  };
  try {
    // Invalidate the old identifier before publishing the new cookie.
    await context.store.remove("session", context.id);
    await context.store.write("session", id, session);
  } catch {
    await revokeToken(result.token);
    throw new ApiError("unavailable", 503);
  }
  const previousTokenRevoked =
    !context.session.token || (await revokeToken(context.session.token));
  return { id, session, user: result.user, previousTokenRevoked };
}
