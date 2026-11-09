export type ApiErrorCode =
  | "configuration"
  | "network"
  | "timeout"
  | "invalid_response"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "import_account_mismatch"
  | "rate_limited"
  | "unavailable"
  | "http";

const messages: Record<ApiErrorCode, string> = {
  configuration: "The service connection is not configured correctly.",
  network: "The service could not be reached.",
  timeout: "The service took too long to respond.",
  invalid_response: "The service returned an unexpected response.",
  unauthenticated: "Please sign in to continue.",
  forbidden: "This action is not permitted.",
  not_found: "This item is unavailable.",
  validation: "Please check the submitted information.",
  conflict: "The information has changed. Please review it and try again.",
  import_account_mismatch:
    "This interrupted import belongs to another account. Sign in to that account to finish reviewing it, or sign out to explicitly clear the remaining guest items.",
  rate_limited: "Too many requests. Please try again shortly.",
  unavailable: "The service is temporarily unavailable.",
  http: "The service could not complete this request.",
};

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number,
    public readonly fieldNames?: readonly string[],
  ) {
    super(messages[code]);
    this.name = "ApiError";
  }
}

export function httpError(status: number, retryAfter: string | null): ApiError {
  const codes: Record<number, ApiErrorCode> = {
    401: "unauthenticated",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    422: "validation",
    429: "rate_limited",
  };
  const seconds =
    retryAfter !== null && /^\d{1,6}$/.test(retryAfter)
      ? Number(retryAfter)
      : undefined;
  return new ApiError(
    codes[status] ?? (status >= 500 ? "unavailable" : "http"),
    status,
    seconds,
  );
}
