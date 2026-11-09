import { AdminBoundary } from "@/features/admin/components/AdminBoundary";
import { CategoryManagement } from "@/features/admin/components/CategoryManagement";
import { pageNumber } from "@/lib/api/pagination";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = pageNumber((await searchParams).page);
  return (
    <AdminBoundary returnTo={`/admin/categories?page=${page}`}>
      <CategoryManagement page={page} />
    </AdminBoundary>
  );
}
