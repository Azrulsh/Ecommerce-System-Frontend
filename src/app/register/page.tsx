import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/components/AuthForm";
import { safeReturnTo } from "@/features/auth/validation";
export const metadata: Metadata = { title: "Create account" };
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AuthForm registration returnTo={safeReturnTo((await searchParams).next)} />
  );
}
