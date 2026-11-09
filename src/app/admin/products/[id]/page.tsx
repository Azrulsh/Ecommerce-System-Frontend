import { AdminBoundary } from "@/features/admin/components/AdminBoundary";
import { ProductEditor } from "@/features/admin/components/ProductEditor";
import { adminId } from "@/features/admin/server/route-input";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = adminId((await params).id);
  return (
    <AdminBoundary returnTo={`/admin/products/${id}`}>
      <ProductEditor id={id} />
    </AdminBoundary>
  );
}
