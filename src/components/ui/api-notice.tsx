import { CloudOff } from "lucide-react";
import { buttonVariants } from "./button";

export function ApiNotice({
  title = "The collection is taking a moment",
  message = "We couldn’t load the latest products. Please try again in a moment.",
  href,
}: {
  title?: string;
  message?: string;
  href: string;
}) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-slate-200 bg-white p-8 text-center sm:p-12"
    >
      <CloudOff
        className="mx-auto mb-4 text-teal-700"
        size={32}
        aria-hidden="true"
      />
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
        {message}
      </p>
      <a
        href={href}
        className={buttonVariants({ variant: "outline", className: "mt-6" })}
      >
        Try again
      </a>
    </div>
  );
}
