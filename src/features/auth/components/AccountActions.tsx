"use client";
import { Button } from "@/components/ui/button";
import { useCommerce } from "@/features/cart/components/CommerceProvider";
import { useRouter } from "next/navigation";

export function AccountActions() {
  const commerce = useCommerce();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      disabled={commerce.busy || commerce.loading}
      onClick={() =>
        void commerce
          .logout()
          .then(() => {
            router.replace("/cart");
            router.refresh();
          })
          .catch(() => undefined)
      }
    >
      Sign out
    </Button>
  );
}
