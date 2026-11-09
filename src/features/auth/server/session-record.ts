import { integer, object, string, input } from "@/lib/validation";
import { validId } from "@/lib/bff/security";

export interface SessionRecord {
  csrfToken: string;
  createdAt: number;
  expiresAt: number;
  token: string | null;
  userId: number | null;
}
export function parseSession(value: unknown): SessionRecord {
  const data = object(value);
  input(validId(data.csrfToken));
  return {
    csrfToken: data.csrfToken,
    createdAt: integer(data.createdAt),
    expiresAt: integer(data.expiresAt),
    token: data.token === null ? null : string(data.token, 4096),
    userId: data.userId === null ? null : integer(data.userId, 1),
  };
}
