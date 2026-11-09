import { AdminBoundary } from "@/features/admin/components/AdminBoundary";
import { ProductManagement } from "@/features/admin/components/ProductManagement";
import { productPageQuery } from "@/features/admin/server/route-input";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = productPageQuery(await searchParams);
  return (
    <AdminBoundary returnTo={`/admin/products?${filters}`}>
      <ProductManagement filters={filters} />
    </AdminBoundary>
  );
}
