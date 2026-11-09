import { ProductGridSkeleton } from "@/components/products/ProductGridSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div className="page-width py-14">
      <Skeleton className="mb-5 h-5 w-40" />
      <Skeleton className="mb-10 h-12 w-64" />
      <ProductGridSkeleton />
    </div>
  );
}
