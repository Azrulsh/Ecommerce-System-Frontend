import "server-only";
import { redirect } from "next/navigation";
import { serverIdentity } from "../server/session";
import { AccountGate } from "./AccountGate";
import { ApiNotice } from "@/components/ui/api-notice";
export async function CustomerBoundary({
  returnTo,
  children,
}: {
  returnTo: string;
  children: React.ReactNode;
}) {
  const identity = await serverIdentity().then(
    (value) => ({ ok: true as const, value }),
    () => ({ ok: false as const }),
  );
  if (!identity.ok)
    return (
      <div className="page-width py-14">
        <ApiNotice
          href={returnTo}
          title="Your account is temporarily unavailable"
        />
      </div>
    );
  if (!identity.value) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return (
    <AccountGate userId={identity.value.user.id} returnTo={returnTo}>
      {children}
    </AccountGate>
  );
}
