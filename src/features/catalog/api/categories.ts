import "server-only";
import { apiGet } from "@/lib/api/client";
import { parseCategories } from "./validation";
export function getCategories() {
  return apiGet("categories", parseCategories);
}
