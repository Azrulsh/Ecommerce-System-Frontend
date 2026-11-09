import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div
      className="page-width py-12"
      role="status"
      aria-label="Loading product details"
    >
      <span className="sr-only">Loading product details…</span>
      <Skeleton className="mb-8 h-5 w-44" />
      <div className="grid gap-10 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-3xl" />
        <div className="space-y-6">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-12 w-4/5" />
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
