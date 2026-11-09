import { AdminBoundary } from "@/features/admin/components/AdminBoundary";
import { OrderManagement } from "@/features/admin/components/OrderManagement";
import { reportQuery } from "@/features/admin/server/route-input";
import { pageNumber } from "@/lib/api/pagination";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = pageNumber(params.page);
  const filters = reportQuery(params, true);
  return (
    <AdminBoundary returnTo={`/admin/orders?page=${page}&${filters}`}>
      <OrderManagement page={page} filters={filters} />
    </AdminBoundary>
  );
}
