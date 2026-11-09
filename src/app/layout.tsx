import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CommerceProvider } from "@/features/cart/components/CommerceProvider";
import { CommerceNotice } from "@/features/cart/components/CommerceNotice";
import { WishlistProvider } from "@/features/wishlist/components/WishlistProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Everyday — Good finds. Better everydays.",
    template: "%s | Everyday",
  },
  description:
    "Discover essentials for your space, your style, and everything in between. Explore the Everyday collection.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <CommerceProvider>
          <WishlistProvider>
            <Header />
            <CommerceNotice />
            <main id="main-content" className="flex-1" tabIndex={-1}>
              {children}
            </main>
            <Footer />
          </WishlistProvider>
        </CommerceProvider>
      </body>
    </html>
  );
}
