# Everyday storefront

A Next.js storefront for the independent Laravel e-commerce API, with customer shopping and verified administrator store management. Phase 6 hardens the accepted features and assesses a **v1.0.0 portfolio/demo release candidate**; no release is published. The teal design is preserved. Real payments and customer/role administration remain outside the supported API.

**Release assessment:** CONDITIONAL GO for restricted local/controlled demonstrations; NO-GO for public deployment and real commercial operations. Private live-Laravel acceptance and target deployment validation remain pending. See the [Phase 6 evidence and limitations](docs/phase-6-release-hardening.md) and [single-host deployment guide](docs/deployment.md).

## Stack and setup

Next.js 16.4.5 App Router, React 19.3, strict TypeScript, Tailwind CSS 4, locally owned shadcn/ui primitives, Lucide React, native Fetch and Playwright. No dependencies were added for Phases 2–6. Consult the installed Next.js documentation before framework changes.

Requirements: Node.js 20.9+ (verified with 24.22.2), npm and the separately managed Laravel API. Run commands only in `ecommerce-frontend`:

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Use `npm` in shells without PowerShell's script restriction. Configure the exact browser origin and the server-reachable API URL, including `/api`:

```dotenv
LARAVEL_API_URL=http://127.0.0.1:8000/api
APP_ORIGIN=http://localhost:3000
```

Open that exact origin; `localhost` and `127.0.0.1` are different origins. Restart Next.js after environment changes. Development creates a random persistent encryption key and encrypted sessions in a private per-project directory under the user's temporary directory, outside this XAMPP web root. Temporary-directory cleanup ends development sessions and loses import recovery records. Never use this default for production.

`LARAVEL_API_URL` is server-only. `API_BASE_URL` remains a deprecated fallback. Never use `NEXT_PUBLIC_` for credentials, session keys or the Laravel bearer token. Keep local environment files untracked. The frontend does not connect directly to MySQL or manage Laravel migrations or seeders.

## Implemented behavior

| Route                                                               | Behavior                                                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `/`, `/products`                                                    | Catalog, category navigation, search, sorting, pagination and add-to-cart                           |
| `/products/[id]`                                                    | Product, stock, Laravel pricing, wishlist controls and paginated public reviews                     |
| `/wishlist`                                                         | Protected saved products, count, pagination, removal and existing cart controls                     |
| `/login`, `/register`                                               | Validated customer credentials, session rotation and safe internal return destinations              |
| `/account`                                                          | Server-verified public customer identity and sign-out                                               |
| `/cart`                                                             | Guest quantities and estimates, account cart, explicit guest import review and recovery             |
| `/checkout`                                                         | Authenticated current-cart review, demo consent and safe order placement/recovery                   |
| `/orders`                                                           | Owner-scoped newest-first order history, 10 records per page                                        |
| `/orders/[id]`                                                      | Historical purchase snapshots, authoritative order/payment/refund status                            |
| `/orders/[id]/confirmation`                                         | Read-only order confirmation; refresh never resubmits checkout                                      |
| `/orders/[id]/payment`                                              | Read-only simulated payment status and refresh                                                      |
| `/admin`                                                            | Verified administrator dashboard and UTC-filtered sales reports                                     |
| `/admin/products`                                                   | Active catalog, name/category/price filters, sorting, pagination and product editing                |
| `/admin/products/new`, `/admin/products/[id]`                       | Product creation, metadata changes, explicit stock updates, soft deletion and known-ID reactivation |
| `/admin/categories`                                                 | Paginated category creation, editing and deletion when unreferenced                                 |
| `/admin/discounts`, `/admin/discounts/new`, `/admin/discounts/[id]` | Discount strategies, UTC schedules, loyalty settings, assignments and deactivation                  |
| `/admin/orders`, `/admin/orders/[id]`                               | All authorized order snapshots, filtering and backend-validated status/cancellation actions         |

Guests can add, update and remove products without login. Storage contains only product IDs, quantities and an optional frozen import ID/snapshot. Account carts, prices, discounts and stock remain owned by Laravel. Guest totals are explicitly estimates from current public API prices; no discounts are calculated in Next.js. Adding products does not reserve inventory.

Wishlist controls on cards and details offer guests safe sign-in destinations without replaying a save after login. Signed-in customers save/remove products through Laravel; no guest wishlist or private browser-storage copy exists. Unavailable saved products remain removable. A bounded first page supplies the navigation count and known membership; products outside it offer duplicate-safe saving without claiming they are unsaved. Adding a saved product to the cart does not remove it from the wishlist.

Reviews are public, newest first, with Laravel's aggregate rating and count. The actual backend requires authentication, an active/non-deleted product and at most one review per customer/product; it does **not** require a purchase. Ratings are integers 1–5 and optional plain-text comments allow 5,000 Unicode characters. Customers edit/delete their own reviews; Laravel checks authorization. There is no personal-review lookup: an older review can be found through pagination. Unknown write outcomes require reading current reviews before another submission. See the [Phase 4 report](docs/phase-4-wishlist-reviews.md) for contracts, recovery and limitations.

Login/register preserves guest items and offers import review with the destination account shown. Matching quantities are added, unique account items are retained, and only confirmed transfers are removed from guest storage. Failed or ambiguous transfers remain recoverable. Logout invalidates the browser session, attempts API token revocation and clears browser cart state; it never deletes or copies the account cart. Clearing unimported guest items requires explicit confirmation.

Proceeding to checkout hands guests to login/register, reviewed guest import and authenticated checkout review. Outstanding browser guest items block checkout. Server-recorded incomplete cart additions also require completion or explicit review of the current account cart, including across tabs/devices. Legacy `?checkout=next-phase` links now lead to the implemented review.

**Demo / Simulated Payment — No Real Money Is Charged.** Laravel processes the simulated payment within the checkout transaction. Success creates a paid order, snapshots purchase prices and clears the purchased cart; a mock decline rolls back everything. There is no separate payment initiation/retry endpoint and no pending-payment workflow. The frontend collects no real payment credentials and submits no shipping/address/tax fields or payment simulation override headers.

Checkout refreshes Laravel cart values before placement. Changed quantities, pricing, discount eligibility or stock require renewed review. A random backend idempotency key and attempt progress are encrypted on the server per account. An uncertain outcome retains the same key across refresh, navigation, logout/login and server restarts. Recovery may return an existing order or place the explicitly reviewed cart if no order exists; it never silently creates a new logical attempt. See the [Phase 3 report](docs/phase-3-checkout-orders.md) for guarantees and limits.

## Architecture and security

```text
src/app/                  Pages and fixed-purpose same-origin BFF routes
src/features/catalog/     Existing catalog adapters, queries and presentation
src/features/auth/        Credential/user validation, session lifecycle and UI
src/features/cart/        Guest operations, account adapter, merge engine and UI
src/features/checkout/    Durable checkout workflow, review/consent and API adapter
src/features/orders/      Order/payment contracts, owner-scoped adapters and UI
src/features/wishlist/    Laravel wishlist adapter, session-scoped provider and UI
src/features/reviews/     Public review query, customer mutations, validation and UI
src/features/admin/       Capability verification, privileged adapters, workflows and management UI
src/lib/api/              Guarded server transport, configuration and safe errors
src/lib/bff/              Encrypted file store, locks, CSRF, cookies and responses
src/components/           Shared layout and presentation primitives
```

Browser -> opaque HttpOnly cookie -> Next.js BFF -> server-held Sanctum bearer token -> Laravel. The backend uses bearer authentication, with Sanctum SPA cookie authentication disabled. No Laravel cookie/CSRF/CORS flow is assumed. Browser mutations require exact origin verification, SameSite cookies and a session CSRF token. API responses are private and uncached. Backend authorization remains authoritative.

Laravel omits admin role from its user resource. The BFF verifies capability through a validated read of `admin/categories?per_page=1&page=1`, protected by `EnsureAdmin`; every privileged BFF operation rechecks it and retains the target endpoint's own authorization. Customer authentication, token abilities, email and browser role flags never establish admin permission. Admin pages also verify access on the server; navigation/data are scoped to the current verified session and hidden during revalidation. No account is created or promoted by this implementation.

Admin product reads are **active-only** because there is no full admin inventory endpoint. Known inactive IDs can be reactivated through the supported product patch; deleted products have no restore action. Stock edits explicitly replace the absolute count and have no backend revision protection. Category deletion refuses any product references, including soft-deleted products. Discount deletion deactivates while retaining assignments. Order cancellation uses Laravel's transaction for stock restoration and mock refunds; uncertain results require reading the order before another action. See the [Phase 5 report](docs/phase-5-admin-dashboard.md) for these constraints, exact contracts and recovery.

The persistent store supports **one Node host with durable private local disk**. Multiple processes on that host share exclusive file locks; serverless and multiple hosts are unsupported. Production requires all of:

```dotenv
APP_ORIGIN=https://shop.example
LARAVEL_API_URL=https://api.example/api
SESSION_DEPLOYMENT=single-host
SESSION_STORE_DIRECTORY=<absolute private durable directory outside every web root>
SESSION_ENCRYPTION_KEY=<random 32-byte base64 secret supplied privately>
```

Provision the directory and restrictive service-account ACLs before deployment. Do not use a directory beneath this repository or `htdocs`, or a temporary/ephemeral volume. Production fails safely when configuration is missing; there is no memory-store fallback. The encryption key and session directory must survive restarts together. Real remote deployments require HTTPS; explicit loopback HTTP supports local production-build tests only. See the [Phase 2 report](docs/phase-2-auth-cart.md) for operations, recovery and remaining release requirements.

The same private volume stores critical checkout idempotency/recovery records. Do not delete active attempts, unresolved import records or their encryption key. Losing them removes the frontend's ability to identify a prior logical attempt; recover the protected backup and manually reconcile purchases before accepting another attempt. Phase 6 adds no environment variables and enforces the documented absolute production storage path.

Documents now use a fresh script nonce and strict Content Security Policy, with request-time rendering including error pages. Production scripts allow neither unsafe-inline nor eval; styles retain an inline exception for React attributes. HTTPS production documents emit HSTS and insecure-request upgrades. Verify those controls at the real TLS edge; never publicly cache nonce-bearing HTML/RSC. Upstream JSON is bounded to 8 MiB decoded bytes within the eight-second deadline. Encrypted record writes reject unreadable sizes before replacing an existing checkpoint. See deployment guidance for Windows ACLs, quotas, stale locks and recovery.

## Validation

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run format:check
npm.cmd run test:unit
npm.cmd run build
npm.cmd test
npm.cmd audit --omit=dev
npm.cmd audit
```

`test:unit` is independent of Laravel and browsers. `npm.cmd test` uses the existing production build, installed Microsoft Edge and an existing populated catalog at `TEST_API_BASE_URL` (default `http://127.0.0.1:8000/api`). `test:e2e` runs browser/BFF integration checks only. Focus with `npm.cmd test -- --grep "test name"`.

Tests reserve ports 3100, 8101 and 8102, refuse occupied ports and stop only processes they launch. **All authentication, cart, checkout, payment, order, wishlist, review and admin traffic goes to isolated test-only Node fixtures**, with credentials and keys generated per run. Admin product reads/writes also stop at the fixture. Only public catalog GETs reach the actual Laravel API. Wishlist/review/admin fixtures reuse a validated public catalog snapshot; pagination requires at least 13 existing products. Synthetic admin permissions exist only in fixture memory. No backend users are created/promoted and no database fixtures are created. Local expiry/recovery tests alter only their owned encrypted temporary frontend records. This isolation is essential because even Laravel `GET /cart` can create database records.

The suite now contains 86 unit/transport checks and 102 browser/BFF integration checks, 188 total. All 170 accepted Phase 1–5 tests remain unchanged. Phase 6 adds bounded transport/storage, failure cleanup, CSP enforcement/hydration, keyboard/error focus, privacy and measured browser observations. The [Phase 6 report](docs/phase-6-release-hardening.md) records final results and evidence. Authenticated live-Laravel acceptance remains a separate task for an explicitly authorized disposable environment.

The audit reports zero production vulnerabilities and eight existing moderate findings in the development lint chain. No forced downgrade, audit fix or dependency upgrade was applied.

## Documentation and next work

- [Phase 6 security findings, P0/P1/P2 assessment, validation, acceptance checklist and release decisions](docs/phase-6-release-hardening.md)
- [Environment setup, single-host deployment, HTTPS/CSP, storage, logging and recovery](docs/deployment.md)
- [Phase 5 admin implementation, authorization, contracts, file manifest and manual acceptance](docs/phase-5-admin-dashboard.md)
- [Phase 4 wishlist/review implementation, verified eligibility, file manifest and manual checks](docs/phase-4-wishlist-reviews.md)
- [Phase 3 checkout/order implementation, idempotency, contracts, file manifest, validation and manual checks](docs/phase-3-checkout-orders.md)
- [Accepted Phase 2 authentication and cart foundation](docs/phase-2-auth-cart.md)
- [Verified Laravel contract inventory](docs/backend-contracts.md)
- [Historical Phase 1 architecture assessment](docs/architecture.md)
- [Historical authentication decision](docs/authentication-strategy.md)
- [Phase 1 delivery report](docs/phase-1-report.md)

Before public deployment, verify HTTPS cookies, private storage ACLs/durability, proxy rate limits, external CSP/HSTS/cache behavior, backup/restore and operational recovery. Complete private disposable-backend acceptance and broader screen-reader/browser checks. Cart import remains non-atomic; checkout idempotency relies on Laravel's customer-scoped key and the durable frontend checkpoint. There is no cart revision/quote lock or order lookup by idempotency key. Full inactive inventory, stock revisions, customer/role management and real payments require separately approved backend capabilities. No backend changes, commits, pushes, merges or releases are performed by this work.
