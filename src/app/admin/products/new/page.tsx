import { AdminBoundary } from "@/features/admin/components/AdminBoundary";
import { ProductEditor } from "@/features/admin/components/ProductEditor";
export default function Page() {
  return (
    <AdminBoundary returnTo="/admin/products/new">
      <ProductEditor />
    </AdminBoundary>
  );
}
