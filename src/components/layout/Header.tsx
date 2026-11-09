"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingBag, Asterisk, Menu, X, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCommerce } from "@/features/cart/components/CommerceProvider";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const commerce = useCommerce();
  const count = commerce.session?.user
    ? (commerce.cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0)
    : commerce.guest.items.reduce((sum, item) => sum + item.quantity, 0);
  const signOut = () =>
    void commerce
      .logout()
      .then(() => {
        router.replace("/cart");
        router.refresh();
      })
      .catch(() => undefined);
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
        <div className="flex items-center gap-2">
          <Link
            href="/cart"
            prefetch={false}
            aria-label={
              commerce.loading ? "Cart, loading" : `Cart, ${count} items`
            }
            className="relative flex min-h-11 min-w-11 items-center justify-center rounded-lg text-teal-800 hover:bg-teal-50"
          >
            <ShoppingBag size={21} aria-hidden="true" />
            <span
              data-testid="cart-count"
              className="absolute -right-1 -top-1 min-w-5 rounded-full bg-teal-700 px-1 text-center text-[10px] leading-5 text-white"
            >
              {commerce.loading ? "…" : count}
            </span>
          </Link>
          <Link
            href={commerce.session?.user ? "/account" : "/login"}
            prefetch={false}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "hidden sm:inline-flex",
            )}
          >
            <UserRound size={15} aria-hidden="true" />
            {commerce.loading
              ? "Please wait"
              : commerce.session?.user
                ? "Account"
                : "Sign in"}
          </Link>
          {commerce.session?.user && (
            <Button
              variant="ghost"
              size="sm"
              disabled={commerce.busy || commerce.loading}
              className="hidden md:inline-flex"
              onClick={signOut}
            >
              Sign out
            </Button>
          )}
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
        <Link
          href={commerce.session?.user ? "/account" : "/login"}
          prefetch={false}
          onClick={() => setOpen(false)}
          className="block rounded-lg px-3 py-3 text-sm font-medium text-teal-800"
        >
          {commerce.session?.user ? "Your account" : "Sign in / register"}
        </Link>
        {commerce.session?.user && (
          <Button
            variant="ghost"
            disabled={commerce.busy}
            onClick={() => {
              setOpen(false);
              signOut();
            }}
          >
            Sign out
          </Button>
        )}
      </nav>
    </header>
  );
}
