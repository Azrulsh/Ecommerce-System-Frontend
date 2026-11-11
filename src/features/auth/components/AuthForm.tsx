"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCommerce } from "@/features/cart/components/CommerceProvider";
import { ApiError } from "@/lib/api/errors";
import { parseCredentials, safeReturnTo } from "../validation";
import type { AuthFields } from "../types";

export function AuthForm({
  registration,
  returnTo,
}: {
  registration: boolean;
  returnTo: string;
}) {
  const commerce = useCommerce();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const errorSummary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message) errorSummary.current?.focus();
  }, [message]);
  const next = safeReturnTo(returnTo);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage("");
    setFields([]);
    const form = new FormData(event.currentTarget);
    try {
      const credentials = parseCredentials(
        {
          email: form.get("email"),
          password: form.get("password"),
          ...(registration
            ? {
                name: form.get("name"),
                password_confirmation: form.get("password_confirmation"),
              }
            : {}),
        },
        registration,
      );
      const hasGuest = await commerce.signIn(credentials, registration);
      router.replace(
        hasGuest
          ? `/cart?import=review&next=${encodeURIComponent(next)}`
          : next,
      );
      router.refresh();
    } catch (failure) {
      if (failure instanceof ApiError) {
        setFields([...(failure.fieldNames ?? [])]);
        setMessage(
          failure.code === "validation"
            ? registration
              ? "Please check your registration details. Use a valid email and matching passwords of 12–72 bytes with uppercase, lowercase and a number."
              : "Please check your email and password. The credentials may be incorrect."
            : failure.message,
        );
      } else setMessage("Unable to sign in right now. Please retry.");
    } finally {
      setSubmitting(false);
    }
  }
  const field = (
    name: AuthFields,
    label: string,
    type: string,
    autoComplete: string,
  ) => (
    <div>
      <label htmlFor={name} className="field-label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        aria-invalid={fields.includes(name)}
        aria-describedby={fields.includes(name) ? "auth-message" : undefined}
        maxLength={name.startsWith("password") ? 72 : 255}
        minLength={name.startsWith("password") && registration ? 12 : undefined}
        className="field"
      />
      {fields.includes(name) && (
        <p className="mt-2 text-xs text-rose-700">Please check this field.</p>
      )}
    </div>
  );
  return (
    <div className="page-width py-12 sm:py-20">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <p className="eyebrow">Your everyday, saved</p>
        <h1 className="text-3xl font-medium tracking-tight">
          {registration ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {registration
            ? "Save your cart and pick up where you left off."
            : "Sign in to access your saved account cart."}{" "}
          Guest items stay on this browser until you review their import.
        </p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          {registration && field("name", "Name", "text", "name")}
          {field("email", "Email address", "email", "email")}
          {field(
            "password",
            "Password",
            "password",
            registration ? "new-password" : "current-password",
          )}
          {registration && (
            <>
              <p className="text-xs leading-5 text-slate-500">
                Use at least 12 characters, uppercase, lowercase and a number.
                Maximum 72 UTF-8 bytes.
              </p>
              {field(
                "password_confirmation",
                "Confirm password",
                "password",
                "new-password",
              )}
            </>
          )}
          {message && (
            <p
              id="auth-message"
              ref={errorSummary}
              tabIndex={-1}
              role="alert"
              className="rounded-lg bg-rose-50 p-3 text-sm leading-6 text-rose-800"
            >
              {message}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={
              commerce.loading ||
              !commerce.session ||
              commerce.busy ||
              submitting
            }
          >
            {submitting
              ? "Please wait…"
              : registration
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>
        {!commerce.session && !commerce.loading && (
          <div className="mt-4 text-sm text-slate-600">
            <p>Secure sign-in is temporarily unavailable.</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => void commerce.refresh()}
            >
              Retry connection
            </Button>
          </div>
        )}
        <p className="mt-6 text-sm text-slate-600">
          {registration ? "Already have an account?" : "New to Everyday?"}{" "}
          <Link
            href={`${registration ? "/login" : "/register"}?next=${encodeURIComponent(next)}`}
            className="font-semibold text-teal-700 underline-offset-4 hover:underline"
          >
            {registration ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <Link
          href="/products"
          className="mt-5 inline-block text-sm text-slate-500 underline underline-offset-4"
        >
          Continue browsing
        </Link>
      </div>
    </div>
  );
}
