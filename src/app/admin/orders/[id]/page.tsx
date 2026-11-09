import { AdminBoundary } from "@/features/admin/components/AdminBoundary";
import { AdminOrderDetails } from "@/features/admin/components/AdminOrderDetails";
import { adminId } from "@/features/admin/server/route-input";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = adminId((await params).id);
  return (
    <AdminBoundary returnTo={`/admin/orders/${id}`}>
      <AdminOrderDetails id={id} />
    </AdminBoundary>
  );
}
