import { expect, test } from "@playwright/test";
import {
  parseProductQuery,
  productQueryString,
} from "../src/lib/product-query";
import {
  InvalidApiResponse,
  parseCategories,
  parseProductPrice,
  parseProducts,
} from "../src/lib/api/validation";

test("query input is bounded, scalar, allowlisted and safely encoded", () => {
  const query = parseProductQuery({
    search: " \u0000hello & category=bad ",
    category: ["untrusted"],
    sort: "price_desc; DROP",
    page: "-1",
  });
  expect(query).toEqual({
    search: "hello & category=bad",
    category: "",
    sort: "name_asc",
    page: 1,
    per_page: 12,
  });
  const encoded = new URLSearchParams(productQueryString(query));
  expect(encoded.get("search")).toBe("hello & category=bad");
  expect(encoded.has("category")).toBeFalsy();
  expect(parseProductQuery({ search: "a".repeat(300) }).search).toHaveLength(
    255,
  );
  expect(parseProductQuery({ page: "999999999999999999999" }).page).toBe(1);
});

test("response validators reject invalid envelopes and monetary values", () => {
  for (const input of [null, [], { data: "wrong" }, { data: [{ id: "1" }] }]) {
    expect(() => parseCategories(input)).toThrow(InvalidApiResponse);
  }
  expect(() => parseProducts({ data: [], meta: { current_page: -1 } })).toThrow(
    InvalidApiResponse,
  );
  const price = {
    product_id: 1,
    original_price: "10.00",
    discount_amount: "0.00",
    final_price: "10.00",
    applied_discount: null,
  };
  expect(parseProductPrice({ data: price })).toEqual(price);
  for (const value of [10, "NaN", "Infinity", "-1.00", "1.001", "<script>"]) {
    expect(() =>
      parseProductPrice({ data: { ...price, final_price: value } }),
    ).toThrow(InvalidApiResponse);
  }
});
