"use client";
import { Button } from "@/components/ui/button";
import { CloudOff } from "lucide-react";
export default function ErrorPage({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="page-width py-20 text-center">
      <CloudOff
        className="mx-auto mb-5 text-teal-700"
        size={36}
        aria-hidden="true"
      />
      <h1 className="text-3xl font-medium tracking-tight">
        Something needs a moment
      </h1>
      <p className="mt-4 text-sm text-slate-500">
        We couldn’t load this page. Please try again.
      </p>
      <Button onClick={() => retry()} className="mt-7">
        Try again
      </Button>
    </div>
  );
}
