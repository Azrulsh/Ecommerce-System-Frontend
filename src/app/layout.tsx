import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { connection } from "next/server";
import { Footer } from "@/components/layout/Footer";
import { CommerceProvider } from "@/features/cart/components/CommerceProvider";
import { CommerceNotice } from "@/features/cart/components/CommerceNotice";
import { WishlistProvider } from "@/features/wishlist/components/WishlistProvider";
import { AdminAccessProvider } from "@/features/admin/components/AdminAccessProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Everyday — Good finds. Better everydays.",
    template: "%s | Everyday",
  },
  description:
    "Discover essentials for your space, your style, and everything in between. Explore the Everyday collection.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Nonces need request-time rendering, including otherwise static pages.
  await connection();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <CommerceProvider>
          <WishlistProvider>
            <AdminAccessProvider>
              <Header />
              <CommerceNotice />
              <main id="main-content" className="flex-1" tabIndex={-1}>
                {children}
              </main>
              <Footer />
            </AdminAccessProvider>
          </WishlistProvider>
        </CommerceProvider>
      </body>
    </html>
  );
}
