import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetails } from "@/components/products/ProductDetails";
import { ApiNotice } from "@/components/ui/api-notice";
import { ApiError } from "@/lib/api/client";
import { getProduct, getProductPrice } from "@/lib/api/products";

export const metadata: Metadata = { title: "Product details" };
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[1-9]\d{0,14}$/.test(id) || !Number.isSafeInteger(Number(id)))
    notFound();
  const [product, price] = await Promise.allSettled([
    getProduct(id),
    getProductPrice(id),
  ]);
  if (product.status === "rejected") {
    if (product.reason instanceof ApiError && product.reason.status === 404)
      notFound();
    return (
      <div className="page-width py-16">
        <ApiNotice
          title="This product is taking a moment"
          href={`/products/${id}`}
        />
      </div>
    );
  }
  if (String(product.value.id) !== id)
    return (
      <div className="page-width py-16">
        <ApiNotice href={`/products/${id}`} />
      </div>
    );
  return (
    <ProductDetails
      product={product.value}
      price={price.status === "fulfilled" ? price.value : null}
    />
  );
}
