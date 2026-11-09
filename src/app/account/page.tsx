import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { serverIdentity } from "@/features/auth/server/session";
import { AccountActions } from "@/features/auth/components/AccountActions";
import { AccountGate } from "@/features/auth/components/AccountGate";
import { ApiNotice } from "@/components/ui/api-notice";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};
export default async function AccountPage() {
  const identity = await serverIdentity().then(
    (value) => ({ ok: true as const, value }),
    () => ({ ok: false as const }),
  );
  if (!identity.ok)
    return (
      <div className="page-width py-14">
        <ApiNotice
          href="/account"
          title="Your account is temporarily unavailable"
        />
      </div>
    );
  if (!identity.value) redirect("/login?next=%2Faccount");
  return (
    <AccountGate userId={identity.value.user.id}>
      <div className="page-width py-14">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8">
          <p className="eyebrow">Welcome to your Everyday</p>
          <h1 className="text-3xl font-medium">Your account</h1>
          <dl className="my-7 space-y-4 text-sm">
            <div>
              <dt className="font-semibold text-slate-500">Name</dt>
              <dd className="mt-1 break-words">{identity.value.user.name}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Email</dt>
              <dd className="mt-1 break-words">{identity.value.user.email}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3">
            <Link href="/cart" className={buttonVariants()}>
              View your cart
            </Link>
            <AccountActions />
          </div>
          <p className="mt-6 text-xs leading-6 text-slate-500">
            Sign in to access your private account details and saved cart.
            Checkout and order management are planned for a later phase.
          </p>
        </div>
      </div>
    </AccountGate>
  );
}
