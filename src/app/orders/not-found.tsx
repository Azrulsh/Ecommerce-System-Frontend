import Link from "next/link";
export default function OrderNotFound() {
  return (
    <div className="page-width py-16">
      <h1 className="text-3xl font-medium">This order is unavailable</h1>
      <p className="mt-4 text-sm text-slate-600">
        Check the order link or return to your order history.
      </p>
      <Link href="/orders" className="text-link mt-5 inline-block">
        Order history
      </Link>
    </div>
  );
}
