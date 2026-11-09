import { nullable, object, string } from "@/lib/validation";
import { parseUser } from "./validation";
import type { BrowserSession } from "./types";

export function parseBrowserSession(value: unknown): BrowserSession {
  const data = object(value);
  const csrfToken = string(data.csrfToken, 43);
  if (!/^[A-Za-z0-9_-]{43}$/.test(csrfToken))
    throw new Error("Invalid browser session.");
  return {
    user: nullable(data.user, parseUser),
    csrfToken,
    ...(data.warning === undefined
      ? {}
      : { warning: nullable(data.warning, (value) => string(value, 500)) }),
  };
}
