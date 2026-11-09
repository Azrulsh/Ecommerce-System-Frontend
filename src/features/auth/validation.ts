import {
  boolean,
  input,
  integer,
  nullable,
  object,
  string,
} from "@/lib/validation";
import type { Credentials, User } from "./types";

export function parseUser(value: unknown): User {
  const item = object(value);
  return {
    id: integer(item.id, 1),
    name: string(item.name, 255),
    email: string(item.email, 255),
    is_loyalty_member: boolean(item.is_loyalty_member),
    created_at: nullable(item.created_at, string),
  };
}
export function parseUserResponse(value: unknown) {
  return parseUser(object(value).data);
}
export function parseTokenResponse(value: unknown) {
  const data = object(object(value).data);
  const token = string(data.token, 4096);
  input(
    data.token_type === "Bearer" &&
      token.length > 10 &&
      !/[\s\u0000-\u001f]/.test(token),
  );
  return { user: parseUser(data.user), token };
}
export function parseCredentials(
  value: unknown,
  registration: boolean,
): Credentials {
  input(value && typeof value === "object" && !Array.isArray(value));
  const data = object(value);
  input(
    Object.keys(data).every((key) =>
      ["name", "email", "password", "password_confirmation"].includes(key),
    ),
  );
  input(typeof data.email === "string" && typeof data.password === "string");
  const email = data.email.trim().toLowerCase();
  const password = data.password;
  input(
    email.length <= 255 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      password.length > 0 &&
      new TextEncoder().encode(password).length <= 72,
  );
  if (!registration) return { email, password };
  input(
    typeof data.name === "string" &&
      data.name.trim().length > 0 &&
      data.name.trim().length <= 255,
  );
  input(
    Array.from(password).length >= 12 &&
      /\p{Ll}/u.test(password) &&
      /\p{Lu}/u.test(password) &&
      /\p{N}/u.test(password) &&
      data.password_confirmation === password,
  );
  return {
    name: data.name.trim(),
    email,
    password,
    password_confirmation: password,
  };
}
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 512) return "/cart";
  try {
    const decoded = decodeURIComponent(value);
    if (
      !decoded.startsWith("/") ||
      decoded.startsWith("//") ||
      /[\\\u0000-\u001f\u007f]/.test(decoded)
    )
      return "/cart";
    const url = new URL(value, "https://internal.invalid");
    if (
      url.origin !== "https://internal.invalid" ||
      !/^(?:\/(?:cart|account|checkout|wishlist)?|\/products(?:\/[1-9]\d*)?|\/orders(?:\/[1-9]\d*(?:\/(?:confirmation|payment))?)?|\/admin(?:\/(?:categories|orders(?:\/[1-9]\d*)?|(?:products|discounts)(?:\/(?:new|[1-9]\d*))?))?)$/.test(
        url.pathname,
      )
    )
      return "/cart";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/cart";
  }
}
