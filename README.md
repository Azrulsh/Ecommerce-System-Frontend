# Everyday storefront

A Next.js frontend for the independent Laravel e-commerce API. The working storefront currently supports browsing; Phase 1 establishes the architecture and security foundation for later customer and administrative features. It does not implement those features or claim production readiness.

## Stack

Next.js 16.4.5 App Router, React 19.3, strict TypeScript, Tailwind CSS 4, locally owned adapted shadcn/ui primitives, Lucide React, native Fetch, ESLint, Prettier and Playwright. Existing versions and lockfile are retained. Read the installed Next.js guides in `node_modules/next/dist/docs/` before framework changes.

## Setup

Requirements: Node.js 20.9+ (verified with 24.22.2), npm, and the separately managed Laravel API with an existing catalog. Run commands only in `ecommerce-frontend`:

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Open the URL printed by Next.js, normally `http://localhost:3000`. Use `npm` on shells without Windows PowerShell's script execution restriction.

Configure `.env.local` or deployment environment:

```dotenv
LARAVEL_API_URL=http://127.0.0.1:8000/api
```

Include the `/api` prefix. The URL must be reachable by the **Next.js server**. It is server-only and must not use a `NEXT_PUBLIC_` prefix. Restart Next.js after changing it.

`API_BASE_URL` remains a deprecated fallback for existing PoC environments; `LARAVEL_API_URL` takes precedence. Development/test can default to the existing local URL. Production requires an explicit URL and HTTPS for remote services. Explicit loopback HTTP is supported for local production-build verification. Invalid configuration fails safely without exposing its value. The production build does not need API credentials or a running backend; runtime traffic does need valid configuration.

Local environment files are ignored; `.env.example` is a safe tracked template. Do not put tokens, database credentials or other secrets into browser code. The frontend never connects to MySQL, starts Laravel, runs migrations/seeders or alters the backend. Keep both repositories independent.

## Current behavior

| Route            | Function                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `/`              | Existing teal hero, live category links and four products from the first catalog page                  |
| `/products`      | Name search, category slug filter, base-price/name sorting, backend pagination at 12 products per page |
| `/products/[id]` | Product information, category, SKU, stock, original/discount/final prices and applied promotion        |

URL filters use a native GET form. Applying filters resets pagination; page links preserve filters. Shared components provide responsive navigation, focus indicators, Escape handling, loading skeletons, empty results, helpful retry states and missing-product handling. The visual direction and browsing functionality are preserved.

Catalog cards show clearly labeled **base prices**. Detail prices and discounts come directly from Laravel. No discounts or totals are calculated in the frontend. MYR display follows the existing backend documentation; products do not supply a currency field. Product images are unavailable in the API and use honest placeholders. Homepage products use the first four name-sorted records because no featured flag exists.

Authentication, accounts, cart, wishlist, reviews, checkout, orders and admin UI remain unimplemented. Backend capability does not imply a frontend feature exists.

## Architecture and API integration

```text
src/
  app/                         # Routing and page composition
  components/layout/           # Shared navigation and footer
  components/ui/               # Shared presentation primitives
  features/catalog/
    components/                # Product/category presentation
    types/                     # Catalog contract types
    api/                       # Laravel adapters and runtime validation
    server/queries.ts          # Data orchestration and partial-failure decisions
    product-query.ts           # Safe URL query handling
  lib/api/                     # Shared server client, configuration, errors and transport
  lib/format.ts, utils.ts      # Shared display/CSS utilities
```

Runtime data flows from route → feature server query → feature API adapter → guarded HTTP client → Laravel. Validated feature values flow back into presentation. Shared infrastructure has no catalog dependencies. New feature directories should be introduced only when that feature is implemented.

The four existing integration endpoints remain `GET /api/products`, `/api/categories`, `/api/products/{id}` and `/api/products/{id}/price`. Independent reads run concurrently. There are no per-card price requests. Requests use explicit `no-store`, JSON acceptance, omitted credentials, an eight-second timeout and disabled redirects. Runtime validation checks JSON/media type, response fields, product identity and pagination consistency. Failures become safe typed errors; raw upstream diagnostics are never shown. No browser cookies or tokens are forwarded by the public client.

The homepage explicitly stays request-rendered even when deployment configuration is unavailable during the build. Price failure keeps product information visible; category failure keeps search/sorting usable. Response headers add `nosniff`, frame denial, a referrer policy and restricted browser permissions. Personalized caching and mutation transport are not added speculatively.

Phase 1 documents:

- [Architecture assessment and conventions](docs/architecture.md)
- [Verified backend contract inventory](docs/backend-contracts.md)
- [Future Sanctum authentication strategy](docs/authentication-strategy.md)
- [Changed-file manifest, validation, risks and roadmap](docs/phase-1-report.md)

The backend currently uses **Sanctum bearer tokens, not SPA session-cookie login**. The recommended future integration is a same-origin Next.js BFF with an opaque HttpOnly frontend session and protected server-side token storage. That strategy is documented only; no auth routes or token storage were implemented.

## Checks and development commands

```powershell
npm.cmd run dev
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run format:check
npm.cmd run test:unit
npm.cmd run build
npm.cmd test
npm.cmd start
```

`test:unit` runs configuration/contract tests and local HTTP integration checks without Laravel, Edge or a production build. `npm.cmd test` runs both test projects using an already built frontend and an existing populated Laravel API. `npm.cmd run test:e2e` runs only storefront regressions. Focus a run with `npm.cmd test -- --grep "test name"`.

Browser tests use installed Microsoft Edge (`channel: msedge`). Configure another supported browser if needed. Tests reserve ports 3100 and 8101, refuse to reuse existing servers, and stop only their own Node processes. Set `TEST_API_BASE_URL` to test another existing API. The test-only relay forwards GET requests to Laravel and injects faults only in its own responses; control writes never reach Laravel. It does not create fixtures, authenticate or mutate backend data.

The suite covers real catalog results, filtering, sorting, pagination, stock, exact monetary values, unavailable/malformed responses, timeouts, partial failures, mismatched product identities, response headers, streamed loading HTML, keyboard access and overflow at 320/375/768/1440 pixels. Transient browser skeleton visibility is not reliably observable here; direct streaming is verified instead. With a dev server at `http://localhost:3000`, `node tests/support/capture.mjs` saves ignored desktop/mobile screenshots.

## Security and remaining work

The dependency audit currently reports eight moderate development-tool findings through the ESLint/TypeScript lint chain and zero production-dependency vulnerabilities. The suggested automated fix downgrades `eslint-config-next`; no forced fix or upgrades were applied. Details and final check results are in the Phase 1 report.

Future phases must establish server sessions, CSRF/mutation protection, authorization, isolated authenticated tests, deployment TLS/HSTS/CSP, rate limiting and operational monitoring before release. The backend has no exposed refresh/password-reset/profile-update contracts, no admin capability in the user resource and no real gateway/shipping contract. Document these limits rather than inventing flows. See the roadmap for the recommended sequence. No backend modifications, commits, pushes, merges or releases were performed.
