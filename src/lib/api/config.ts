import { ApiError } from "./errors";

export interface ApiConfig {
  baseUrl: string;
  timeoutMs: number;
}
interface ApiEnvironment {
  NODE_ENV?: string;
  LARAVEL_API_URL?: string;
  API_BASE_URL?: string;
}

// Pure parsing keeps environment access in the server-only entry point.
export function resolveApiConfig(environment: ApiEnvironment): ApiConfig {
  const production = environment.NODE_ENV === "production";
  const value =
    environment.LARAVEL_API_URL ??
    environment.API_BASE_URL ??
    (production ? undefined : "http://127.0.0.1:8000/api");
  if (!value || value.trim() !== value) throw new ApiError("configuration");
  try {
    const base = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      base.hostname,
    );
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      (production && base.protocol === "http:" && !loopback)
    )
      throw new ApiError("configuration");
    return { baseUrl: base.href.replace(/\/+$/, ""), timeoutMs: 8_000 };
  } catch {
    throw new ApiError("configuration");
  }
}
