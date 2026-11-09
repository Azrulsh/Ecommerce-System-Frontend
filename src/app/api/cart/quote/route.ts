import type { NextRequest } from "next/server";
import { withBrowserSession } from "@/features/auth/server/session";
import { guestQuote } from "@/features/cart/server/quote";
import { parseGuestLines } from "@/features/cart/guest-cart";
import { endpoint, privateJson } from "@/lib/bff/response";
import { readJsonObject } from "@/lib/bff/security";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return endpoint(() =>
    withBrowserSession(request, false, true, async () => {
      const data = await readJsonObject(request);
      return privateJson(await guestQuote(parseGuestLines(data.items)));
    }),
  );
}
