// Isolated wishlist/review contracts; no writes leave this fixture.
import { setTimeout as delay } from "node:timers/promises";
export function engagementFixture({ product, mode, users, body }) {
  let wishlists = new Map();
  let reviews = [];
  let nextWish = 1000;
  let nextReview = 2000;
  let calls = [];
  let catalogProducts = new Map();
  const lookup = async (id) =>
    catalogProducts.has(id)
      ? { product: catalogProducts.get(id) }
      : product(id);
  const page = (values, url) => {
    const current = Number(url.searchParams.get("page") ?? 1);
    const per = Number(url.searchParams.get("per_page") ?? 15);
    const data = values.slice((current - 1) * per, current * per);
    return {
      data,
      meta: {
        current_page: current,
        last_page: Math.max(1, Math.ceil(values.length / per)),
        per_page: per,
        total: values.length,
        from: data.length ? (current - 1) * per + 1 : null,
        to: data.length ? (current - 1) * per + data.length : null,
      },
    };
  };
  const publicReview = (review) => {
    const { userId, reviewerName, ...data } = review;
    return {
      ...data,
      reviewer: {
        id: userId,
        name:
          reviewerName ??
          users().find((user) => user.id === userId)?.name ??
          `Public reviewer ${userId}`,
      },
    };
  };
  async function available(id) {
    return (
      id !== mode().unavailableProduct &&
      id !== mode().deletedProduct &&
      (await lookup(id))
    );
  }
  return {
    reset(input) {
      // The test driver supplies validated public catalog reads, never DB fixtures.
      catalogProducts = new Map(
        (input.catalogProducts ?? []).map((value) => [value.id, value]),
      );
      wishlists = new Map(
        Object.entries(input.wishlists ?? {}).map(([id, products]) => [
          Number(id),
          products.map((productId) => ({
            id: nextWish++,
            product_id: productId,
            created_at: new Date().toISOString(),
          })),
        ]),
      );
      reviews = (input.reviews ?? []).map((value) => ({
        id: nextReview++,
        product_id: value.productId,
        userId: value.userId,
        rating: value.rating ?? 4,
        reviewerName: value.reviewerName,
        comment: value.comment ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      calls = [];
    },
    state: () => ({
      wishlists: Object.fromEntries(wishlists),
      reviews,
      engagementCalls: calls,
    }),
    async public(request, url, send) {
      const match = url.pathname.match(/^\/api\/products\/(\d+)\/reviews$/);
      if (!match || request.method !== "GET") return false;
      const id = Number(match[1]);
      if (mode().slowReviews) await delay(9000);
      if (mode().reviewsStatus) {
        send(mode().reviewsStatus, {
          message: "Internal fixture diagnostic must remain private.",
        });
        return true;
      }
      if (!(await available(id))) {
        send(404, {});
        return true;
      }
      if (mode().malformedReviews) {
        send(200, { data: "wrong" });
        return true;
      }
      const values = reviews
        .filter((review) => review.product_id === id)
        .toSorted((a, b) => b.id - a.id);
      send(200, {
        ...page(values.map(publicReview), url),
        summary: {
          average_rating: values.length
            ? (
                values.reduce((sum, value) => sum + value.rating, 0) /
                values.length
              ).toFixed(2)
            : null,
          review_count: values.length,
        },
      });
      return true;
    },
    async authenticated(request, url, userId, send) {
      const wishlist = url.pathname.match(
        /^\/api\/wishlist(?:\/items(?:\/(\d+))?)?$/,
      );
      if (wishlist) {
        if (mode().wishlistStatus) {
          send(mode().wishlistStatus, {
            message: "Internal fixture diagnostic must remain private.",
          });
          return true;
        }
        const values = wishlists.get(userId) ?? [];
        wishlists.set(userId, values);
        if (request.method === "GET") {
          const data = await Promise.all(
            values
              .toSorted((a, b) => b.id - a.id)
              .map(async (item) => ({
                ...item,
                is_available: !!(await available(item.product_id)),
                product:
                  mode().deletedProduct === item.product_id
                    ? null
                    : (await lookup(item.product_id))?.product
                      ? {
                          ...(await lookup(item.product_id)).product,
                          is_active:
                            mode().unavailableProduct !== item.product_id,
                        }
                      : null,
              })),
          );
          send(200, page(data, url));
          return true;
        }
        calls.push({ method: request.method, path: url.pathname, userId });
        if (request.method === "POST") {
          const input = await body(request);
          const value = await available(input.product_id);
          if (!value) {
            send(404, {});
            return true;
          }
          let item = values.find(
            (value) => value.product_id === input.product_id,
          );
          const status = item ? 200 : 201;
          if (!item) {
            item = {
              id: nextWish++,
              product_id: input.product_id,
              created_at: new Date().toISOString(),
            };
            values.push(item);
          }
          if (mode().dropWishlist) {
            request.socket.destroy();
            return true;
          }
          send(status, {
            data: { ...item, is_available: true, product: value.product },
          });
          return true;
        }
        const index = values.findIndex(
          (value) => value.product_id === Number(wishlist[1]),
        );
        if (index < 0) {
          send(404, {});
          return true;
        }
        values.splice(index, 1);
        send(204, null);
        return true;
      }
      const create = url.pathname.match(/^\/api\/products\/(\d+)\/reviews$/);
      const existing = url.pathname.match(/^\/api\/reviews\/(\d+)$/);
      if (!create && !existing) return false;
      calls.push({ method: request.method, path: url.pathname, userId });
      if (mode().reviewMutationStatus) {
        send(mode().reviewMutationStatus, {
          message: "Internal fixture diagnostic must remain private.",
        });
        return true;
      }
      if (create) {
        const input = await body(request);
        const productId = Number(create[1]);
        if (!(await available(productId))) {
          send(404, {});
          return true;
        }
        if (
          reviews.some(
            (review) =>
              review.product_id === productId && review.userId === userId,
          )
        ) {
          send(409, {});
          return true;
        }
        const review = {
          id: nextReview++,
          product_id: productId,
          userId,
          ...input,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        reviews.push(review);
        if (mode().dropReview) {
          request.socket.destroy();
          return true;
        }
        send(201, { data: publicReview(review) });
        return true;
      }
      const review = reviews.find(
        (review) =>
          review.id === Number(existing[1]) && review.userId === userId,
      );
      if (!review) {
        send(404, {});
        return true;
      }
      if (request.method === "DELETE") {
        reviews = reviews.filter((value) => value !== review);
        send(204, null);
        return true;
      }
      if (!(await available(review.product_id))) {
        send(404, {});
        return true;
      }
      Object.assign(review, await body(request), {
        updated_at: new Date().toISOString(),
      });
      send(200, { data: publicReview(review) });
      return true;
    },
  };
}
