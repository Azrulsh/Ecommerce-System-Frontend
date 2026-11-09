# Everyday storefront

A Next.js storefront for the independent Laravel e-commerce API. Phase 3 adds checkout review, idempotent demo order placement, mock payment results, confirmation, order history and order details to the accepted authentication and guest/account cart foundation. The teal storefront is preserved. Wishlist, review submission, administration and real payment processing remain outside this implementation.

## Stack and setup

Next.js 16.4.5 App Router, React 19.3, strict TypeScript, Tailwind CSS 4, locally owned shadcn/ui primitives, Lucide React, native Fetch and Playwright. No dependencies were added for Phase 2 or Phase 3. Consult the installed Next.js documentation before framework changes.

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

| Route                       | Behavior                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `/`, `/products`            | Catalog, category navigation, search, sorting, pagination and add-to-cart                        |
| `/products/[id]`            | Product, stock and Laravel pricing; eligible account pricing when identity verification succeeds |
| `/login`, `/register`       | Validated customer credentials, session rotation and safe internal return destinations           |
| `/account`                  | Server-verified public customer identity and sign-out                                            |
| `/cart`                     | Guest quantities and estimates, account cart, explicit guest import review and recovery          |
| `/checkout`                 | Authenticated current-cart review, demo consent and safe order placement/recovery                |
| `/orders`                   | Owner-scoped newest-first order history, 10 records per page                                     |
| `/orders/[id]`              | Historical purchase snapshots, authoritative order/payment/refund status                         |
| `/orders/[id]/confirmation` | Read-only order confirmation; refresh never resubmits checkout                                   |
| `/orders/[id]/payment`      | Read-only simulated payment status and refresh                                                   |

Guests can add, update and remove products without login. Storage contains only product IDs, quantities and an optional frozen import ID/snapshot. Account carts, prices, discounts and stock remain owned by Laravel. Guest totals are explicitly estimates from current public API prices; no discounts are calculated in Next.js. Adding products does not reserve inventory.

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
src/lib/api/              Guarded server transport, configuration and safe errors
src/lib/bff/              Encrypted file store, locks, CSRF, cookies and responses
src/components/           Shared layout and presentation primitives
```

Browser -> opaque HttpOnly cookie -> Next.js BFF -> server-held Sanctum bearer token -> Laravel. The backend uses bearer authentication, with Sanctum SPA cookie authentication disabled. No Laravel cookie/CSRF/CORS flow is assumed. Browser mutations require exact origin verification, SameSite cookies and a session CSRF token. API responses are private and uncached. Backend authorization remains authoritative.

The persistent store supports **one Node host with durable private local disk**. Multiple processes on that host share exclusive file locks; serverless and multiple hosts are unsupported. Production requires all of:

```dotenv
APP_ORIGIN=https://shop.example
LARAVEL_API_URL=https://api.example/api
SESSION_DEPLOYMENT=single-host
SESSION_STORE_DIRECTORY=<absolute private durable directory outside every web root>
SESSION_ENCRYPTION_KEY=<random 32-byte base64 secret supplied privately>
```

Provision the directory and restrictive service-account ACLs before deployment. Do not use a directory beneath this repository or `htdocs`, or a temporary/ephemeral volume. Production fails safely when configuration is missing; there is no memory-store fallback. The encryption key and session directory must survive restarts together. Real remote deployments require HTTPS; explicit loopback HTTP supports local production-build tests only. See the [Phase 2 report](docs/phase-2-auth-cart.md) for operations, recovery and remaining release requirements.

The same private volume now stores critical checkout idempotency/recovery records. Do not delete active attempts, unresolved import records or their encryption key. Losing them removes the frontend's ability to identify a prior logical attempt; recover the protected backup and manually reconcile purchases before accepting another attempt. No new environment variables are required for Phase 3.

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

Tests reserve ports 3100, 8101 and 8102, refuse occupied ports and stop only processes they launch. **All authentication, cart, checkout, payment and order traffic goes to isolated test-only Node fixtures**, with credentials and keys generated per run. Only public catalog GETs reach the actual Laravel API. No backend database fixtures are created. Local expiry/recovery tests alter only their own encrypted temporary frontend records. This isolation is essential because even Laravel `GET /cart` can create database records.

The suite has 49 unit/transport checks and 40 browser/BFF integration checks. All 60 Phase 1/2 checks remain. New coverage includes duplicate placement, stable keys across uncertainty/restarts, real request timeout, decline/rollback, price/discount changes, unresolved imports on another browser, order ownership/pagination, historical snapshots, refresh without resubmission, token privacy and responsive checkout/order layouts. Authenticated live-Laravel acceptance testing remains a separate task for an authorized disposable environment.

The audit reports zero production vulnerabilities and eight existing moderate findings in the development lint chain. No forced downgrade, audit fix or dependency upgrade was applied.

## Documentation and next work

- [Phase 3 checkout/order implementation, idempotency, contracts, file manifest, validation and manual checks](docs/phase-3-checkout-orders.md)
- [Accepted Phase 2 authentication and cart foundation](docs/phase-2-auth-cart.md)
- [Verified Laravel contract inventory](docs/backend-contracts.md)
- [Historical Phase 1 architecture assessment](docs/architecture.md)
- [Historical authentication decision](docs/authentication-strategy.md)
- [Phase 1 delivery report](docs/phase-1-report.md)

Before release, verify HTTPS cookies, private storage ACLs/durability, proxy rate limits, CSP/HSTS, backup/restore and operational recovery. Cart import remains non-atomic; checkout idempotency relies on Laravel's customer-scoped key and the durable frontend checkpoint. There is no cart revision/quote lock or order lookup by idempotency key. The recommended next work is disposable-environment acceptance and deployment hardening, followed by a separately scoped customer feature such as wishlist. Real payment processing requires a new, explicitly approved backend contract. No backend changes, commits, pushes, merges or releases are performed by this work.
