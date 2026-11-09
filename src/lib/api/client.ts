import "server-only";
import { resolveApiConfig } from "./config";
import { requestJson } from "./request";
export async function apiGet<T>(
  path: string,
  parse: (value: unknown) => T,
): Promise<T> {
  return requestJson(resolveApiConfig(process.env), path, parse);
}
