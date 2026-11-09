import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { apiRequest } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { bffRuntime } from "@/lib/bff/runtime";
import {
  opaqueId,
  validId,
  verifyCsrf,
  verifyOrigin,
} from "@/lib/bff/security";
import { parseUserResponse } from "../validation";
import { parseSession, type SessionRecord } from "./session-record";
import type { User } from "../types";

export type SessionContext = Awaited<ReturnType<typeof bffRuntime>> & {
  id: string;
  session: SessionRecord;
  user: User | null;
};

export async function readSession(
  store: SessionContext["store"],
  id: string | undefined,
) {
  if (!validId(id)) return null;
  const session = await store.read("session", id, parseSession);
  if (session && session.expiresAt <= Date.now()) {
    await store.remove("session", id);
    return null;
  }
  return session;
}
export async function verifyUser(
  context: SessionContext,
): Promise<User | null> {
  if (!context.session.token) return null;
  try {
    const user = await apiRequest("user", parseUserResponse, {
      token: context.session.token,
    });
    if (user.id !== context.session.userId)
      throw new ApiError("unauthenticated", 401);
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.code === "unauthenticated")
      await context.store.remove("session", context.id);
    throw error;
  }
}
export async function discoverSession(
  request: NextRequest,
): Promise<SessionContext> {
  const runtime = await bffRuntime();
  let id = request.cookies.get(runtime.config.cookieName)?.value;
  let session = await readSession(runtime.store, id);
  if (session && id) {
    const context = { ...runtime, id, session, user: null };
    try {
      return { ...context, user: await verifyUser(context) };
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "unauthenticated")
        throw error;
    }
  }
  id = opaqueId();
  session = {
    csrfToken: opaqueId(),
    token: null,
    userId: null,
    createdAt: Date.now(),
    expiresAt: Date.now() + runtime.config.lifetimeMs,
  };
  await runtime.store.write("session", id, session);
  return { ...runtime, id, session, user: null };
}
export async function withBrowserSession<T>(
  request: NextRequest,
  authenticated: boolean,
  mutate: boolean,
  action: (context: SessionContext) => Promise<T>,
): Promise<T> {
  const runtime = await bffRuntime();
  if (mutate) verifyOrigin(request, runtime.config.origin);
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new ApiError("forbidden", 403);
  const id = request.cookies.get(runtime.config.cookieName)?.value;
  if (!validId(id)) throw new ApiError("unauthenticated", 401);
  return runtime.store.withLock(`session:${id}`, async () => {
    const session = await readSession(runtime.store, id);
    if (!session) throw new ApiError("unauthenticated", 401);
    if (mutate)
      verifyCsrf(request.headers.get("x-csrf-token"), session.csrfToken);
    const context: SessionContext = { ...runtime, id, session, user: null };
    if (authenticated) {
      context.user = await verifyUser(context);
      if (!context.user) throw new ApiError("unauthenticated", 401);
    }
    try {
      return await action(context);
    } catch (error) {
      if (error instanceof ApiError && error.code === "unauthenticated")
        await context.store.remove("session", id);
      throw error;
    }
  });
}
export async function serverIdentity(): Promise<{
  user: User;
  token: string;
} | null> {
  const cookieStore = await cookies();
  // Catalog reads remain available without initializing anonymous sessions.
  if (
    !cookieStore.has("everyday_session") &&
    !cookieStore.has("__Host-everyday_session")
  )
    return null;
  const runtime = await bffRuntime();
  const id = cookieStore.get(runtime.config.cookieName)?.value;
  const session = await readSession(runtime.store, id);
  if (!session?.token || !id) return null;
  try {
    const user = await verifyUser({ ...runtime, id, session, user: null });
    return user ? { user, token: session.token } : null;
  } catch (error) {
    if (error instanceof ApiError && error.code === "unauthenticated")
      return null;
    throw error;
  }
}
