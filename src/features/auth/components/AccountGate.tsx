"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommerce } from "@/features/cart/components/CommerceProvider";
import { useRouter } from "next/navigation";

// Also hides stale, previously authorized router history after an account switch.
export function AccountGate({
  userId,
  children,
}: {
  userId: number;
  children: React.ReactNode;
}) {
  const commerce = useCommerce();
  const router = useRouter();
  if (commerce.loading)
    return (
      <div
        className="page-width py-14"
        role="status"
        aria-label="Verifying your account"
      >
        <Skeleton className="mx-auto h-64 max-w-xl" />
      </div>
    );
  if (commerce.session?.user?.id !== userId)
    return (
      <div className="page-width py-14">
        <p>Your session changed. Reload the account page to continue.</p>
        <Button className="mt-4" onClick={() => router.refresh()}>
          Reload account
        </Button>
        <Link className="text-link ml-4" href="/login?next=%2Faccount">
          Sign in
        </Link>
      </div>
    );
  return children;
}
