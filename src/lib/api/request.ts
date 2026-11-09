import type { ApiConfig } from "./config";
import { ApiError, httpError } from "./errors";

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
): Promise<T> {
  let url: URL;
  try {
    url = requestUrl(config.baseUrl, path);
  } catch {
    throw new ApiError("configuration");
  }
  const signal = AbortSignal.timeout(config.timeoutMs);
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "GET",
      headers: { Accept: "application/json" },
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
  if (!response.ok)
    throw httpError(response.status, response.headers.get("retry-after"));
  try {
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
