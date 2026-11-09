import { AdminBoundary } from "@/features/admin/components/AdminBoundary";
import { Dashboard } from "@/features/admin/components/Dashboard";
import { reportQuery } from "@/features/admin/server/route-input";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = reportQuery(await searchParams);
  return (
    <AdminBoundary returnTo={`/admin?${filters}`}>
      <Dashboard filters={filters} />
    </AdminBoundary>
  );
}
