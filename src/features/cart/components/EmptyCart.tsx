import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
export function EmptyCart({ account = false }: { account?: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <ShoppingBag
        size={34}
        className="mx-auto mb-5 text-teal-700"
        aria-hidden="true"
      />
      <h2 className="text-2xl font-medium">
        {account ? "Your account cart is empty" : "Your guest cart is empty"}
      </h2>
      <p className="mt-3 text-sm text-slate-500">
        Find something good to make it your own.
      </p>
      <Link href="/products" className={buttonVariants({ className: "mt-6" })}>
        Explore the collection
      </Link>
    </div>
  );
}
