import { ProductGridSkeleton } from "@/components/products/ProductGridSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div className="page-width py-14">
      <Skeleton className="mb-5 h-12 w-64" />
      <Skeleton className="mb-9 h-32 w-full" />
      <ProductGridSkeleton count={12} />
    </div>
  );
}
