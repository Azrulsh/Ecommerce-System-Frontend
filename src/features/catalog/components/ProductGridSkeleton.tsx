import { Skeleton } from "@/components/ui/skeleton";

export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading products">
      <span className="sr-only">Loading products…</span>
      <div
        aria-hidden="true"
        className="grid gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <Skeleton className="aspect-[4/3] rounded-none" />
            <div className="space-y-4 p-5">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-7 w-2/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
