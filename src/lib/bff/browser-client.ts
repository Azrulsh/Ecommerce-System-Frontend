import { ApiError, type ApiErrorCode } from "../api/errors";
import { object, string } from "../validation";

export async function browserRequest<T>(
  path: string,
  parse: (value: unknown) => T,
  csrfToken?: string,
  body?: unknown,
): Promise<T> {
  try {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(120_000),
      headers:
        body === undefined
          ? { Accept: "application/json" }
          : {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfToken ?? "",
            },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value: unknown = await response.json();
    if (!response.ok) {
      const data = object(value);
      const codes: ApiErrorCode[] = [
        "configuration",
        "network",
        "timeout",
        "invalid_response",
        "unauthenticated",
        "forbidden",
        "not_found",
        "validation",
        "conflict",
        "import_account_mismatch",
        "mock_payment_declined",
        "rate_limited",
        "unavailable",
        "http",
      ];
      const code = codes.find((code) => code === data.error) ?? "http";
      const fields = Array.isArray(data.fields)
        ? data.fields.filter(
            (field): field is string =>
              typeof field === "string" &&
              ["name", "email", "password", "password_confirmation"].includes(
                field,
              ),
          )
        : [];
      throw new ApiError(code, response.status, undefined, fields);
    }
    return parse(value);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("network");
  }
}
export const parseMessage = (value: unknown) =>
  string(object(value).message, 500);

export async function browserAuthLock<T>(action: () => Promise<T>): Promise<T> {
  return navigator.locks
    ? await navigator.locks.request("everyday-auth-session", action)
    : action();
}
