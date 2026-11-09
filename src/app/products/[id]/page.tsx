import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetails } from "@/features/catalog/components/ProductDetails";
import { ApiNotice } from "@/components/ui/api-notice";
import { loadProductDetails } from "@/features/catalog/server/queries";

export const metadata: Metadata = { title: "Product details" };
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[1-9]\d{0,14}$/.test(id) || !Number.isSafeInteger(Number(id)))
    notFound();
  const result = await loadProductDetails(id);
  if (result.status === "not_found") notFound();
  if (result.status !== "available") {
    return (
      <div className="page-width py-16">
        <ApiNotice
          title="This product is taking a moment"
          href={`/products/${id}`}
        />
      </div>
    );
  }
  return <ProductDetails product={result.product} price={result.price} />;
}
