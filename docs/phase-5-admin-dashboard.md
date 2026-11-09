# Phase 5: administration and store management

Implemented on 10 November 2026 against the manually accepted Phase 1–4 baseline.
All implementation changes are in `ecommerce-frontend`. Laravel source,
configuration, tests, users and database were read-only. No dependencies were
installed/upgraded, no real administrator was created/promoted, and no commit,
push, merge, tag or release was performed.

## Implemented modules

| Page                                                                | Implemented behavior                                                                                                                          |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`                                                            | Verified admin access, reporting date range, six returned KPIs, status bars and top-selling snapshot SKUs                                     |
| `/admin/products`                                                   | Active-only product list, name/category/base-price filters, sorting, pagination and known-ID navigation                                       |
| `/admin/products/new`                                               | Validated product creation including category, SKU, description, exact decimal base price, initial stock and active flag                      |
| `/admin/products/[id]`                                              | Product details, changed metadata fields, separate absolute stock updates, soft deletion and known inactive-ID reactivation                   |
| `/admin/categories`                                                 | Paginated list, create/edit and confirmed permanent deletion when unreferenced                                                                |
| `/admin/discounts`, `/admin/discounts/new`, `/admin/discounts/[id]` | Strategy settings, UTC schedules, loyalty requirements, additive product assignments, removal and deactivation                                |
| `/admin/orders`, `/admin/orders/[id]`                               | All authorized orders, UTC/status filters, pagination, historical items/totals, recorded payment/refund/restoration state and status requests |

The teal storefront remains intact. Administration has a distinct labeled header
and responsive sidebar/navigation, shared controls, accessible native forms,
loading/empty/error/refresh states, status announcements and scroll-contained
tables. The storefront header shows “Manage store” only after capability
verification. Admin navigation collapses at a wider breakpoint to fit the extra
link. Existing account/sign-out controls and every customer module are retained.

## Authorization model

`UserResource` intentionally omits `is_admin`; neither authentication nor wildcard
Sanctum abilities proves administrator permission. Inspection verified:

- `EnsureAdmin` requires the stored user model's `is_admin === true`, before admin
  route binding. `ProductPolicy` checks the same server-controlled condition.
- `GET /api/admin/categories?per_page=1&page=1` is a read-only, admin-protected
  operation. The BFF validates its paginated category response before treating
  success as evidence of admin capability. 401, 403, timeout or malformed success
  never grants permission. The probe's category data is not returned as a role.
- `/api/admin/access` is a **frontend BFF route**, not an invented Laravel endpoint.
  It returns only `{allowed:true,userId}` after session, live identity and probe
  verification. Customer/guest failures use safe 403/401 responses.
- Every privileged BFF GET/POST repeats live session/user verification and the
  protected probe. Laravel also authorizes the target operation through its
  middleware, requests and policies. A role revoked after the probe can still be
  refused by the target endpoint.
- Every admin page uses `AdminBoundary` independently. Authorization does not rely
  on a persistent layout, hidden links, cached RSC navigation or browser flags.
  Guests receive a safe login destination; customers get a forbidden state.

No role is added to registration, the user type or the persistent session record.
Emails, loyalty membership, query parameters and browser `is_admin`/role/user flags
cannot grant privilege. No customer-management or role-editing route was added.
Provisioning a real administrator remains the backend owner's separately
authorized responsibility.

The probe consumes the existing admin limiter (60 requests/minute/customer).
Operations against the admin group can consume both probe and target requests.
The API-wide IP limiter also remains. Additional permission checks deliberately
fail closed rather than bypassing throttling or retaining a server-side role TTL.
Navigation verification occurs on discovery/focus/session changes and explicit
rechecks; it is not a live role subscription. Known 401/403 data/mutation failures
invalidate client capability, hide privileged UI and, for 401, rediscover identity.

## Architecture

```text
src/app/admin/                 Server page composition, metadata and boundaries
src/app/api/admin/             Explicit privileged BFF routes, no catch-all proxy
src/features/admin/
  types.ts                    Discounts, report data and admin order projection
  validation.ts               Input/response validation and controlled conflict mapping
  server/access.ts            Protected-read capability verification
  server/api.ts               Fixed Laravel adapters, server-only bearer injection
  server/route-input.ts       Safe page IDs and allowlisted URL filters
  use-admin-query.ts          Session-scoped authorized reads and stale-response rejection
  use-admin-mutation.ts       Explicit writes, busy guards and uncertainty handling
  components/                 Access provider/frame, forms and feature presentation
src/lib/api/validation-fields.ts  Shared safe validation-field allowlist
```

Existing guarded transport, opaque encrypted sessions, native Fetch, runtime
validators, exact money formatting, UI primitives and customer identity discovery
are reused. Shared validation-field names replace two drifting allowlists; backend
diagnostic strings remain private. Existing order snapshots are reused for admin
reads, with an admin-specific projection for existing `failed` payments as well as
`paid`/`refunded`. This does not introduce a pending-payment workflow or change
accepted customer order validation.

Same-host file locks serialize admin mutations by product/category/discount/order.
They do not provide inventory revision protection, coordination with direct API
clients, or a transaction spanning Next.js and Laravel. No separate session system,
database connection, charting package or generic privileged proxy was introduced.

## Verified backend contracts

All Laravel paths below are relative to `/api`. Sources: `routes/api.php`,
`EnsureAdmin`, `ProductPolicy`, product/category/discount/order requests and
resources, product/category models, `DiscountAdministrationService`,
`OrderStatus`, `OrderWorkflowService`, `MockPaymentService`, `SalesSummaryService`,
`AdminCatalogTest`, `AdminOrdersTest`, `DiscountAdministrationTest` and product
authorization tests. These backend files/tests were read, never modified or run.

| Laravel endpoint                                       | Contract used                                                                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/categories?per_page=1&page=1`              | Permission probe under `EnsureAdmin`; validated category page                                                           |
| `GET /products`                                        | Active-only catalog, name substring, category slug, inclusive min/max base prices, four name/price sorts and pagination |
| `GET /products/{id}`                                   | Active/non-deleted product only, even for admins                                                                        |
| `GET /categories`                                      | Read-only category options; called through an admin-authorized BFF boundary                                             |
| `POST /products`                                       | Admin product creation; ProductResource                                                                                 |
| `PATCH /products/{id}`                                 | Admin partial product update, including inactive products by known ID                                                   |
| `DELETE /products/{id}`                                | Product policy; soft deletion; 204                                                                                      |
| `GET /admin/categories`                                | Name/ID ordered paginated list, default 15, 1–100 items/page                                                            |
| `POST /admin/categories`                               | Name, unique lowercase-hyphen slug, nullable description                                                                |
| `PATCH /admin/categories/{id}`                         | Category update; no category-show endpoint exists                                                                       |
| `DELETE /admin/categories/{id}`                        | Permanent deletion; 409 when any product, including soft-deleted products, references it                                |
| `GET /admin/discounts`, `GET /admin/discounts/{id}`    | ID-ordered list/detail; loaded product IDs, strategy, value, active/loyalty flags and UTC bounds                        |
| `POST /admin/discounts`, `PATCH /admin/discounts/{id}` | Validated strategy settings; create can omit unloaded `product_ids` in the resource                                     |
| `DELETE /admin/discounts/{id}`                         | Deactivates; keeps record and assignments; 204                                                                          |
| `POST /admin/discounts/{id}/products`                  | Distinct positive `product_ids`, 1–1000 per request; additive duplicate-safe assignment                                 |
| `DELETE /admin/discounts/{id}/products/{productId}`    | Idempotent assignment removal; 204                                                                                      |
| `GET /admin/orders`, `GET /admin/orders/{id}`          | All authorized orders with historical items and payment/refund; no customer contact fields                              |
| `PATCH /admin/orders/{id}/status`                      | Status request; Laravel validates transition and cancellation transaction                                               |
| `GET /admin/sales-summary`                             | UTC-filtered authoritative counts, recognized-sales totals and top-ten snapshot SKUs                                    |

Frontend BFF endpoints mirror these purposes under `/api/admin`: `access`,
`summary`, `products`, `products/[id]`, `product-options`, `categories`,
`categories/[id]`, `discounts`, `discounts/[id]`,
`discounts/[id]/products`, `orders`, `orders/[id]` and `orders/[id]/status`.
Browser mutations use POST with small allowlisted action/field bodies; adapters
translate to the specific Laravel POST/PATCH/DELETE method. Paths, resource IDs,
query names and parsers are explicit. No browser URL, token, arbitrary method,
ownership field or refund-simulation header is forwarded.

## Products, categories and inventory

Products require category ID, a unique SKU and name up to 255 characters each,
nullable description up to 10,000 characters, non-negative decimal price up to
`9999999999.99`, unsigned integer stock `0..4294967295` and an optional active
boolean. Backend uniqueness remains authoritative, including SKUs on deleted
products. Monetary input stays a decimal string; native floating-point price or
discount calculations are never used.

List/search/filter/pagination are explicitly **active-only**, using the actual
catalog endpoint. No complete inactive/deleted inventory view exists. An inactive
create/update returns its ID and details; if later reopened, the read returns 404.
The UI explains this and offers confirmed reactivation through the known ID's
supported partial update. A deleted product cannot be restored through this API.
Deletion is confirmed, waits for Laravel's 204, and retains purchase snapshots.

Product metadata and stock are separate forms/operations. Metadata submits fields
changed from its mounted draft snapshot, excluding stock. Same-session focus
revalidation does not silently turn untouched fields into changes: an external
price change survives a name-only save. Confirmed saves reset fields from the
returned resource. This reduces accidental overwrites; it is **not** optimistic
concurrency control. Two clients editing the same field still use last-write-wins.

Stock changes explicitly replace the absolute count, show the snapshot and warn
about concurrent sales, require confirmation and submit only `stock_quantity`.
Laravel provides no version, ETag, conditional update, adjustment log, reservation,
warehouse API or documented low-stock threshold. Only zero stock is labeled
out-of-stock. The final stock value can race with checkout or another client;
operators must refresh/reconcile. There is no fabricated inventory audit trail.

Categories use name/slug/nullable description forms and edit directly from a
returned page because there is no category-show route. The BFF rejects extra
fields. Slug uniqueness and deletion references are checked by Laravel; category
deletion is permanent only after confirmed success. Product options reuse the
public category resource behind the privileged BFF guard.

## Discounts

Supported strategies are `fixed`, `percentage` and `loyalty`. Values use the same
non-negative decimal ceiling. Laravel additionally enforces percentages 0–100,
loyalty value exactly `85.00`, and loyalty membership for the loyalty strategy.
The UI explains parameters without interpreting them as a calculated selling
price. Fixed amounts cannot exceed any assigned product's price; update and
assignment validation stays in Laravel.

`starts_at`/`expires_at` are supported, nullable UTC bounds. When a start exists,
expiry must be strictly later. Labels explicitly state UTC and native controls
send UTC timestamps. Schedules and loyalty flags are displayed from confirmed
resources. Settings edits submit the shown settings and have no revision check;
refresh before editing if another operator may be changing them.

Assignments add without detaching existing IDs; repeated assignment creates no
duplicate link. Inactive products can be assigned by known ID, while missing and
deleted products are refused. Removal is separately confirmed. Deactivation is
confirmed and preserves assignments. There is no coupon system, stacking engine,
promotion calculation, automatic discount selection or fabricated preview in
Next.js. The backend can recalculate storefront pricing independently.

## Orders, cancellation and reports

Admin orders use 12 records/page, newest first, with optional status and UTC
inclusive date filters. Details retain historical SKU/name/quantity/prices,
discount snapshots, subtotal/discount/grand total, payment/refund and restoration
timestamp. Current catalog edits do not rewrite history. No customer email/name
or address is displayed because `OrderResource` does not supply those fields.

The verified workflow permits placed → processing/cancelled, processing →
shipped/cancelled, shipped → completed; completed/cancelled are terminal. The UI
requests a known status and explains the rules; Laravel decides whether the
current state permits it. It never changes order/payment state optimistically.

Cancellation requires confirmation and calls `/admin/orders/{id}/status` with
`status:cancelled`. Laravel locks the order/inventory/payment and validates
restoration capacity, product references, eligible paid payment and refund
configuration. Success restores stock once, records a mock refund and restoration
timestamp, and preserves item snapshots. A failed refund or inventory restriction
rolls back the transaction. Soft-deleted products can be restocked; missing
products, overflow and inconsistent tracking can require operator resolution.

Only a small exact allowlist of reviewed 409 messages maps to
`admin_resolution_required`; raw diagnostics are never shown. No separate refund,
refund amount, payment override or client-side inventory restoration is submitted.
Repeat status requests are governed by Laravel, including its consistent
already-cancelled behavior; the frontend never automatically replays uncertainty.

Dashboard KPIs map directly to `total_orders`, `completed_orders`,
`cancelled_orders`, `gross_sales`, `discounts_given` and `net_sales`. Status bars
use returned `orders_by_status` counts, not inferred customer-page totals. Sales
recognize non-cancelled orders with paid payment and no refund; gross is stored
subtotal, discounts are stored discount total, net is stored grand total. Counts
include all matching orders independently of recognized-sales eligibility.
Top products are up to ten stored SKU snapshots ranked by quantity, with recorded
revenue. Dates use UTC and an inclusive to-date. Money is displayed as MYR using
the existing exact formatter. No customer count, stock KPI, trend series, export,
forecast or financial aggregation from incomplete paginated records is invented.

## Security, state and recovery

- The accepted opaque HttpOnly cookie, encrypted server-held bearer token, expiry,
  rotation/logout and live user verification remain unchanged. No role/token/private
  report is stored in browser storage or a shared public cache.
- Client access/data/drafts are scoped by verified user and session CSRF identity.
  During revalidation the frame hides retained same-session drafts. Account changes,
  logout or permission failure remove privileged content; late responses cannot
  restore a previous account's state. Every data operation is guarded again.
- New BFF success/error responses are `no-store, private`, vary by Cookie and omit
  diagnostics. Remote calls remain server-only, no-store, redirect-rejecting and
  bounded by the existing eight-second header/body timeout.
- Mutations reuse exact Origin, cross-site Fetch Metadata rejection, synchronizer
  CSRF verification and the five-second JSON read deadline. Defaults remain 32 KB.
  Product/category bodies allow a fixed **64 KB** to support 10,000 Unicode
  description characters; credential/cart/checkout limits remain unchanged. The
  bound is a server constant, never browser-controlled, and oversize is rejected.
- Strict field lists reject forged role/user/financial fields, invalid IDs, stock,
  prices and unsupported actions. Resource parsers validate enums, decimals,
  relationships, pagination, report counts and target identity. React renders
  names/descriptions as text; no unsafe HTML or external URL interpolation exists.
- Busy guards and browser auth locks prevent same-tab repeated writes and
  serialize supporting-tab auth transitions. Same-host resource locks supplement
  Laravel authorization/transactions; they are not distributed locks or versions.

401 removes the local BFF session and triggers client discovery; 403 removes
verified capability; 404 explains unavailable/active-only lookups; 409 reports
refused transitions/references or reviewed manual resolution; 422 supplies safe
field names and form guidance; 429 requests a later retry. Network/timeouts,
500/503 and malformed success responses fail safely (502 for invalid resource
contracts). GET refresh/retry never performs a write.

An uncertain create/update/delete/cancellation may have reached Laravel. Forms
block another mutation, explain uncertainty and offer record/list inspection.
Read-only refresh reconciles known IDs, including cancellation's status/refund/
restoration fields. No automatic POST replay or fabricated success occurs.
Explicit refresh resets the relevant form/blocked state from current data.

There is **no durable admin-create idempotency ledger** or backend creation key.
The block is scoped to the mounted UI, not an exactly-once guarantee across page
navigation, browser loss or server restarts. SKU/slug uniqueness helps identify
product/category duplicates, but discount names are not unique. Inspect records
before manually starting a new create. An uncertain inactive-product create can
be impossible to discover through this active-only API if its returned ID was
lost; seek authorized backend-operator reconciliation rather than guessing or
blindly changing SKU and creating again.

## Automated validation and audits

The existing 125 tests are retained without removing or weakening assertions.
Phase 5 adds 15 unit/transport checks and 30 browser/BFF checks: 74 unit and 96
browser/integration checks, **170 total**. New coverage includes guest/customer
denial, forged roles, expired/revoked sessions, capability revocation/malformed
probe, CRUD/uniqueness/decimal/stock/date validation, active-only reads, category
references, discount eligibility and assignments, report mapping, historical
orders, cancellation/refund/stock behavior, timeout/drop-after-commit recovery,
CSRF/origin, token privacy, account switching/late responses, draft preservation,
Unicode body limits and responsive UI.

All privileged traffic goes exclusively to isolated Node fixtures. Synthetic
administrator permission exists only in fixture memory and is never added to
real users. Fixture product reads/writes, category/discount operations, reports
and order status changes are isolated; only public catalog GETs reach Laravel.
The fixtures reuse validated catalog snapshots and existing isolated purchase
records. Tests reserve ports 3100/8101/8102, refuse occupied ports and stop only
their owned processes. Expiry tests edit only their per-run private frontend
temporary records. No backend tests, migrations or seeders were run.

The complete regression run passed. A dedicated test verifies that a name-only
draft save preserves another client's price update. Responsive admin screenshots
were also inspected at desktop and mobile sizes. Final border and copy polish
is verified against a rebuilt production bundle: all three focused browser checks
passed (dashboard, product lifecycle and uncertain-cancellation recovery).

| Check                                     | Result                                            |
| ----------------------------------------- | ------------------------------------------------- |
| ESLint                                    | Passed, no warnings                               |
| Strict TypeScript / Next route generation | Passed                                            |
| Formatting                                | Passed                                            |
| Independent unit/transport suite          | 74 passed                                         |
| Full regression suite                     | 170 passed; all 125 baseline tests retained       |
| Production build                          | Passed; all admin pages/BFF endpoints are dynamic |
| Production dependency audit               | Zero vulnerabilities                              |
| Full dependency audit                     | Eight existing moderate development-tool findings |

Registry access was unavailable in the sandbox; both audits were completed with
approved registry access. The full audit exits 1 for minimatch globparts
amplification ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249))
and dependent TypeScript/ESLint packages. npm proposes a breaking downgrade of
`eslint-config-next` to 15.5.29. No automatic fix, downgrade, override or dependency
upgrade was applied. Package manifest/lockfile semantics remain unchanged.

## Unsupported capabilities and remaining risks

No full inactive/deleted inventory listing/read, product restore, stock revision,
adjustment history, warehouse/reservation management, low-stock threshold,
customer CRUD/contact lookup, role editing, account promotion, real gateway,
standalone refund, export, unreturned analytics, coupon system, image upload or
bulk deletion was added. The safe known-ID reactivation is not a full inactive
catalog. Category detail editing uses list data, not an invented show endpoint.

Same-field changes and full category/discount settings remain last-write-wins.
An absolute stock edit can overwrite a concurrent checkout result; this is a
backend contract limitation, not solved by browser busy flags or Node locks.
Creation uncertainty cannot always be reconciled automatically. Private views
require JavaScript; native-form/browser checks are not full accessibility
certification. Some parser collections are bounded (for example 10,000 assigned
IDs in a returned discount); larger contracts fail safely rather than silently
truncating membership. Public category options are currently unpaginated.

Production still requires HTTPS, exact `APP_ORIGIN`, a protected random encryption
key, durable private session/workflow disk outside all web roots, restrictive
service-account/NTFS ACLs and **one Node host**. No new environment variables or
multi-instance/serverless readiness are claimed. Preserve purchase/import recovery
records and key backups; do not remove unresolved attempts to bypass errors.
Existing volume, stale-lock, retention and backup/restore constraints remain.

Before release, complete disposable-backend acceptance, administrative access
provisioning/revocation procedures, edge rate/body/abuse limits, quotas, redacted
monitoring, TLS/HSTS, a tested CSP, secret/storage recovery and broader browser/
assistive-technology checks. MFA/step-up authorization has no verified backend
contract here. Admin capability probes add limiter traffic. Passing automated
tests is not production acceptance, security certification or a penetration test.

## Manual acceptance checklist

Use a separately and explicitly authorized **disposable Laravel environment**.
Have its owner provide an existing administrator and ordinary customer. Do not
create/promote real users or mutate this task's read-only development database.

1. Verify guest login return, customer forbidden states, genuine admin access,
   forged-role rejection, revoked role/token and expired session. Check that
   navigation and privileged data disappear on logout/account switching and that
   direct BFF requests cannot bypass guards.
2. Create active/inactive products; validate unique/deleted SKU, Unicode strings,
   category options, exact boundary prices and unsigned stock. Search/filter/sort/
   paginate active products, reopen known inactive IDs and confirm reactivation.
   Cancel/confirm soft deletion and verify purchase snapshots remain.
3. Edit metadata while another operator changes an untouched field. Confirm the
   unrelated value is preserved. Exercise two edits to the same field and stock
   changes during checkout; verify last-write-wins limits are understood and
   absolute stock replacement is explicitly confirmed/reconciled.
4. Create/edit/delete unreferenced categories; verify duplicate slug and referenced
   category conflicts, including references from soft-deleted products.
5. Exercise all discount strategies, valid/invalid UTC bounds, loyalty enforcement,
   fixed-price limits, additive/repeated assignment, inactive/missing/deleted IDs,
   assignment removal and deactivation retaining links. Verify storefront pricing
   remains calculated by Laravel, with no invented stacking/preview.
6. Inspect all admin orders, status/date pagination, immutable historical snapshots,
   absent customer contact fields, paid/refunded/failed payment records and missing
   payment. Test allowed/refused transitions and cancellation of placed/processing
   versus shipped/completed orders.
7. Validate cancellation's exact mock refund and once-only stock restoration,
   soft-deleted products, missing inventory, overflow, ineligible payment, failed
   refund and inconsistent tracking. Confirm rollback/refusal rather than a fake
   success. Use only authorized disposable-environment controls to arrange faults;
   the frontend never sends simulation headers.
8. Drop responses/time out after commit for create/update/delete/cancellation.
   Verify no automatic write replay, inspect authoritative records and confirm
   unresolved inactive creates require operator reconciliation if their ID was
   lost. Read-only refresh must never repeat a refund or stock restoration.
9. Compare dashboard figures with known disposable order snapshots, including
   cancelled/refunded/failed-payment exclusions, UTC date edges, empty results and
   large decimal totals. Confirm top SKUs and status counts reflect actual reports.
10. On HTTPS, inspect cookie/CSRF/origin behavior, no-store/CDN handling, token and
    log redaction, safe redirects, private volume ACLs/durability, backups and
    restart/recovery. Exercise 401/403/404/409/422/429/503 and malformed responses.
11. Check phones/tablets/desktop, keyboard, focus, labels/announcements, confirmation
    dialogs, zoom, long text, table scrolling and supported screen readers. Reaccept
    all customer catalog/auth/cart/import/checkout/order/wishlist/review journeys.

## Complete modified-file manifest

Existing files with content changes:

```text
README.md
docs/architecture.md
docs/authentication-strategy.md
docs/backend-contracts.md
docs/phase-4-wishlist-reviews.md
playwright.config.ts
src/app/layout.tsx
src/components/layout/Header.tsx
src/features/auth/validation.ts
src/lib/api/errors.ts
src/lib/api/request.ts
src/lib/bff/browser-client.ts
src/lib/bff/security.ts
tests/support/api-relay.mjs
tests/support/auth-api-fixture.mjs
```

Added files:

```text
docs/phase-5-admin-dashboard.md
src/app/admin/categories/page.tsx
src/app/admin/discounts/[id]/page.tsx
src/app/admin/discounts/new/page.tsx
src/app/admin/discounts/page.tsx
src/app/admin/error.tsx
src/app/admin/layout.tsx
src/app/admin/loading.tsx
src/app/admin/orders/[id]/page.tsx
src/app/admin/orders/page.tsx
src/app/admin/page.tsx
src/app/admin/products/[id]/page.tsx
src/app/admin/products/new/page.tsx
src/app/admin/products/page.tsx
src/app/api/admin/access/route.ts
src/app/api/admin/categories/[id]/route.ts
src/app/api/admin/categories/route.ts
src/app/api/admin/discounts/[id]/products/route.ts
src/app/api/admin/discounts/[id]/route.ts
src/app/api/admin/discounts/route.ts
src/app/api/admin/orders/[id]/route.ts
src/app/api/admin/orders/[id]/status/route.ts
src/app/api/admin/orders/route.ts
src/app/api/admin/product-options/route.ts
src/app/api/admin/products/[id]/route.ts
src/app/api/admin/products/route.ts
src/app/api/admin/summary/route.ts
src/features/admin/components/AdminAccessProvider.tsx
src/features/admin/components/AdminBoundary.tsx
src/features/admin/components/AdminForm.tsx
src/features/admin/components/AdminFrame.tsx
src/features/admin/components/AdminOrderDetails.tsx
src/features/admin/components/AdminPrimitives.tsx
src/features/admin/components/CategoryManagement.tsx
src/features/admin/components/Dashboard.tsx
src/features/admin/components/DateRangeForm.tsx
src/features/admin/components/DiscountEditor.tsx
src/features/admin/components/DiscountManagement.tsx
src/features/admin/components/OrderManagement.tsx
src/features/admin/components/ProductEditor.tsx
src/features/admin/components/ProductManagement.tsx
src/features/admin/server/access.ts
src/features/admin/server/api.ts
src/features/admin/server/route-input.ts
src/features/admin/types.ts
src/features/admin/use-admin-mutation.ts
src/features/admin/use-admin-query.ts
src/features/admin/validation.ts
src/lib/api/validation-fields.ts
tests/admin-management.spec.ts
tests/admin-unit.spec.ts
tests/support/admin-api-fixture.mjs
```

Line-ending-only normalization required by formatting checks (no semantic Git diff):

```text
docs/phase-3-checkout-orders.md
src/app/api/products/[id]/reviews/route.ts
src/app/api/reviews/[id]/route.ts
src/app/api/wishlist/route.ts
src/app/wishlist/page.tsx
src/components/ui/customer-feedback.tsx
src/features/catalog/components/ProductCard.tsx
src/features/catalog/components/ProductDetails.tsx
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

Test results/screenshots and private runtime stores remain ignored. Both Git
repositories remain independent. Line-ending-only normalization is listed
separately; no accepted test logic is removed or weakened.

## Recommended Phase 6

Prioritize release hardening and authorized disposable-backend acceptance:
administrative threat/access review, secure provisioning/revocation, TLS/HSTS/CSP,
edge abuse controls, monitoring/redaction, protected disk/keys, recovery drills,
compatible audit remediation, accessibility and measured performance. A dedicated
capability endpoint, complete inactive inventory, conditional stock updates,
creation-idempotency/lookup and stronger same-field concurrency need separately
approved backend work. Customer/role administration, real payments and additional
analytics require explicit scope and verified contracts; none are proposed as
already implemented.
