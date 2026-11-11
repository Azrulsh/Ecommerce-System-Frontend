import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { contentPolicy } from "@/lib/security/content-policy";

export function proxy(request: NextRequest) {
  const development = process.env.NODE_ENV === "development";
  const https = process.env.APP_ORIGIN?.startsWith("https://") ?? false;
  const policy = contentPolicy(
    randomBytes(32).toString("base64"),
    development,
    https,
  );
  const headers = new Headers(request.headers);
  // Override browser-supplied policy. Next extracts this nonce for its scripts.
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  if (!development && https)
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  return response;
}

export const config = {
  matcher: [
    "/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
