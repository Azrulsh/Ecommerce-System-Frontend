"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Asterisk, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  const links = [
    { href: "/", label: "Home" },
    { href: "/products", label: "The collection" },
  ];
  return (
    <header className="relative z-20 border-b border-slate-200/80 bg-white">
      <div className="page-width flex h-20 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-2xl font-bold tracking-[-0.06em] text-teal-950"
          aria-label="Everyday home"
          onClick={() => setOpen(false)}
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-teal-700 text-white">
            <Asterisk size={27} aria-hidden="true" />
          </span>
          everyday<span className="text-teal-600">.</span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-8 sm:flex"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={
                (
                  link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href)
                )
                  ? "page"
                  : undefined
              }
              className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-700 aria-[current=page]:text-teal-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/products"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "hidden sm:inline-flex",
          )}
        >
          Find something good <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <Button
          ref={menuButton}
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
      </div>
      <nav
        id="mobile-nav"
        aria-label="Mobile navigation"
        hidden={!open}
        className="border-t border-slate-100 px-5 py-4 sm:hidden"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-3 text-sm font-medium text-teal-800"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
