import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="page-width py-24 text-center">
      <SearchX
        className="mx-auto mb-6 text-teal-700"
        size={36}
        aria-hidden="true"
      />
      <p className="eyebrow">A little detour</p>
      <h1 className="text-3xl font-medium tracking-tight">
        This find is no longer here
      </h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-500">
        The page or product may have moved, or it’s no longer available. There’s
        more to explore in the collection.
      </p>
      <Link href="/products" className={buttonVariants({ className: "mt-7" })}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to the collection
      </Link>
    </div>
  );
}
