import "server-only";
import { apiGet } from "./client";
import { parseCategories } from "./validation";
export function getCategories() {
  return apiGet("categories", parseCategories);
}
