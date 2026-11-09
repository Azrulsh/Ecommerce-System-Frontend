"use client";
import { useEffect, useRef, useState } from "react";
import { useCommerce } from "@/features/cart/components/CommerceProvider";
import {
  browserAuthLock,
  browserRequest,
  parseMessage,
} from "@/lib/bff/browser-client";
import { ApiError } from "@/lib/api/errors";
import { parseReviewPage, parseReviewResponse } from "./validation";
import type { Review, ReviewInput, ReviewPage } from "./types";
export function useProductReviews({ productId }: { productId: number }) {
  const commerce = useCommerce();
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: ReviewPage;
    error?: ApiError;
  } | null>(null);
  const queryKey = `${productId}:${page}:${version}`;
  const [notice, setNotice] = useState<{ key: string; text: string } | null>(
    null,
  );
  const identity = `${commerce.session?.user?.id}:${commerce.session?.csrfToken}`;
  const currentIdentity = useRef(identity);
  useEffect(() => {
    currentIdentity.current = commerce.loading ? "" : identity;
    return () => {
      currentIdentity.current = "";
    };
  }, [identity, commerce.loading]);
  const returnTo = `/products/${productId}`;
  useEffect(() => {
    let live = true;
    void browserRequest(
      `/api/products/${productId}/reviews?page=${page}`,
      parseReviewPage,
    ).then(
      (data) => {
        if (live) setResult({ key: queryKey, data });
      },
      (failure: unknown) => {
        if (live)
          setResult({
            key: queryKey,
            error:
              failure instanceof ApiError ? failure : new ApiError("network"),
          });
      },
    );
    return () => {
      live = false;
    };
  }, [productId, page, queryKey]);
  const resultCurrent = result?.key === queryKey ? result : null;
  const reload = () => setVersion((version) => version + 1);
  async function mutate(
    action: "create" | "update" | "delete",
    review?: Review,
    body?: ReviewInput,
  ) {
    const session = commerce.session;
    if (!identity || !session?.user) throw new ApiError("unauthenticated", 401);
    await browserAuthLock(async () => {
      if (currentIdentity.current !== identity)
        throw new ApiError("unauthenticated", 401);
      const path =
        action === "create"
          ? `/api/products/${productId}/reviews`
          : `/api/reviews/${review!.id}`;
      if (action === "delete")
        await browserRequest(path, parseMessage, session.csrfToken, { action });
      else {
        const result = await browserRequest(
          path,
          parseReviewResponse,
          session.csrfToken,
          action === "create" ? body : { action, ...body },
        );
        if (
          result.product_id !== productId ||
          result.reviewer.id !== session.user!.id ||
          (review && result.id !== review.id)
        )
          throw new ApiError("invalid_response");
      }
    }).catch((error: unknown) => {
      if (
        currentIdentity.current === identity &&
        error instanceof ApiError &&
        error.code === "unauthenticated"
      )
        void commerce.refresh();
      throw error;
    });
    // Reviews are public: refresh confirmed changes even during revalidation.
    setPage(1);
    reload();
    if (currentIdentity.current !== identity) return;
    setNotice({
      key: identity,
      text:
        action === "delete"
          ? "Review deleted."
          : action === "create"
            ? "Your review was published."
            : "Your review was updated.",
    });
  }
  return {
    page,
    setPage,
    queryKey,
    identity,
    returnTo,
    reload,
    mutate,
    resultCurrent,
    notice,
    discovering: commerce.loading,
    user: commerce.session?.user,
  };
}
