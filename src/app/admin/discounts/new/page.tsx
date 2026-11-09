import { AdminBoundary } from "@/features/admin/components/AdminBoundary";
import { DiscountEditor } from "@/features/admin/components/DiscountEditor";
export default function Page() {
  return (
    <AdminBoundary returnTo="/admin/discounts/new">
      <DiscountEditor />
    </AdminBoundary>
  );
}
