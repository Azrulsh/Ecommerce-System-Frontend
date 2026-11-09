import { ApiError } from "./api/errors";

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError("invalid_response");
  return value as Record<string, unknown>;
}
export function string(value: unknown, max = 10000): string {
  if (typeof value !== "string" || value.length > max)
    throw new ApiError("invalid_response");
  return value;
}
export function integer(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new ApiError("invalid_response");
  return value;
}
export function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new ApiError("invalid_response");
  return value;
}
export function money(value: unknown): string {
  const amount = string(value, 32);
  if (!/^\d{1,24}\.\d{2}$/.test(amount)) throw new ApiError("invalid_response");
  return amount;
}
export function nullable<T>(
  value: unknown,
  parse: (value: unknown) => T,
): T | null {
  return value === null ? null : parse(value);
}
export function array<T>(
  value: unknown,
  parse: (value: unknown) => T,
  max = 100,
): T[] {
  if (!Array.isArray(value) || value.length > max)
    throw new ApiError("invalid_response");
  return value.map(parse);
}
export function input(condition: unknown): asserts condition {
  if (!condition) throw new ApiError("validation", 422);
}
