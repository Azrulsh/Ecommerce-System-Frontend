# Everyday storefront

A Next.js storefront for the independent Laravel e-commerce API. Phase 2 adds customer authentication, persistent guest shopping, account carts and reviewed guest imports while preserving the existing teal storefront. Checkout, payments, orders, wishlist, review submission and admin UI remain future work.

## Stack and setup

Next.js 16.4.5 App Router, React 19.3, strict TypeScript, Tailwind CSS 4, locally owned shadcn/ui primitives, Lucide React, native Fetch and Playwright. No dependencies were added for Phase 2. Consult the installed Next.js documentation before framework changes.

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

| Route                 | Behavior                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `/`, `/products`      | Catalog, category navigation, search, sorting, pagination and add-to-cart                        |
| `/products/[id]`      | Product, stock and Laravel pricing; eligible account pricing when identity verification succeeds |
| `/login`, `/register` | Validated customer credentials, session rotation and safe internal return destinations           |
| `/account`            | Server-verified public customer identity and sign-out                                            |
| `/cart`               | Guest quantities and estimates, account cart, explicit guest import review and recovery          |

Guests can add, update and remove products without login. Storage contains only product IDs, quantities and an optional frozen import ID/snapshot. Account carts, prices, discounts and stock remain owned by Laravel. Guest totals are explicitly estimates from current public API prices; no discounts are calculated in Next.js. Adding products does not reserve inventory.

Login/register preserves guest items and offers import review with the destination account shown. Matching quantities are added, unique account items are retained, and only confirmed transfers are removed from guest storage. Failed or ambiguous transfers remain recoverable. Logout invalidates the browser session, attempts API token revocation and clears browser cart state; it never deletes or copies the account cart. Clearing unimported guest items requires explicit confirmation.

Proceeding to checkout hands guests to login/register, then reviewed import and the authenticated cart with a future-phase notice. No checkout or payment request is sent.

## Architecture and security

```text
src/app/                  Pages and fixed-purpose same-origin BFF routes
src/features/catalog/     Existing catalog adapters, queries and presentation
src/features/auth/        Credential/user validation, session lifecycle and UI
src/features/cart/        Guest operations, account adapter, merge engine and UI
src/lib/api/              Guarded server transport, configuration and safe errors
src/lib/bff/              Encrypted file store, locks, CSRF, cookies and responses
src/components/           Shared layout and presentation primitives
```

Browser ? opaque HttpOnly cookie ? Next.js BFF ? server-held Sanctum bearer token ? Laravel. The backend uses bearer authentication, with Sanctum SPA cookie authentication disabled. No Laravel cookie/CSRF/CORS flow is assumed. Browser mutations require exact origin verification, SameSite cookies and a session CSRF token. API responses are private and uncached. Backend authorization remains authoritative.

The persistent store supports **one Node host with durable private local disk**. Multiple processes on that host share exclusive file locks; serverless and multiple hosts are unsupported. Production requires all of:

```dotenv
APP_ORIGIN=https://shop.example
LARAVEL_API_URL=https://api.example/api
SESSION_DEPLOYMENT=single-host
SESSION_STORE_DIRECTORY=<absolute private durable directory outside every web root>
SESSION_ENCRYPTION_KEY=<random 32-byte base64 secret supplied privately>
```

Provision the directory and restrictive service-account ACLs before deployment. Do not use a directory beneath this repository or `htdocs`, or a temporary/ephemeral volume. Production fails safely when configuration is missing; there is no memory-store fallback. The encryption key and session directory must survive restarts together. Real remote deployments require HTTPS; explicit loopback HTTP supports local production-build tests only. See the [Phase 2 report](docs/phase-2-auth-cart.md) for operations, recovery and remaining release requirements.

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

Tests reserve ports 3100, 8101 and 8102, refuse occupied ports and stop only processes they launch. **All authentication/cart mutations go to an isolated test-only Node fixture**, with credentials and keys generated per run. Only public catalog GETs reach the actual Laravel API. No backend database fixtures are created. Local expiry tests alter only their own encrypted temporary frontend session records. This isolation is essential because even Laravel `GET /cart` can create database records.

The suite has 35 unit/transport checks and 25 browser/BFF integration checks, covering the prior storefront regressions plus authentication, token privacy, CSRF, rotation, expiry, ownership, partial/uncertain merges, logout/relogin, account switching, cross-tab state, corrupted/unavailable storage, price/stock refresh and responsive layouts. Authenticated live-Laravel acceptance testing remains a separate task for an authorized disposable environment.

The audit reports zero production vulnerabilities and eight existing moderate findings in the development lint chain. No forced downgrade, audit fix or dependency upgrade was applied.

## Documentation and next work

- [Phase 2 implementation, merge algorithm, file manifest, validation, security risks and manual checks](docs/phase-2-auth-cart.md)
- [Verified Laravel contract inventory](docs/backend-contracts.md)
- [Historical Phase 1 architecture assessment](docs/architecture.md)
- [Historical authentication decision](docs/authentication-strategy.md)
- [Phase 1 delivery report](docs/phase-1-report.md)

Before release, verify HTTPS cookies, private storage ACLs/durability, proxy rate limits, CSP/HSTS and operational recovery. Merge is neither atomic nor exactly-once: Laravel has no cart idempotency/bulk/CAS contract. Unknown writes are never automatically replayed. The recommended next feature phase is the existing idempotent checkout/mock-payment/order flow, after live integration acceptance and deployment hardening. No backend changes, commits, pushes, merges or releases are performed by this work.
