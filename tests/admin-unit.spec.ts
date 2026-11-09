import { expect, test } from "@playwright/test";
import {
  adminConflict,
  assignmentInput,
  categoryInput,
  dateFilters,
  decimalInput,
  discountInput,
  parseAccess,
  parseAdminOrder,
  parseCategoryPage,
  parseCreatedDiscount,
  parseDiscount,
  parseSummary,
  productInput,
  statusInput,
} from "../src/features/admin/validation";
import { safeReturnTo } from "../src/features/auth/validation";
import { requestJson } from "../src/lib/api/request";
import { formatMoney } from "../src/lib/format";
import { sampleOrder } from "./support/purchase-samples";
const product = {
  name: "Test",
  sku: "T-1",
  category_id: 1,
  price: "9999999999.99",
  stock_quantity: 4294967295,
  is_active: true,
};
const discount = {
  id: 1,
  name: "Sale",
  type: "percentage",
  value: "10.00",
  is_active: true,
  requires_loyalty: false,
  starts_at: null,
  expires_at: null,
  product_ids: [1, 2],
};
const report = {
  total_orders: 2,
  completed_orders: 1,
  cancelled_orders: 1,
  orders_by_status: {
    placed: 0,
    processing: 0,
    shipped: 0,
    completed: 1,
    cancelled: 1,
  },
  gross_sales: "1999999999999999.99",
  discounts_given: "0.01",
  net_sales: "1999999999999999.98",
  top_selling_products: [
    {
      sku: "OLD",
      product_name: "Recorded name",
      quantity_sold: 5,
      revenue: "1999999999999999.98",
    },
  ],
};
test("admin capability requires a literal server confirmation, never a role-shaped object", () => {
  expect(parseAccess({ allowed: true, userId: 2 })).toEqual({
    allowed: true,
    userId: 2,
  });
  for (const value of [
    { allowed: "true", userId: 2 },
    { is_admin: true, userId: 2 },
    { allowed: false, userId: 2 },
    { allowed: true, userId: "2" },
  ])
    expect(() => parseAccess(value)).toThrow();
});
test("product input accepts exact decimal strings and unsigned stock limits", () => {
  expect(productInput(product).price).toBe("9999999999.99");
  expect(productInput({ stock_quantity: 0 }, true)).toEqual({
    stock_quantity: 0,
  });
  for (const stock_quantity of [-1, 4294967296, 1.5, "2", Infinity])
    expect(() => productInput({ ...product, stock_quantity })).toThrow();
});
test("admin price input rejects floating values, signs, exponents and excess precision", () => {
  for (const value of [1, "-1", "1e3", "1.001", "10000000000.00", "NaN", null])
    expect(() => decimalInput(value)).toThrow();
  for (const value of ["0", "0.01", "100.0"])
    expect(decimalInput(value)).toBe(value);
});
test("product patches cannot submit ownership, role, URL or unsupported fields", () => {
  for (const key of ["user_id", "is_admin", "url", "discount_amount", "id"])
    expect(() => productInput({ name: "Changed", [key]: 1 }, true)).toThrow();
  expect(() => productInput({}, true)).toThrow();
  expect(
    productInput({ ...product, name: "😀".repeat(255) }).name,
  ).toHaveLength(510);
});
test("category validation uses unique-slug syntax and rejects identity assignment", () => {
  expect(
    categoryInput({
      name: "Outdoor",
      slug: "outdoor-living",
      description: null,
    }).slug,
  ).toBe("outdoor-living");
  for (const slug of ["UPPER", "bad_slug", "-bad", "bad--slug"])
    expect(() => categoryInput({ name: "X", slug })).toThrow();
  expect(() =>
    categoryInput({ name: "X", slug: "x", is_admin: true }),
  ).toThrow();
});
test("discount response distinguishes unloaded create assignments from loaded detail contracts", () => {
  const { product_ids, ...created } = discount;
  expect(parseCreatedDiscount({ data: created }).product_ids).toEqual([]);
  expect(() => parseDiscount(created)).toThrow();
  expect(() => parseDiscount({ ...discount, product_ids: [1, 1] })).toThrow();
  expect(parseDiscount(discount).product_ids).toEqual(product_ids);
});
test("discount input validates strategy fields without calculating selling prices", () => {
  const { id, product_ids, ...fields } = discount;
  expect(discountInput(fields).value).toBe("10.00");
  expect(id).toBe(1);
  expect(product_ids).toHaveLength(2);
  for (const changes of [
    { type: "coupon" },
    { is_active: "true" },
    { starts_at: "bad" },
    { code: "FAKE" },
    { value: 12 },
  ])
    expect(() => discountInput({ ...fields, ...changes })).toThrow();
});
test("discount assignments are distinct positive IDs with a bounded batch", () => {
  expect(assignmentInput({ product_ids: [1, 2] })).toEqual({
    product_ids: [1, 2],
  });
  for (const product_ids of [
    [],
    [1, 1],
    [0],
    ["2"],
    Array.from({ length: 1001 }, (_, i) => i + 1),
  ])
    expect(() => assignmentInput({ product_ids })).toThrow();
});
test("order status requests reject financial fields and simulation controls", () => {
  expect(statusInput({ status: "cancelled" })).toEqual({ status: "cancelled" });
  for (const data of [
    { status: "paid" },
    { status: "cancelled", simulation: "success" },
    { status: "cancelled", stock_restored_at: "now" },
    { status: "processing", grand_total: "0.00" },
  ])
    expect(() => statusInput(data)).toThrow();
});
test("report filters use real UTC dates, inclusive ranges and known statuses", () => {
  expect(
    dateFilters(
      new URLSearchParams(
        "from_date=2026-01-01&to_date=2026-01-31&status=placed&url=https://evil.test",
      ),
      true,
    ),
  ).toBe("from_date=2026-01-01&to_date=2026-01-31&status=placed");
  for (const query of [
    "from_date=2026-02-30",
    "from_date=2026-02-01&to_date=2026-01-01",
    "status=paid",
    "from_date=bad",
  ])
    expect(() => dateFilters(new URLSearchParams(query), true)).toThrow();
});
test("summary contracts retain exact monetary strings and backend snapshot rankings", () => {
  expect(parseSummary({ data: report }).net_sales).toBe(report.net_sales);
  expect(formatMoney(report.net_sales)).toContain(".98");
  expect(
    parseSummary({ data: report }).top_selling_products[0].product_name,
  ).toBe("Recorded name");
  for (const changes of [
    { net_sales: 10 },
    { total_orders: 3 },
    { completed_orders: 0 },
    { top_selling_products: Array(11).fill(report.top_selling_products[0]) },
  ])
    expect(() => parseSummary({ data: { ...report, ...changes } })).toThrow();
});
test("admin orders preserve snapshots and safely represent existing failed payments", () => {
  const order = sampleOrder();
  expect(
    parseAdminOrder({
      ...order,
      payment: { ...order.payment, status: "failed" },
    }).payment?.status,
  ).toBe("failed");
  expect(() =>
    parseAdminOrder({ ...order, payment: { ...order.payment, order_id: 999 } }),
  ).toThrow();
  expect(parseAdminOrder(order).items).toEqual(order.items);
});
test("admin pagination validates shape and return destinations exclude privileged API paths", () => {
  expect(() => parseCategoryPage({ data: [], meta: {} })).toThrow();
  for (const path of [
    "/admin",
    "/admin/products/new",
    "/admin/discounts/1",
    "/admin/orders/2?status=placed",
  ])
    expect(safeReturnTo(path)).toBe(path);
  for (const path of [
    "/admin/users",
    "/api/admin/products",
    "//evil.test/admin",
    "/admin/../api/admin",
    "/admin/products/0",
  ])
    expect(safeReturnTo(path)).toBe("/cart");
});
test("only reviewed inventory conflicts project a manual-resolution message", () => {
  expect(
    adminConflict(409, {
      message: "Cannot restore stock for a hard-deleted product.",
    })?.code,
  ).toBe("admin_resolution_required");
  expect(adminConflict(409, { message: "PRIVATE DIAGNOSTIC" })).toBeUndefined();
  expect(
    adminConflict(503, {
      message: "Cannot restore stock for a hard-deleted product.",
    }),
  ).toBeUndefined();
});
test("admin upstream validation projects field names and discards diagnostic values", async () => {
  const fetcher: typeof fetch = async () =>
    Response.json(
      {
        message: "secret",
        errors: {
          sku: ["secret"],
          price: ["secret"],
          token: ["secret"],
          is_admin: ["secret"],
        },
      },
      { status: 422 },
    );
  await expect(
    requestJson(
      { baseUrl: "https://api.example/api", timeoutMs: 1000 },
      "products",
      (value) => value,
      fetcher,
      { method: "POST", body: product },
    ),
  ).rejects.toMatchObject({ code: "validation", fieldNames: ["sku", "price"] });
});
