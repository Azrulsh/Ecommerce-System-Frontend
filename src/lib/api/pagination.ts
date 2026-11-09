import { ApiError } from "./errors";
import { array, integer, nullable, object } from "../validation";

export interface Page<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
}
export function parsePage<T>(
  value: unknown,
  parse: (value: unknown) => T,
): Page<T> {
  const envelope = object(value);
  const raw = object(envelope.meta);
  const data = array(envelope.data, parse);
  const meta = {
    current_page: integer(raw.current_page, 1),
    last_page: integer(raw.last_page, 1),
    per_page: integer(raw.per_page, 1, 100),
    total: integer(raw.total),
    from: nullable(raw.from, (v) => integer(v, 1)),
    to: nullable(raw.to, (v) => integer(v, 1)),
  };
  if (
    data.length > meta.per_page ||
    meta.last_page !== Math.max(1, Math.ceil(meta.total / meta.per_page)) ||
    (data.length === 0
      ? meta.from !== null || meta.to !== null
      : meta.from !== (meta.current_page - 1) * meta.per_page + 1 ||
        meta.to !== meta.from + data.length - 1 ||
        meta.to > meta.total)
  )
    throw new ApiError("invalid_response");
  return { data, meta };
}
export function pageNumber(value: unknown): number {
  return typeof value === "string" && /^[1-9]\d{0,5}$/.test(value)
    ? Number(value)
    : 1;
}
export function resourceId(value: string): number {
  if (!/^[1-9]\d{0,15}$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new ApiError("not_found", 404);
  return Number(value);
}
