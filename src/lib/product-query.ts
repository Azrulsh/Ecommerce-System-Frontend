import {
  productSorts,
  type ProductQuery,
  type ProductSort,
} from "../types/product.types";
type SearchParams = Record<string, string | string[] | undefined>;
function queryText(value: SearchParams[string]): string {
  return typeof value === "string"
    ? Array.from(value.replace(/[\u0000-\u001f\u007f]/g, "").trim())
        .slice(0, 255)
        .join("")
    : "";
}
export function parseProductQuery(params: SearchParams): ProductQuery {
  const sort =
    typeof params.sort === "string" &&
    productSorts.includes(params.sort as ProductSort)
      ? (params.sort as ProductSort)
      : "name_asc";
  const page =
    typeof params.page === "string" && /^[1-9]\d{0,8}$/.test(params.page)
      ? Number(params.page)
      : 1;
  return {
    search: queryText(params.search),
    category: queryText(params.category),
    sort,
    page,
    per_page: 12,
  };
}
export function productQueryString(query: ProductQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}
export function productHref(query: ProductQuery): string {
  const params = productQueryString(query);
  return `/products${params ? `?${params}` : ""}`;
}
