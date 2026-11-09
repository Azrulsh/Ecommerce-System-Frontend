import { NextResponse } from "next/server";
import { ApiError } from "../api/errors";

export function privateJson(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      Pragma: "no-cache",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function endpoint(
  action: () => Promise<Response>,
): Promise<Response> {
  try {
    return await action();
  } catch (error) {
    const normalized =
      error instanceof ApiError ? error : new ApiError("unavailable", 503);
    const status =
      normalized.code === "invalid_response"
        ? 502
        : normalized.status && normalized.status >= 400
          ? normalized.status
          : 503;
    const response = privateJson(
      {
        error: normalized.code,
        message: normalized.message,
        fields: normalized.fieldNames ?? [],
      },
      status,
    );
    if (normalized.retryAfterSeconds !== undefined)
      response.headers.set("Retry-After", String(normalized.retryAfterSeconds));
    return response;
  }
}
