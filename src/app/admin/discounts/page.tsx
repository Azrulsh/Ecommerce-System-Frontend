import { AdminBoundary } from "@/features/admin/components/AdminBoundary";
import { DiscountManagement } from "@/features/admin/components/DiscountManagement";
import { pageNumber } from "@/lib/api/pagination";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = pageNumber((await searchParams).page);
  return (
    <AdminBoundary returnTo={`/admin/discounts?page=${page}`}>
      <DiscountManagement page={page} />
    </AdminBoundary>
  );
}
