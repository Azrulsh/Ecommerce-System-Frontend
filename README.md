# Everyday storefront — integration proof of concept

A minimal, responsive Next.js storefront connected to the existing Laravel 12 REST API. This repository is independent of `ecommerce-system`. All catalog and pricing data comes from Laravel; the frontend does not connect to MySQL.

## Stack

- Next.js 16.4.5 App Router, React 19.3, strict TypeScript
- Tailwind CSS 4, Lucide React icons
- Locally owned, adapted shadcn/ui Button and Skeleton primitives with class-variance-authority, clsx and tailwind-merge; configuration in `components.json`
- Server Components and native Fetch API; no global state manager
- ESLint, Prettier and Playwright (development tools)

The Next.js and React versions supplied by the existing project are retained. Follow the version-specific guides in `node_modules/next/dist/docs/` before changing framework code.

## Prerequisites and setup

- Node.js 20.9+ (verified with Node 24.22.2) and npm
- The separately managed Laravel API running at `http://127.0.0.1:8000`, with its database already configured and catalog records available
- Public GET access to the four endpoints below; no API credentials are needed

Run installation commands **only in this frontend repository**:

```powershell
cd C:\xampp\htdocs\ecommerce-frontend
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Open the Local URL printed by Next.js (normally `http://localhost:3000`). On shells without the Windows PowerShell execution policy restriction, `npm` can be used instead of `npm.cmd`.

Configure the server-only variable in `.env.local`:

```dotenv
API_BASE_URL=http://127.0.0.1:8000/api
```

Include `/api` in the URL. This is also the local development fallback if the variable is absent. Restart Next.js after changing environment configuration. In another environment, this URL must be reachable from the **Next.js server**, not merely from the browser. Use HTTPS for remote services. Do not put secrets in `NEXT_PUBLIC_` variables. Local environment files are ignored by Git; `.env.example` is the safe tracked template.

The frontend never starts, installs, migrates, seeds or modifies Laravel. Manage backend readiness separately according to its own documentation. Frontend tests send only public GET requests to Laravel and never alter its database.

## Pages and features

| Route | Behavior |
| --- | --- |
| `/` | Teal gradient hero, real category navigation and four products from the first catalog page |
| `/products` | Product-name search, category slug filter, price/name sorting and Laravel pagination (12 per page) |
| `/products/[id]` | Name, description, category, SKU, availability, original price, discount amount, final price and applied promotion |

Shared components provide responsive navigation, footer, product cards, image placeholders, filters, pagination, pricing, skeletons, empty results, retry messages and a missing-product page. Controls have visible labels and focus indicators; mobile navigation supports Escape and returns focus to its toggle. Reduced-motion preferences are respected.

Catalog filters use a standard GET form and URL query parameters. Apply filters with the button or Enter in the search input. Changing filters resets the page; pagination retains the applied filters. This works without client-side JavaScript and supports browser history and shareable URLs.

## API integration

| Laravel endpoint | Frontend use |
| --- | --- |
| `GET /api/products` | Homepage and paginated catalog; `search`, `category`, `sort`, `page`, `per_page` |
| `GET /api/categories` | Homepage category links and catalog filter options |
| `GET /api/products/{id}` | Product details |
| `GET /api/products/{id}/price` | Server-calculated public pricing and applied discount |

Contracts were checked against the backend controllers, request validation, API Resources and live JSON responses. Categories and products arrive under `data`; catalog pagination arrives under `meta`. Monetary values are decimal strings. Public prices are displayed in MYR, consistent with the existing backend documentation and catalog; the catalog endpoint does not provide a currency field.

- API modules are guarded with `server-only`; the browser receives rendered data, not integration credentials.
- Every request uses `Accept: application/json`, explicit `no-store`, an eight-second timeout and disabled redirects. Network errors and invalid responses become safe messages without exposing internal exceptions.
- `validation.ts` validates unknown response envelopes, fields, decimal amounts, categories and pagination before rendering. Search/category inputs are bounded scalar strings; sorting is allowlisted and query strings use `URLSearchParams`.
- Homepage and catalog fetch their products and categories concurrently. Details fetch the product and price concurrently. There are no per-card price requests.
- **Catalog cards show the base `price`, clearly labeled.** Sorting follows Laravel's base-price ordering. The detail page displays `original_price`, `discount_amount`, `final_price` and `applied_discount` directly from the pricing endpoint. No discounts or percentages are calculated in the frontend.
- If current pricing is unavailable, product information remains visible with a retry message. A failed category request does not prevent product browsing.
- Product cards disable speculative detail prefetching to avoid unnecessary product/pricing requests.
- The API has no product image field. Explicit image-unavailable placeholders preserve layout; no product image URLs or product records are invented.

## Structure and changed files

```text
src/
  app/
    page.tsx, layout.tsx, globals.css, icon.svg
    error.tsx, loading.tsx, not-found.tsx
    products/
      page.tsx, loading.tsx
      [id]/page.tsx, loading.tsx
  components/
    layout/Header.tsx, Footer.tsx
    products/
      CategoryNavigation.tsx, ProductCard.tsx, ProductGrid.tsx
      ProductGridSkeleton.tsx, ProductPlaceholder.tsx
      ProductFilters.tsx, Pagination.tsx
      ProductDetails.tsx, ProductPrice.tsx
    ui/button.tsx, skeleton.tsx, api-notice.tsx
  lib/
    api/client.ts, products.ts, categories.ts, validation.ts
    product-query.ts, format.ts, utils.ts
  types/product.types.ts, category.types.ts
```

Added configuration/support: `.env.example`, `components.json`, `.prettierignore`, `playwright.config.ts`, `tests/contracts.spec.ts`, `tests/storefront.spec.ts`, and the API relay, test runner and screenshot capture scripts in `tests/support/`. Updated existing files: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `package.json`, `package-lock.json`, `.gitignore`, and this README. The starter `src/app/favicon.ico` is replaced by `icon.svg`. All other files in the structure above are newly added.

## Development and verification

```powershell
npm.cmd run dev
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run format:check
npm.cmd run build
npm.cmd start
```

For browser and contract tests, build first, leave Laravel running, then run:

```powershell
npm.cmd run build
npm.cmd test
```

The default browser is the installed Microsoft Edge (`channel: msedge`). If Edge is unavailable, change the Playwright channel for your environment and install a supported browser. Tests reserve frontend port 3100 and test relay port 8101; they do not reuse or stop an existing development server. The test runner starts and stops only its own Node child processes. Use `npm.cmd test -- --grep "test name"` for a focused run.

With a development server already running at `http://localhost:3000`, `node tests/support/capture.mjs` saves desktop/mobile screenshots under the ignored `test-results/preview/` directory.

The test-only relay normally forwards live GET responses to Laravel. Fault injection changes only the relay's in-memory state to simulate an unavailable service, malformed JSON, slow responses, timeouts, unavailable categories or unavailable pricing. This relay is never part of the app's normal integration and never forwards writes to Laravel. Set `TEST_API_BASE_URL` to target a different existing API during tests. Browser tests assume a nonempty existing catalog and do not seed fixtures.

Tests compare actual rendered products, filtered/sorted/paginated lists and monetary values against live responses. They also cover stock availability, empty/missing products, recovery, partial failures, keyboard navigation and layout overflow at mobile, tablet and desktop widths. A direct streaming test confirms that skeleton HTML arrives before product content; transient skeleton visibility was not reliably observable in this browser environment. A few contract tests validate unsafe query inputs and malformed response data.

Verification results from this implementation:

| Check | Result |
| --- | --- |
| Development storefront | Existing Next.js server serves HTTP 200 at `http://localhost:3000`; its process was preserved |
| Live Laravel connectivity | All four public GET endpoints verified against existing records |
| Browser, streaming and contract suite | 12 passed in 2.3 minutes; no skipped tests |
| Responsive layouts and keyboard navigation | Passed at 320, 375, 768 and 1440 pixels; desktop/mobile screenshots inspected |
| ESLint | Passed |
| Strict TypeScript and generated route types | Passed |
| Prettier check | Passed |
| Production build | Passed; storefront routes render dynamically on the server |
| Production dependency audit | Zero vulnerabilities |
| Complete dependency audit | Eight moderate development-tool findings; see limitations below |
| Backend repository | Clean working tree; no backend or database changes performed |

The initial browser assertion for transient skeleton visibility failed. Direct streaming verification then confirmed that skeleton HTML is delivered before the resolved product HTML; that deterministic check is included in the final passing suite. No browser security settings were changed. The test runner also avoids this Windows environment's hanging process-tree teardown by stopping only the Node children it started. No commits or pushes were made.

## Limitations and next steps

This is a browsing-only proof of concept, not a production-ready store. Authentication, accounts, cart, checkout, payments, order management and admin UI are intentionally outside its scope. There are no buttons implying these features exist.

- Homepage products use the first four name-sorted records; the API has no featured-product flag.
- No photography is available in the current product contract.
- Currency is MYR; multi-currency display needs an explicit backend contract.
- Only public, unauthenticated discounts apply; loyalty eligibility stays with Laravel.
- No persistent catalog cache: freshness is preferred for the PoC. Requests are subject to backend rate limits.
- Browser tests require a reachable, populated API. They compare current state, so concurrent catalog edits may affect a run.
- Dependency audit reports eight moderate findings in the development-only ESLint/TypeScript lint chain through minimatch. The suggested automatic fix downgrades `eslint-config-next`; no forced dependency downgrade was applied. `npm audit --omit=dev` reports zero vulnerabilities.

Future work could add backend-provided product media and featured flags, dedicated product metadata, richer accessibility audits, contract-driven caching and, in a separately authorized phase, customer authentication and transactional shopping features.

Suggested commit message: `feat: add Laravel-integrated storefront proof of concept`
