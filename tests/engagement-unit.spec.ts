import { expect, test } from "@playwright/test";
import {
  parseWishlistItem,
  parseWishlistPage,
  wishlistInput,
} from "../src/features/wishlist/validation";
import {
  parseReview,
  parseReviewPage,
  reviewInput,
} from "../src/features/reviews/validation";
import { pageNumber, parsePage, resourceId } from "../src/lib/api/pagination";
import { safeReturnTo } from "../src/features/auth/validation";
import { requestJson } from "../src/lib/api/request";
import { sampleCart } from "./support/purchase-samples";

const product = sampleCart().items[0].product!;
const wish = {
  id: 1,
  product_id: product.id,
  is_available: true,
  product,
  created_at: null,
};
const review = {
  id: 1,
  product_id: 1,
  rating: 4,
  comment: null,
  reviewer: { id: 2, name: "Public name", email: "private@example.test" },
  created_at: null,
  updated_at: null,
};
const meta = {
  current_page: 1,
  last_page: 1,
  per_page: 5,
  total: 1,
  from: 1,
  to: 1,
};
test("wishlist validation retains removable unavailable products without claiming stock availability", () => {
  expect(
    parseWishlistItem({ ...wish, product: { ...product, stock_quantity: 0 } })
      .is_available,
  ).toBe(true);
  expect(
    parseWishlistItem({ ...wish, is_available: false, product: null }).product,
  ).toBeNull();
  expect(() => parseWishlistItem({ ...wish, product_id: 99 })).toThrow();
  expect(() =>
    parseWishlistItem({ ...wish, is_available: true, product: null }),
  ).toThrow();
  expect(() =>
    parseWishlistItem({ ...wish, product: { ...product, price: 10 } }),
  ).toThrow();
});
test("wishlist page rejects duplicate products and inconsistent pagination", () => {
  expect(parseWishlistPage({ data: [wish], meta }).meta.total).toBe(1);
  expect(() =>
    parseWishlistPage({
      data: [wish, { ...wish, id: 2 }],
      meta: { ...meta, total: 2, to: 2 },
    }),
  ).toThrow();
  expect(() =>
    parseWishlistPage({ data: [wish], meta: { ...meta, from: 2 } }),
  ).toThrow();
});
test("wishlist browser input cannot forge identity, target URLs or invalid product IDs", () => {
  expect(wishlistInput({ action: "save", productId: 1 })).toEqual({
    action: "save",
    productId: 1,
  });
  for (const data of [
    { action: "toggle", productId: 1 },
    { action: "save", productId: 0 },
    { action: "remove", productId: 1, user_id: 2 },
    { action: "save", productId: "1" },
    { action: "save", productId: 1, url: "https://evil.test" },
  ])
    expect(() => wishlistInput(data)).toThrow();
});
test("review input matches integer rating, optional comment and Unicode character limits", () => {
  expect(reviewInput({ rating: 5 })).toEqual({ rating: 5, comment: null });
  expect(reviewInput({ rating: 1, comment: null }).comment).toBeNull();
  expect(
    reviewInput({ rating: 3, comment: "😀".repeat(5000) }).comment,
  ).toHaveLength(10000);
  for (const rating of [0, 6, 2.5, "4", null, Infinity])
    expect(() => reviewInput({ rating })).toThrow();
  for (const comment of [true, {}, "x".repeat(5001)])
    expect(() => reviewInput({ rating: 4, comment })).toThrow();
});
test("review validation rejects forged ownership and mutation fields", () => {
  for (const field of [
    "user_id",
    "product_id",
    "is_verified",
    "reviewer",
    "status",
  ])
    expect(() => reviewInput({ rating: 4, [field]: 1 })).toThrow();
  expect(() => reviewInput({ comment: "Missing rating" })).toThrow();
});
test("review projection excludes private reviewer fields and retains text literally", () => {
  const parsed = parseReview({
    ...review,
    comment: '<img src=x onerror="alert(1)">',
  });
  expect(parsed.reviewer).toEqual({ id: 2, name: "Public name" });
  expect(parsed.comment).toContain("<img");
  expect(() => parseReview({ ...review, rating: 6 })).toThrow();
  expect(() => parseReview({ ...review, reviewer: null })).toThrow();
});
test("review summary comes from Laravel, never a partial page average", () => {
  const result = parseReviewPage({
    data: [review],
    meta: { ...meta, total: 20, last_page: 4 },
    summary: { average_rating: "2.35", review_count: 20 },
  });
  expect(result.summary.average_rating).toBe("2.35");
  for (const average_rating of ["5.01", "NaN", 4, "0.00"])
    expect(() =>
      parseReviewPage({
        data: [review],
        meta,
        summary: { average_rating, review_count: 1 },
      }),
    ).toThrow();
});
test("empty and out-of-range review pages remain distinguishable", () => {
  const emptyMeta = { ...meta, total: 0, from: null, to: null };
  expect(
    parseReviewPage({
      data: [],
      meta: emptyMeta,
      summary: { average_rating: null, review_count: 0 },
    }).summary.average_rating,
  ).toBeNull();
  expect(
    parsePage(
      { data: [], meta: { ...meta, current_page: 2, from: null, to: null } },
      parseReview,
    ).meta.total,
  ).toBe(1);
  expect(() =>
    parsePage(
      { data: [review], meta: { ...meta, per_page: 101 } },
      parseReview,
    ),
  ).toThrow();
});
test("wishlist redirect allowlist preserves pagination and rejects external or mutation routes", () => {
  expect(safeReturnTo("/wishlist?page=2")).toBe("/wishlist?page=2");
  for (const path of [
    "//evil.test/wishlist",
    "/api/wishlist",
    "/wishlist/../api/wishlist",
    "/wishlist%0a",
    "/wishlist\\evil",
    "/login?next=/wishlist",
  ])
    expect(safeReturnTo(path)).toBe("/cart");
  expect(pageNumber("2")).toBe(2);
  expect(pageNumber("999999999999")).toBe(1);
  expect(() => resourceId("1/../../user")).toThrow();
});
test("review upstream validation errors expose field names but never diagnostics", async () => {
  const fetcher: typeof fetch = async () =>
    Response.json(
      {
        message: "secret",
        errors: {
          rating: ["private"],
          comment: ["private"],
          token: ["secret"],
        },
      },
      { status: 422 },
    );
  await expect(
    requestJson(
      { baseUrl: "https://api.example/api", timeoutMs: 1000 },
      "products/1/reviews",
      parseReview,
      fetcher,
      { method: "POST", body: { rating: 4 } },
    ),
  ).rejects.toMatchObject({
    code: "validation",
    fieldNames: ["rating", "comment"],
  });
});
