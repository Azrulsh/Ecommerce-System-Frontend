import type { ApiConfig } from "./config";
import { ApiError, httpError } from "./errors";
import { validationFields } from "./validation-fields";

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
  idempotencyKey?: string;
  parseError?: (status: number, value: unknown) => ApiError | undefined;
}

function requestUrl(baseUrl: string, path: string): URL {
  const base = new URL(`${baseUrl}/`);
  const url = new URL(path, base);
  if (
    !path ||
    /^[/?]/.test(path) ||
    /^[a-z][a-z\d+.-]*:/i.test(path) ||
    path.includes("\\") ||
    path.includes("#") ||
    url.username ||
    url.password ||
    url.origin !== base.origin ||
    !url.pathname.startsWith(base.pathname)
  )
    throw new ApiError("configuration");
  return url;
}

// No environment or credentials live in this testable transport core.
// Application code calls the server-only client, not this function directly.
export async function requestJson<T>(
  config: ApiConfig,
  path: string,
  parse: (value: unknown) => T,
  fetcher: typeof fetch = fetch,
  options: ApiRequestOptions = {},
): Promise<T> {
  let url: URL;
  try {
    url = requestUrl(config.baseUrl, path);
  } catch {
    throw new ApiError("configuration");
  }
  const signal = AbortSignal.timeout(config.timeoutMs);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) {
    if (options.token.length > 4096 || /[\s\u0000-\u001f]/.test(options.token))
      throw new ApiError("configuration");
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey !== undefined) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(options.idempotencyKey))
      throw new ApiError("configuration");
    headers["Idempotency-Key"] = options.idempotencyKey;
  }
  let response: Response;
  try {
    response = await fetcher(url, {
      method: options.method ?? "GET",
      headers,
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal,
    });
  } catch (error) {
    const timedOut =
      signal.aborted ||
      (error instanceof Error && error.name === "TimeoutError");
    throw new ApiError(timedOut ? "timeout" : "network");
  }
  if (!response.ok) {
    const error = httpError(
      response.status,
      response.headers.get("retry-after"),
    );
    let fields: string[] | undefined;
    if (response.status === 422 || options.parseError) {
      let mapped: ApiError | undefined;
      try {
        const data: unknown = await response.json();
        mapped = options.parseError?.(response.status, data);
        if (
          data &&
          typeof data === "object" &&
          "errors" in data &&
          data.errors &&
          typeof data.errors === "object" &&
          !Array.isArray(data.errors)
        )
          fields = Object.keys(data.errors).filter((key) =>
            validationFields.includes(key),
          );
      } catch {
        if (signal.aborted) throw new ApiError("timeout", response.status);
      }
      if (mapped) throw mapped;
    } else {
      await response.body?.cancel().catch(() => undefined);
    }
    throw new ApiError(
      error.code,
      error.status,
      error.retryAfterSeconds,
      fields,
    );
  }
  try {
    if (response.status === 204) return parse(null);
    const mediaType = response.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    if (!mediaType || !/^application\/(?:json|[\w.-]+\+json)$/.test(mediaType))
      throw new ApiError("invalid_response", response.status);
    const body: unknown = await response.json();
    return parse(body);
  } catch {
    throw new ApiError(
      signal.aborted ? "timeout" : "invalid_response",
      response.status,
    );
  }
}
