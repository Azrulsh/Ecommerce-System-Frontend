import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { ApiError } from "../api/errors";

export interface BffConfig {
  origin: string;
  directory: string;
  key?: string;
  secure: boolean;
  cookieName: string;
  lifetimeMs: number;
  production: boolean;
}
export function resolveBffConfig(
  env: Record<string, string | undefined>,
  cwd = process.cwd(),
): BffConfig {
  const production = env.NODE_ENV === "production";
  try {
    const origin = new URL(
      env.APP_ORIGIN ?? (production ? "" : "http://localhost:3000"),
    );
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      origin.hostname,
    );
    if (
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash ||
      !["http:", "https:"].includes(origin.protocol) ||
      (origin.protocol !== "https:" && !loopback)
    )
      throw new Error();
    if (
      production &&
      (!env.SESSION_STORE_DIRECTORY ||
        !path.isAbsolute(env.SESSION_STORE_DIRECTORY) ||
        !env.SESSION_ENCRYPTION_KEY ||
        env.SESSION_DEPLOYMENT !== "single-host")
    )
      throw new Error();
    if (
      env.SESSION_ENCRYPTION_KEY &&
      !/^[A-Za-z0-9+/]{43}=$/.test(env.SESSION_ENCRYPTION_KEY)
    )
      throw new Error();
    const defaultDirectory = path.join(
      os.tmpdir(),
      "everyday-bff",
      createHash("sha256").update(cwd).digest("hex").slice(0, 24),
    );
    const directory = path.resolve(
      cwd,
      env.SESSION_STORE_DIRECTORY ?? defaultDirectory,
    );
    const relative = path.relative(cwd, directory).replaceAll("\\", "/");
    if (
      ["public", "src", "node_modules", ".next", ".git"].some(
        (name) => relative === name || relative.startsWith(`${name}/`),
      ) ||
      directory === path.parse(directory).root ||
      relative === ""
    )
      throw new Error();
    // The checkout may itself be served by Apache/XAMPP, not only Next.js.
    const parts = path.normalize(cwd).split(path.sep);
    const webRootIndex = parts.findIndex((part) =>
      ["htdocs", "wwwroot", "public_html"].includes(part.toLowerCase()),
    );
    if (
      production &&
      relative !== ".." &&
      !relative.startsWith("../") &&
      !path.isAbsolute(relative)
    )
      throw new Error();
    if (webRootIndex >= 0) {
      const webRoot = parts.slice(0, webRootIndex + 1).join(path.sep);
      const webRelative = path.relative(webRoot, directory);
      if (
        !webRelative.startsWith(`..${path.sep}`) &&
        webRelative !== ".." &&
        !path.isAbsolute(webRelative)
      )
        throw new Error();
    }
    const secure = origin.protocol === "https:";
    return {
      origin: origin.origin,
      directory,
      key: env.SESSION_ENCRYPTION_KEY,
      secure,
      cookieName: secure ? "__Host-everyday_session" : "everyday_session",
      lifetimeMs: 12 * 60 * 60 * 1000,
      production,
    };
  } catch {
    throw new ApiError("configuration");
  }
}
export function sessionCookieOptions(config: BffConfig, expires: number) {
  return {
    httpOnly: true,
    secure: config.secure,
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(expires),
  };
}
