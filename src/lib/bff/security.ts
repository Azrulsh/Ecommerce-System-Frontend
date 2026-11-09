import { randomBytes, timingSafeEqual } from "node:crypto";
import { ApiError } from "../api/errors";

export const opaqueId = () => randomBytes(32).toString("base64url");
export const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export function verifyOrigin(request: Request, origin: string) {
  if (
    request.headers.get("origin") !== origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new ApiError("forbidden", 403);
}
export function verifyCsrf(provided: string | null, expected: string) {
  if (
    !validId(provided) ||
    !validId(expected) ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  )
    throw new ApiError("forbidden", 403);
}
export async function readJson(
  request: Request,
  maxBytes = 32_000,
): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    throw new ApiError("validation", 422);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("validation", 422);
  let length = 0;
  const chunks: Uint8Array[] = [];
  const deadline = Date.now() + 5_000;
  for (;;) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const chunk = await Promise.race([
      reader.read(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => {
            void reader.cancel();
            reject(new ApiError("validation", 422));
          },
          Math.max(1, deadline - Date.now()),
        );
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
    if (chunk.done) break;
    length += chunk.value.length;
    if (length > maxBytes) {
      await reader.cancel();
      throw new ApiError("validation", 422);
    }
    chunks.push(chunk.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ApiError("validation", 422);
  }
}
export async function readJsonObject(
  request: Request,
  maxBytes = 32_000,
): Promise<Record<string, unknown>> {
  const value = await readJson(request, maxBytes);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError("validation", 422);
  return value as Record<string, unknown>;
}
