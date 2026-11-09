import Link from "next/link";
import { Asterisk, ArrowUpRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="page-width flex flex-col justify-between gap-7 py-10 sm:flex-row sm:items-center">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xl font-bold tracking-tight text-teal-950"
          >
            <Asterisk size={24} aria-hidden="true" />
            everyday.
          </Link>
          <p className="mt-2 text-sm text-slate-500">
            Good finds. Better everydays.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <Link href="/products" className="text-link">
            Explore the collection <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          <p className="text-xs text-slate-500">
            Good finds, saved for your everyday
          </p>
        </div>
      </div>
    </footer>
  );
}
