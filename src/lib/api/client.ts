import "server-only";

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super("The catalog service could not complete this request.");
  }
}
export async function apiGet<T>(
  path: string,
  parse: (value: unknown) => T,
): Promise<T> {
  try {
    const base = new URL(
      process.env.API_BASE_URL ?? "http://127.0.0.1:8000/api",
    );
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      throw new ApiError(503);
    const response = await fetch(`${base.href.replace(/\/$/, "")}/${path}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new ApiError(response.status);
    const body: unknown = await response.json();
    return parse(body);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503);
  }
}
