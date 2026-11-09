import { AdminBoundary } from "@/features/admin/components/AdminBoundary";
import { DiscountEditor } from "@/features/admin/components/DiscountEditor";
import { adminId } from "@/features/admin/server/route-input";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = adminId((await params).id);
  return (
    <AdminBoundary returnTo={`/admin/discounts/${id}`}>
      <DiscountEditor id={id} />
    </AdminBoundary>
  );
}
