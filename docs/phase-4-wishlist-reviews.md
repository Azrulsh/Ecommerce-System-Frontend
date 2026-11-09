# Phase 4: customer wishlist and product reviews

Implemented on 9 November 2026 against the accepted Phase 1–3 frontend. All changes
are in `ecommerce-frontend`. Laravel source, configuration, tests and database were
strictly read-only. No dependencies were added or upgraded; no commits, pushes,
merges, tags or releases were created.

## Customer experience

- Product cards and details offer wishlist actions, with confirmed saved indicators
  where membership is known. Guests receive a safe login destination. Login never
  replays a wishlist or review mutation.
- `/wishlist` verifies the customer on the server and in the browser. It provides
  pagination, authoritative count, product links, removal, empty/loading/error/refresh
  states and the existing add-to-cart control. Unavailable products remain removable.
  Adding to cart leaves the wishlist unchanged.
- Product details show public reviews, rating text, public reviewer names, dates,
  Laravel's rating summary and review count, and previous/next page controls.
- Signed-in customers submit ratings and optional text, edit their own reviews and
  confirm irreversible deletion. Duplicate reviews receive actionable guidance.
  Drafts remain in memory through same-session focus verification and reset on
  account/session changes. They are never persisted or submitted automatically.
- Current teal styling, responsive navigation, native controls, keyboard focus and
  announcements are preserved. Navigation collapses below the large breakpoint so
  the additional wishlist link fits tablet widths. Icon decoration is hidden from
  assistive technology; rating information is also explicit text.

Checkout, orders, mock payments, authentication, guest/account cart and import
recovery retain their existing implementations. The outdated product-detail copy
that called checkout a future feature now describes the implemented checkout.

## Architecture and boundaries

```text
Browser components and feature hooks/providers
  -> fixed-purpose same-origin BFF routes
    -> existing opaque session, origin/CSRF checks and live identity verification
      -> server-only wishlist/review adapters
        -> shared guarded transport and runtime response parsers
          -> Laravel's authorization, persistence and business rules
```

`features/wishlist` owns types, runtime/input validation, server adapter and
session-scoped React coordination. `features/reviews` owns the corresponding
contracts, adapter, public query/customer mutation hook and presentation. The
review form and owner actions are separate components. Neither module introduces
a new HTTP client or session implementation. `lib/api/pagination.ts` validates
bounded pagination for these two modules without trusting upstream navigation URLs.
The historical catalog/order validators retain their existing behavior.

Routes compose these features; shared customer feedback handles safe errors and
auth links. Existing `CommerceProvider`, `useCustomerQuery`, `CustomerBoundary`,
button primitives, product placeholders, cart controls and transport are reused.
Only reviewed `rating`/`comment` field names were added to error allowlists; arbitrary
upstream validation text still never reaches the customer.

## Verified Laravel contracts

Paths below are relative to Laravel `/api`. Sources inspected: `routes/api.php`,
`WishlistController`, `ReviewController`, `PaginationRequest`, wishlist/review
store/update requests, resources, models, `ReviewPolicy`, rate limiter definitions
and `ReviewsAndWishlistTest`. Backend tests were read, never executed.

| Laravel endpoint                                  | Verified behavior                                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /wishlist?page=&per_page=`                   | Authenticated owner list, descending ID; data plus pagination meta/links                                                               |
| `POST /wishlist/items`                            | Positive integer `product_id`; active/non-deleted product; 201 new or 200 duplicate                                                    |
| `DELETE /wishlist/items/{productId}`              | **Product ID**, not wishlist row ID; owner-scoped 204; absent item 404                                                                 |
| `GET /products/{product}/reviews?page=&per_page=` | Public active-product reviews, descending ID, paginated; top-level rating summary                                                      |
| `POST /products/{product}/reviews`                | Authenticated, integer `rating` 1–5; nullable/optional string `comment`, maximum 5,000 characters; 201; duplicate customer/product 409 |
| `PATCH /reviews/{review}`                         | Owner only; optional rating and/or comment; updated ReviewResource; unavailable product 404                                            |
| `DELETE /reviews/{review}`                        | Owner or backend admin; 204, including an owner's review of an unavailable product                                                     |

`PaginationRequest` permits positive page numbers and 1–100 items/page, default 15.
The frontend selects 12 wishlist items/page and five reviews/page. Wishlist items
include `id`, `product_id`, `is_available`, nullable loaded product and `created_at`.
The product relationship includes soft-deleted products: availability can be false
even when product details are present. Availability does **not** mean in stock;
an active out-of-stock product can be saved, while existing cart controls prevent
adding zero stock.

Reviews expose `id`, `product_id`, `rating`, nullable `comment`, only reviewer
`{id,name}`, and nullable timestamps. Summary is Laravel's decimal-string/null
`average_rating` and integer `review_count`. No partial-page average is calculated.
The backend queries aggregate/count/pagination separately, so concurrent changes
are not a snapshot transaction. Parsers reject invalid shapes, ratings, summaries,
duplicate page IDs and inconsistent pagination; adapters check target identities.

Wishlist writes are throttled to 30/minute/customer and review writes to
10/minute/customer, plus the API-wide limiter. The BFF never bypasses those limits.

### Review eligibility and ownership

The actual implementation has **no verified-purchase or order-status requirement**.
Eligibility is authentication, an active/non-deleted product and no existing review
for the same customer/product. This follows the requests, controller transaction,
policy and backend tests, which create reviews without purchases. The frontend
does not infer eligibility from local order history or invent a purchase badge.
All supported reviews are immediately public; there is no customer moderation state.

Laravel rejects inactive/deleted/missing products with 404 for listing, creation
and editing. An owner can still delete their existing review through the API.
The normal storefront cannot navigate to an unavailable product's reviews because
the product itself is unavailable; no unsupported personal-review management page
was invented.

Review update requires ownership even for administrators. Review delete also
allows backend administrators; ownership denials use 404, not 403. The storefront
only exposes controls when the verified customer matches the public reviewer ID;
it introduces no admin moderation UI. Laravel policy checks remain authoritative
for crafted requests as well as normal UI interaction. Admin policy permissions
already present in Laravel are not replaced with a new frontend role model.

## Browser API and security

| Browser BFF endpoint                   | Projection to Laravel                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `GET /api/wishlist?page=`              | Authenticated owner wishlist page                                              |
| `POST /api/wishlist`                   | Exact `{action:"save"                                                          | "remove",productId}`; save or delete product |
| `GET /api/products/{id}/reviews?page=` | Public review page, without any bearer token                                   |
| `POST /api/products/{id}/reviews`      | Authenticated `{rating,comment?}` review creation                              |
| `POST /api/reviews/{id}`               | Exact update `{action:"update",rating,comment?}` or delete `{action:"delete"}` |

Updates send both form fields, a supported subset of Laravel's partial-update
contract. Numeric route IDs and bounded page input cannot supply arbitrary URLs.
Identity, product ownership, moderation flags and extra mutation fields are rejected
at the BFF. No browser-supplied user ID is forwarded.

The existing BFF continues to store Sanctum tokens only in encrypted private files,
referenced by an opaque HttpOnly cookie. Every authenticated operation checks the
session and live Laravel user; writes also require exact Origin, same-site Fetch
Metadata and constant-time synchronizer CSRF verification. JSON bodies retain the
existing size/read-time limits. Both session and feature/account filesystem locks
serialize writes on this Node host, including sessions for the same customer.

All new BFF success/error responses use `no-store, private`, `Pragma: no-cache`
and `Vary: Cookie`; upstream fetches remain uncached. No private wishlist data is
placed in a shared cache, browser storage, guest cart or client-side token store.
Public reviewer projections exclude email and other extra resource fields. Review
comments/names render as React text, with no HTML injection or markdown execution.
Failures expose existing fixed messages/codes, never backend diagnostics or tokens.

Safe redirect validation now permits `/wishlist` with query strings in addition to
existing storefront routes. External URLs, API routes, traversal and auth loops
still fail closed. There is no mutation queue waiting to run after login.

## Wishlist state and concurrency

The provider uses verified customer ID plus session CSRF identity to scope memory.
It makes one bounded first-page read for count and known membership, rather than
per-product requests or an unbounded scan. Save controls wait for this read to
settle. The page itself reads its requested page. Successful writes invalidate
both views, and confirmed per-product responses supplement the first page.

A product absent from a partial page has **unknown** membership. It receives a
"Save to wishlist" action without an authoritative unsaved/false indicator. Laravel's
`firstOrCreate` makes that action safe even if the product is already saved on an
older page. Only a complete list can establish absence. No bulk membership or
wishlist search endpoint exists; this intentional limitation avoids false state
and unbounded traffic. Count comes from Laravel `meta.total`, not a local set size.

Buttons prevent repeated same-tab submissions. Explicit save/remove actions are
serialized, never implemented as blind optimistic toggles. An already missing
wishlist removal is treated as the desired absence after Laravel's owner-scoped 404. Failures invalidate known membership and offer current saved products for
reconciliation; they do not automatically resend the write.

Focus and random cross-tab storage notifications trigger fresh reads. Notifications
carry no user or product data and tolerate unavailable localStorage. Session changes
hide private state immediately; old read/write responses are discarded by their
identity keys. Logout never copies saved products into guest state. Coordination
with direct Laravel clients or other hosts is limited to backend guarantees; a
stale explicit save/remove may reflect a newer action until the next refresh.

## Review state, errors and recovery

Public review queries are keyed by product, page and refresh version; stale requests
cannot replace a newer page. Customer controls, drafts and notices are scoped to
session identity. During focus verification the draft stays mounted but hidden;
mutations are refused until identity is verified again. Switching accounts clears
the draft. Explicit review refresh/page changes reset the visible form.

Creation, update and deletion use explicit submissions with busy guards and no
automatic retries. Success refreshes the public list/aggregate. Delete requires
confirmation. A 409 duplicate explains that an older own review may be on another
page. A partial public page never proves that the customer has no existing review;
there is no `/my-review` or review GET-by-ID endpoint.

401 invalidates the BFF session and mutation handling requests fresh discovery,
removing owner controls while retaining public reviews. 403 is a safe permission
failure, 404 unavailable/ownership-hidden, 422 a rating/comment validation failure,
429 throttled, and 500/503 unavailable. The eight-second upstream deadline covers
headers and body. Unexpected response shapes fail safely with 502 at the BFF.

A timeout, lost response or malformed success can follow a committed write.
The form blocks another submission until a read refresh and explains that the
change may have applied. There is no automatic uncertain-write replay. Laravel's
unique customer/product rule prevents duplicate review creation, but no review
idempotency, revision or conditional-write API exists. Edits are last-write-wins
under Laravel; the frontend cannot prevent another client overwriting an edit.
Refreshing is a read, never a mutation. Recovering after navigation may require
browsing pages to find the existing review before an explicit further action.

## Verification and audits

The original 89 tests are retained unchanged. Ten new pure validation/transport
checks and 26 new browser/BFF checks cover the requested wishlist, review and
security cases. The existing checkout/order/auth/cart regressions run alongside
them. The test runner owns its reserved ports and private temporary store and stops
only its own processes.

All wishlist/review traffic, including public review reads, goes to an isolated Node
fixture. Only public catalog GETs reach real Laravel; a validated public catalog
snapshot seeds test-only product metadata. Every user, wishlist, review, cart and
purchase mutation stays in fixture memory. No real business data is changed.
The full suite requires an existing catalog with at least 13 products and installed
Microsoft Edge. Live authenticated Laravel acceptance is not claimed.

Initial browser runs caught an overlapping bootstrap/save race and selectors that
also matched Next.js's route announcer. Controls now wait for the bootstrap read;
tests scope alerts to storefront content. A fixture pagination failure was traced
to redundant live pricing reads, fixed by reusing the validated catalog snapshot.
Focused reruns passed. Desktop review and mobile wishlist screenshots were inspected.
The complete regression run passed all 125 tests in 5.2 minutes. Final responsive
review also constrained long reviewer names to the available width; the responsive
check was strengthened with a 255-character name and rerun after rebuilding.

| Check                                     | Result                                                              |
| ----------------------------------------- | ------------------------------------------------------------------- |
| ESLint                                    | Passed, no warnings                                                 |
| Strict TypeScript / Next route generation | Passed                                                              |
| Formatting                                | Passed                                                              |
| Independent unit/transport suite          | 59 passed                                                           |
| Complete regression suite                 | 125 passed (59 unit + 66 browser/BFF); all 89 prior checks retained |
| Production build                          | Passed; new API and wishlist routes dynamic                         |
| Production dependency audit               | Zero vulnerabilities                                                |
| Full dependency audit                     | Eight existing moderate development-tool findings                   |

The full audit exits 1 for minimatch globparts amplification
([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)) and its
TypeScript/ESLint dependents. npm proposes a breaking downgrade of
`eslint-config-next` to 15.5.29. No automatic fix, override, downgrade or dependency
upgrade was applied. Initial sandbox registry access failed; the requested audits
were rerun successfully with registry access.

## Remaining limits and production constraints

- No guest wishlist, membership lookup, personal-review lookup, review moderation,
  verified-purchase flags, arbitrary sorting, bulk actions or product media contract
  was invented. Public review rendering requires client JavaScript after product
  page load; server-rendered review SEO/structured data is future work.
- Wishlist freshness is event/focus/manual refresh, not a live subscription. Direct
  API clients can change state between reads. Review draft persistence is limited
  to the mounted session/page; refresh/navigation can discard an unfinished draft.
- Review eligibility failures are handled, but the current backend does not impose
  purchase eligibility. Fixture 403 checks demonstrate error handling, not a
  nonexistent purchase restriction.
- Cross-browser/screen-reader certification, live authenticated acceptance and
  operational security review remain required. Passing tests is not production
  readiness or a penetration-test claim.
- Production still requires HTTPS, exact `APP_ORIGIN`, a protected 32-byte encryption
  key, private durable session/workflow storage outside web roots and **one Node
  host**. Same-host locks do not support serverless or multiple hosts. No new
  environment variables or persistence infrastructure were added.
- Retain existing backup/restore, critical checkout/import records, NTFS/service
  account ACL, quota, stale-lock recovery and deployment-volume checks. Do not
  delete unknown checkout attempts as housekeeping. TLS/HSTS, tested CSP, edge
  abuse/rate limits, redacted monitoring and compatible lint remediation still
  need deployment work. BFF traffic can concentrate Laravel's IP limits.

## Manual acceptance checklist

Use an explicitly authorized **disposable** Laravel environment for mutation
acceptance, never this task's read-only development database.

1. Guest: read empty/populated/paginated reviews and summaries; follow save/review
   login/register links and verify the destination without an automatic write.
2. Wishlist: save on cards/details, repeat a save, navigate pages, add to cart,
   refresh, logout/login and switch accounts/tabs. Verify persistence and count,
   no cross-user state, unchanged wishlist after cart addition and empty states.
3. Change a saved product to out-of-stock, inactive and soft-deleted in that separate
   environment. Verify saved-state availability, disabled cart actions, removal and
   safe missing-product behavior. Check a saved product older than the first page.
4. Reviews: submit without a purchase, try invalid ratings/oversized Unicode text,
   submit a duplicate including an older review, edit your review, cancel/confirm
   deletion, and attempt another customer's IDs. Verify authoritative aggregates.
5. Exercise unavailable products, revoked/expired sessions, 403/404/409/422/429,
   malformed responses, offline/slow requests and a response lost after commit.
   Read/reconcile before further submissions; verify refresh never replays a write.
6. Switch accounts during pending requests. Check draft isolation, same-session
   focus recovery, browser history, storage restrictions and browsers without Web
   Locks. Ensure no token or private wishlist appears in browser storage or logs.
7. On real HTTPS, inspect cookie attributes, exact Origin/CSRF rejection, safe
   redirects, no-store/CDN behavior, volume durability, ACLs, secret handling,
   restart/backup/restore and existing purchase recovery.
8. Test keyboard navigation, labels, focus, announcements, confirmation dialogs,
   zoom, long names/comments, phones/tablets and supported assistive technologies.
   Reaccept guest/cart/import/checkout/order workflows on the disposable backend.

## Complete modified-file manifest

Existing files with content changes:

```text
README.md
docs/architecture.md
docs/backend-contracts.md
docs/phase-3-checkout-orders.md
playwright.config.ts
src/app/layout.tsx
src/components/layout/Header.tsx
src/features/auth/validation.ts
src/features/catalog/components/ProductCard.tsx
src/features/catalog/components/ProductDetails.tsx
src/lib/api/request.ts
src/lib/bff/browser-client.ts
tests/support/api-relay.mjs
tests/support/auth-api-fixture.mjs
```

Added files:

```text
docs/phase-4-wishlist-reviews.md
src/app/api/products/[id]/reviews/route.ts
src/app/api/reviews/[id]/route.ts
src/app/api/wishlist/route.ts
src/app/wishlist/page.tsx
src/components/ui/customer-feedback.tsx
src/features/reviews/components/ProductReviews.tsx
src/features/reviews/components/ReviewActions.tsx
src/features/reviews/components/ReviewForm.tsx
src/features/reviews/server/api.ts
src/features/reviews/types.ts
src/features/reviews/use-product-reviews.ts
src/features/reviews/validation.ts
src/features/wishlist/components/WishlistButton.tsx
src/features/wishlist/components/WishlistPage.tsx
src/features/wishlist/components/WishlistProvider.tsx
src/features/wishlist/server/api.ts
src/features/wishlist/types.ts
src/features/wishlist/validation.ts
src/lib/api/pagination.ts
tests/engagement-unit.spec.ts
tests/support/engagement-api-fixture.mjs
tests/wishlist-reviews.spec.ts
```

Additional files normalized from Windows line endings to LF, with no semantic Git diff:

```text
docs/phase-2-auth-cart.md
src/app/account/page.tsx
src/app/api/checkout/route.ts
src/app/api/orders/[id]/payment/route.ts
src/app/api/orders/[id]/route.ts
src/app/api/orders/route.ts
src/app/cart/page.tsx
src/app/checkout/error.tsx
src/app/checkout/loading.tsx
src/app/checkout/page.tsx
src/app/orders/[id]/confirmation/page.tsx
src/app/orders/[id]/page.tsx
src/app/orders/[id]/payment/page.tsx
src/app/orders/error.tsx
src/app/orders/loading.tsx
src/app/orders/not-found.tsx
src/app/orders/page.tsx
src/features/auth/components/AccountGate.tsx
src/features/auth/components/CustomerBoundary.tsx
src/features/auth/use-customer-query.ts
src/features/cart/components/AccountCartPanel.tsx
src/features/cart/components/CartPage.tsx
src/features/cart/components/GuestCartPanel.tsx
src/features/cart/import-review.ts
src/features/cart/merge.ts
src/features/checkout/components/CheckoutActions.tsx
src/features/checkout/components/CheckoutCart.tsx
src/features/checkout/components/CheckoutExperience.tsx
src/features/checkout/server/api.ts
src/features/checkout/types.ts
src/features/checkout/validation.ts
src/features/checkout/workflow.ts
src/features/orders/components/OrderDetails.tsx
src/features/orders/components/OrderHistory.tsx
src/features/orders/components/PaymentDetails.tsx
src/features/orders/components/PaymentSummary.tsx
src/features/orders/components/PurchasePrimitives.tsx
src/features/orders/server/api.ts
src/features/orders/types.ts
src/features/orders/validation.ts
src/lib/api/errors.ts
tests/checkout-orders.spec.ts
tests/checkout-unit.spec.ts
tests/support/purchase-api-fixture.mjs
tests/support/purchase-samples.ts
```

Package manifests/lockfile remain unchanged. Test screenshots,
results and runtime stores remain ignored. Both projects retain independent Git
repositories and the backend has no working-tree changes.

## Recommended Phase 5

Prioritize disposable-backend acceptance and release hardening: deployment recovery,
private storage/secret controls, tested CSP/HSTS, edge limits and monitoring,
compatible development-audit remediation, broader accessibility/browser checks
and measured performance. Consider review SEO after measurement. Administration
requires an explicit scope and verified capability discovery because the current
user resource omits admin permission. Real payments, shipping/tax, stronger cart
revisions, personal-review or wishlist membership APIs require separately approved
backend contracts; none were implemented here.
