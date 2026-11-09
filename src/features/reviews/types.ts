import type { Page } from "@/lib/api/pagination";
export interface Review {
  id: number;
  product_id: number;
  rating: number;
  comment: string | null;
  reviewer: { id: number; name: string };
  created_at: string | null;
  updated_at: string | null;
}
export interface ReviewPage extends Page<Review> {
  summary: { average_rating: string | null; review_count: number };
}
export interface ReviewInput {
  rating: number;
  comment: string | null;
}
