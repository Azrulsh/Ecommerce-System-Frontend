# Laravel contract inventory for future frontend phases

Inspected on 9 November 2026. Paths below are relative to `/api`. This is an implementation inventory, not a claim that future modules were implemented or that authenticated workflows were exercised. No backend source, configuration or data was changed.

## Response and authorization conventions

- JSON Resources use `data` envelopes; paginated collections add `links` and `meta`. Auth token responses explicitly wrap `user`, `token_type` and `token` inside `data`.
- Monetary resource values use decimal strings. Product/catalog currency is not an explicit field; backend documentation uses MYR, and order resources explicitly include `currency`.
- Error status matters: 401 unauthenticated, 403 forbidden, 404 unavailable or ownership hidden, 409 business conflict, 422 validation, 429 throttling. Live 422 returned `{ message, errors: { sort: string[] } }`. Do not surface arbitrary raw backend messages.
- `auth:sanctum` protects customer endpoints. Ownership policies run for cart items/orders/reviews. `EnsureAdmin` and policies protect administrative mutations; hiding UI does not replace them.
- Most pagination request classes accept `page >= 1`, `per_page` 1–100 with default 15. Read each feature's validator when implementing it.

## Existing public catalog

| Endpoint                       | Verified contract                                                                                                                                                                                                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /products`                | Active products, eager category; `search` is a literal name substring up to 255 characters, `category` is a slug; `min_price`/`max_price` inclusive decimal filters; `name_asc` default, `name_desc`, `price_asc`, `price_desc`; stable ID tie-break; paginated |
| `GET /categories`              | Unpaginated name-sorted `{ id, name, slug, description }` collection                                                                                                                                                                                            |
| `GET /products/{id}`           | `{ id, category_id, category, sku, name, description, price, stock_quantity, is_active, created_at, updated_at }`; inactive/missing products return 404                                                                                                         |
| `GET /products/{id}/price`     | `{ product_id, original_price, discount_amount, final_price, applied_discount: null \| { id, name, type } }`; optional bearer identity controls customer eligibility                                                                                            |
| `GET /products/{id}/discounts` | Eligible DiscountResource collection; optional bearer identity                                                                                                                                                                                                  |

No image URL, featured flag or product currency field exists in `ProductResource`. Sorting uses base price, not customer-specific final price. Backend pricing selects the eligible discount; the frontend must not recompute or stack discounts.

Sources: `ProductController`, `CategoryController`, `ProductPriceController`, `IndexProductRequest`, product/category/price resources, `ProductPricingService` and live GET responses. Public `POST /discounts/calculate` also exists, but normal frontend pricing can use the GET price endpoint and must not submit loyalty/customer impersonation fields.

## Authentication

| Endpoint         | Contract                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `POST /register` | `name`, `email`, `password`, `password_confirmation`; 201 token response; role/loyalty fields prohibited |
| `POST /login`    | `email`, `password`; 200 token response; bad credentials use generic email validation error (422)        |
| `GET /user`      | Authenticated UserResource; no `is_admin` field                                                          |
| `POST /logout`   | Authenticated current-token revocation; 204                                                              |

Email is lowercased/trimmed. Registration requires a mixed-case, numeric password of at least 12 characters and at most 72 bytes; login limits password length to 72 characters. Token creation expires after 30 days. Registration is limited to 5/minute/IP; login to 30/minute/IP and 5/minute/email+IP. The general API limiter is 300/minute/IP. See the [authentication strategy](authentication-strategy.md) for server/session/CSRF boundaries.

## Cart

Phase 2 verification: `POST /cart/items` **adds** to an existing product quantity;
`PATCH /cart/items/{item}` sets an **absolute** quantity. Items identify products
through nullable `product.id`, not a separate item `product_id` field. The backend
limits carts to 100 distinct products and quantities to 1000. It has no cart bulk
merge, cart idempotency key, revision or conditional-write endpoint. The
[Phase 2 implementation](phase-2-auth-cart.md) handles these constraints without
changing Laravel.

| Endpoint                    | Contract                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `GET /cart`                 | Authenticated cart summary; CartService may create the customer's cart, so do not treat it as a side-effect-free assessment probe |
| `POST /cart/items`          | `product_id`, `quantity` 1–1000; 201 CartResource                                                                                 |
| `PATCH /cart/items/{item}`  | `quantity` 1–1000; CartResource; ownership policy                                                                                 |
| `DELETE /cart/items/{item}` | 204; ownership policy                                                                                                             |

Summary: `id`, `items`, `subtotal`, `total_savings`, `grand_total`, `is_ready`. Items expose `id`, nullable `product`, `quantity`, `availability`, `available_stock`, `unit_original_price`, `unit_final_price`, `applied_discount`, `line_subtotal`, `line_discount_total`, `line_final_total`. Availability is `available`, `deleted`, `inactive` or `insufficient_stock`. Savings/totals and unit pricing can be null for unpriced/unavailable items; do not convert missing amounts to zero. Submitted price, discount, user and cart identity fields are prohibited. Cart additions do not reserve inventory. Sources: `CartController`, requests, policies, `CartPricingService`, resources and cart tests.

## Checkout, mock payment and customer orders

Phase 3 integration is documented in [checkout and orders](phase-3-checkout-orders.md).
Reverification confirms that mock payment runs **inside** the checkout transaction:
success creates a `paid` payment; decline returns 409 and rolls back the order,
payment, stock changes and cart clearing. The only customer payment endpoint is
GET. No separate payment submission, pending-payment, customer cancellation or
refund action exists. `X-Mock-Payment` overrides are never sent by this frontend.

| Endpoint                      | Contract                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `POST /checkout`              | Required `Idempotency-Key` header; first success 201, replay 200; `Idempotency-Replayed` response header |
| `GET /orders`                 | Owner-scoped, newest-first paginated OrderResource collection                                            |
| `GET /orders/{order}`         | Owner policy; OrderResource                                                                              |
| `GET /orders/{order}/payment` | Owner policy; PaymentResource                                                                            |

Idempotency keys are customer-scoped, at most 128 characters and match `^[A-Za-z0-9][A-Za-z0-9._:-]*$`. Keep the same key when retrying the same checkout attempt; never blindly create a new attempt after an uncertain response. Laravel locks inventory, calculates prices, snapshots order lines, creates mock payment and clears the cart transactionally. Client totals and success flags are prohibited. `X-Mock-Payment: success|fail` is local/testing-only and prohibited in production.

Order fields: `id`, `order_number`, `status`, `currency`, `subtotal`, `discount_total`, `grand_total`, loaded `items` and `payment`, `stock_restored_at`, timestamps. Lines contain product/SKU/name snapshots, quantity, original/discount/final unit amounts, line total and discount snapshot. Payment includes `id`, `order_id`, `reference`, `amount`, `status`, `paid_at`, `created_at`, loaded refund. Refund includes its ID/reference/amount/status/refunded timestamp.

Customer cancellation or a real gateway is not exposed by these routes. No address, shipping, tax, delivery-option or payment-method request contract was found. Do not invent checkout forms for them. Sources: `CheckoutRequest`, `CheckoutService`, order/payment/refund resources, `OrderPolicy`, checkout tests and backend checkout documentation.

## Wishlist and reviews

| Endpoint                             | Contract                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `GET /wishlist`                      | Authenticated, paginated; `id`, `product_id`, `is_available`, loaded product, `created_at`                            |
| `POST /wishlist/items`               | `product_id`; 201 on insert or 200 if already present                                                                 |
| `DELETE /wishlist/items/{productId}` | Uses the **product ID**, not wishlist-item ID; 204                                                                    |
| `GET /products/{product}/reviews`    | Public paginated ReviewResource collection plus top-level `summary: { average_rating: string \| null, review_count }` |
| `POST /products/{product}/reviews`   | Authenticated; rating integer 1–5, nullable comment up to 5000 characters; 201; duplicate customer review 409         |
| `PATCH /reviews/{review}`            | Owner-only; optional rating update; ReviewResource                                                                    |
| `DELETE /reviews/{review}`           | Owner-only; 204                                                                                                       |

Reviews contain `id`, `product_id`, `rating`, `comment`, loaded `reviewer: { id, name }` and timestamps. Do not invent verified-purchase flags. Customer identity is derived on the backend. Sources: corresponding controllers, requests, resources, policies and `ReviewsAndWishlistTest`.

## Administration

Admin routes require both authentication and backend admin permission. `UserResource` omits that permission, which is a future capability-discovery limitation.

| Endpoint group                                                                  | Capability and constraints                                                                                                                                                    |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /products`, `PUT/PATCH /products/{product}`, `DELETE /products/{product}` | Product policy; category ID, unique SKU, name, description, decimal price, stock, active flag; there is no separate admin listing of inactive products in the declared routes |
| `/admin/categories` resource routes except show                                 | Paginated index, create/update/delete; backend rejects deletion when referenced                                                                                               |
| `/admin/discounts` resource routes                                              | Paginated list/detail/create/update; DELETE deactivates rather than destroying history                                                                                        |
| `POST /admin/discounts/{discount}/products`                                     | Explicit product ID assignment                                                                                                                                                |
| `DELETE /admin/discounts/{discount}/products/{productId}`                       | Remove assignment; 204                                                                                                                                                        |
| `GET /admin/orders`, `GET /admin/orders/{order}`                                | Admin order resources; filter status and `from_date`/`to_date` (`Y-m-d`), plus pagination                                                                                     |
| `PATCH /admin/orders/{order}`                                                   | Backend-enforced status workflow; simulation header only in permitted local/testing cancellation scenarios                                                                    |
| `GET /admin/sales-summary`                                                      | Date-filtered counts, `orders_by_status`, `gross_sales`, `discounts_given`, `net_sales`, `top_selling_products`                                                               |

`OrderStatus` supports placed → processing/cancelled, processing → shipped/cancelled, shipped → completed; completed/cancelled are terminal. Do not implement a frontend state transition as authoritative. Mock refunds/restocking on eligible cancellation are backend responsibilities. Dates in sales reporting use UTC boundaries. The admin route group is rate-limited to 60/minute/user, in addition to the API limiter.

Sources: admin controllers, resources, requests, `EnsureAdmin`, `ProductPolicy`, `OrderStatus`, `OrderWorkflowService`, `SalesSummaryService` and admin tests. Future validators should be written from these exact contracts at implementation time; this phase does not add unused TypeScript models for them.

## Assessment verification boundary

Live checks used public catalog/pricing/review GETs, unauthenticated user GET, invalid-sort GET and a CORS OPTIONS preflight only. No users, tokens, carts, reviews, wishlist records, orders, payments or database fixtures were created. Protected contract conclusions come from source and test inspection, not authenticated runtime execution. Backend tests/migrations/seeders were not run.
