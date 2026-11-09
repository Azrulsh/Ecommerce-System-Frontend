"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCommerce } from "@/features/cart/components/CommerceProvider";
import { CustomerError } from "@/components/ui/customer-feedback";
import { Button } from "@/components/ui/button";
import { useAdminAccess } from "./AdminAccessProvider";
export function AdminFrame({
  userId,
  children,
}: {
  userId: number;
  children: React.ReactNode;
}) {
  const access = useAdminAccess();
  const commerce = useCommerce();
  const path = usePathname();
  const router = useRouter();
  if (commerce.session?.user?.id !== userId)
    return (
      <div className="page-width py-12">
        <p role="status">
          {commerce.loading
            ? "Verifying store access…"
            : "Your session changed. Reload to verify store access."}
        </p>
        {!commerce.loading && (
          <Button className="mt-4" onClick={() => router.refresh()}>
            Reload store access
          </Button>
        )}
      </div>
    );
  if (access.error)
    return (
      <div className="page-width py-12">
        <h1 className="text-2xl font-medium">
          {access.error.code === "forbidden"
            ? "Administrator access required"
            : "Store access could not be verified"}
        </h1>
        <CustomerError
          error={access.error}
          retry={access.refresh}
          returnTo={path}
        />
      </div>
    );
  const links = [
    ["/admin", "Overview & reports"],
    ["/admin/products", "Products & stock"],
    ["/admin/categories", "Categories"],
    ["/admin/discounts", "Discounts"],
    ["/admin/orders", "Orders"],
  ];
  return (
    <div className="page-width py-8 sm:py-12">
      {access.checking && (
        <p role="status" className="mb-5">
          Verifying administrator access…
        </p>
      )}
      <div hidden={!access.allowed || access.checking}>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 max-w-full">
            <p className="eyebrow">Everyday administration</p>
            <p className="mt-1 break-words text-sm text-slate-500">
              Store management · {commerce.session.user.name}
            </p>
          </div>
          <Link className="text-link" href="/account">
            Account & sign out
          </Link>
        </div>
        <div className="grid min-w-0 items-start gap-7 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <nav
            aria-label="Store management"
            className="flex flex-wrap gap-2 rounded-2xl border border-teal-100 bg-white p-3 lg:flex-col"
          >
            {links.map(([href, label]) => (
              <Link
                key={href}
                prefetch={false}
                className="rounded-lg px-3 py-3 text-sm text-teal-900 hover:bg-teal-50 aria-[current=page]:bg-teal-50 aria-[current=page]:font-semibold"
                aria-current={
                  (href === "/admin" ? path === href : path.startsWith(href))
                    ? "page"
                    : undefined
                }
                href={href}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
