import type { Metadata } from "next";
import { CartPage } from "@/features/cart/components/CartPage";
import { safeReturnTo } from "@/features/auth/validation";
export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};
export default async function Cart({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <CartPage
      checkoutNotice={query.checkout === "next-phase"}
      returnTo={safeReturnTo(
        query.next ??
          (query.checkout === "next-phase" ? "/checkout" : undefined),
      )}
    />
  );
}
