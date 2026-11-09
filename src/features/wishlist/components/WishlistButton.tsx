"use client";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCommerce } from "@/features/cart/components/CommerceProvider";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import { safeReturnTo } from "@/features/auth/validation";
import { useWishlist } from "./WishlistProvider";
export function WishlistButton({
  productId,
  saved = false,
}: {
  productId: number;
  saved?: boolean;
}) {
  const commerce = useCommerce();
  const wishlist = useWishlist();
  const pathname = usePathname();
  const search = useSearchParams();
  const returnTo = safeReturnTo(
    `${pathname}${search.size ? `?${search}` : ""}`,
  );
  const key = `${commerce.loading}:${commerce.session?.user?.id}:${commerce.session?.csrfToken}`;
  const [feedback, setFeedback] = useState({
    key: "",
    message: "",
    error: false,
  });
  const isSaved = saved || wishlist.membership(productId) === true;
  const message = feedback.key === key ? feedback.message : "";
  if (!commerce.loading && !commerce.session?.user)
    return (
      <Link
        href={`/login?next=${encodeURIComponent(returnTo)}`}
        prefetch={false}
        className="text-link my-3 min-h-11 text-sm"
      >
        <Heart size={16} aria-hidden="true" />
        Sign in to save
      </Link>
    );
  return (
    <div className="my-3">
      <Button
        variant="outline"
        size="sm"
        className="max-w-full"
        disabled={commerce.loading || commerce.busy || wishlist.busy}
        aria-pressed={
          isSaved
            ? true
            : wishlist.membership(productId) === false
              ? false
              : undefined
        }
        onClick={() => {
          setFeedback({ key, message: "Updating wishlist…", error: false });
          void wishlist.mutate(productId, !isSaved).then(
            () =>
              setFeedback({
                key,
                message: isSaved
                  ? "Removed from wishlist."
                  : "Saved to wishlist.",
                error: false,
              }),
            (error: unknown) =>
              setFeedback({
                key,
                message: `${error instanceof ApiError ? error.message : "Wishlist could not be updated."} Refresh saved products before trying again.`,
                error: true,
              }),
          );
        }}
      >
        <Heart
          size={16}
          aria-hidden="true"
          fill={isSaved ? "currentColor" : "none"}
        />
        {isSaved ? "Remove from wishlist" : "Save to wishlist"}
      </Button>
      {message && (
        <p
          role={feedback.error ? "alert" : "status"}
          className="mt-2 text-xs leading-5 text-slate-600"
        >
          {message}{" "}
          {feedback.error && (
            <Link className="text-link" href="/wishlist">
              View saved products
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
