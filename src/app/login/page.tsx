import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/components/AuthForm";
import { safeReturnTo } from "@/features/auth/validation";
export const metadata: Metadata = { title: "Sign in" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AuthForm
      registration={false}
      returnTo={safeReturnTo((await searchParams).next)}
    />
  );
}
