# Phase 1 delivery, verification and roadmap

Scope: architecture assessment and foundation, completed against the existing browsing-only storefront. See [architecture](architecture.md) for the assessment and dependency boundaries, [backend contracts](backend-contracts.md) for inspected capabilities, and [authentication strategy](authentication-strategy.md) for the future Sanctum decision.

## Implementation manifest

Moved into `src/features/catalog` and updated imports:

- `components/products/*.tsx` → `features/catalog/components/`: `CategoryNavigation`, `Pagination`, `ProductCard`, `ProductDetails`, `ProductFilters`, `ProductGrid`, `ProductGridSkeleton`, `ProductPlaceholder`, `ProductPrice`.
- `lib/api/products.ts`, `categories.ts`, `validation.ts` → `features/catalog/api/`.
- `types/product.types.ts`, `category.types.ts` → `features/catalog/types/`.
- `lib/product-query.ts` → `features/catalog/product-query.ts`.

Created:

- `src/features/catalog/server/queries.ts`: concurrent catalog reads and product-details outcomes, with request-time rendering.
- `src/lib/api/config.ts`: validated canonical server configuration with legacy compatibility.
- `src/lib/api/errors.ts`: safe typed errors and HTTP status normalization.
- `src/lib/api/request.ts`: testable native-fetch public GET transport.
- `tests/api-foundation.spec.ts`: configuration, error, timeout, path-containment and pagination tests.
- The four Phase 1 documents in `docs/`.

Updated:

- `src/lib/api/client.ts`: thin server-only environment/transport boundary.
- Moved catalog product adapter and validator: ID matching and consistent pagination metadata.
- `src/app/page.tsx`, `src/app/products/page.tsx`, `src/app/products/[id]/page.tsx`: use feature query functions.
- `src/app/loading.tsx`, `src/app/products/loading.tsx`: updated catalog skeleton imports.
- `.env.example`: `LARAVEL_API_URL`, production configuration and legacy migration notes.
- `.gitignore`: removed duplicate generated-test-output entry.
- `next.config.ts`: baseline response headers and `poweredByHeader: false`.
- `package.json`, `playwright.config.ts`: separate unit/E2E commands and projects, expanded formatting scope.
- `tests/contracts.spec.ts`, `tests/storefront.spec.ts`, `tests/support/run-tests.mjs`, `tests/support/api-relay.mjs`: new feature paths, canonical environment variable, response-header checks and wrong-product/pricing fault injection.
- `README.md`: current setup, structure, behavior and documentation links.

The component markup, styles, storefront routes, catalog filtering behavior, monetary display and API source of truth are preserved. No dependency inputs or lockfile versions changed; only package scripts changed. No future feature folders or unused backend models were created.

## Verification

The test runner starts only its own Next.js production server and read-only test relay; it never starts or modifies Laravel. Tests compare existing catalog data against live API responses. Unit/local HTTP tests need neither Laravel nor a browser.

| Check                                             | Result                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                                            | Passed                                                                                                                          |
| Strict TypeScript and generated route types       | Passed                                                                                                                          |
| Formatting, including documentation/configuration | Passed after normalizing the existing shadcn configuration formatting                                                           |
| Standalone unit/local HTTP suite                  | 21 passed without Laravel or browser fixtures                                                                                   |
| Complete regression suite                         | 32 passed in 2.5 minutes: 21 unit/local HTTP checks and 11 storefront E2E/streaming checks; no skips                            |
| Production build                                  | Passed; `/`, `/products`, `/products/[id]` remain request-rendered                                                              |
| Read-only Laravel checks                          | Existing catalog, categories, public pricing/reviews, unauthenticated 401, invalid-sort 422 and CORS OPTIONS preflight verified |
| Production dependency audit                       | Passed; zero vulnerabilities                                                                                                    |
| Complete dependency audit                         | Exit 1; eight moderate development-tool findings, described below                                                               |
| Backend repository                                | Clean before and after work; no source/config/database modifications or backend test execution                                  |

The build was also checked without a build-time backend URL: the homepage stays dynamic through the explicit request-time boundary. Test server ports were released after the final suite. The existing development process was not stopped. No authenticated backend runtime behavior is claimed as verified.

Security audit found eight moderate development-only findings in the existing `eslint-config-next` → `typescript-eslint` → `minimatch` chain ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)). `npm audit --omit=dev` found zero vulnerabilities. The suggested automatic audit fix selects `eslint-config-next` 15.5.29, a major downgrade from the current 16.4.5. No audit fix, overrides or dependency upgrades were applied. Follow up with a compatible upstream lint dependency update and rerun checks; do not downgrade the framework lint config blindly.

The browser environment previously did not reliably expose the brief initial skeleton state. The retained direct streaming test checks that loading HTML arrives before product HTML. This is not a full assistive-technology audit. Existing mobile keyboard and overflow checks remain in the E2E suite.

## Remaining risks and unsupported capabilities

- No authentication or mutation protections are implemented because those features are out of scope. Their release must be gated on server-side sessions, CSRF protection, authorization verification and isolated tests.
- Sanctum here is bearer-only. A Next.js opaque-session BFF is the recommended compatible future design; no Laravel SPA cookie login should be assumed. Distributed token/session storage and deployment secret management remain decisions for Phase 2.
- Backend user resources omit admin permission. Resolve capability discovery before role-dependent navigation; do not infer it from loyalty or email.
- No refresh token, password reset, email verification, profile editing, all-device logout, customer cancellation, product media upload, featured flag, real gateway or shipping/address contract was found in the reviewed routes/resources. A complete inactive-product admin listing is also absent. Document these constraints in any future UI.
- Production requires explicit server configuration and remote HTTPS. TLS termination, HSTS, a tested Content Security Policy, monitoring/redaction, alerting and deployment health checks are not completed by this local foundation.
- Backend per-IP rate limits can aggregate BFF traffic; coordinate trusted proxy handling with the backend owner and add frontend abuse protection.
- Runtime validators cover the catalog only. Review current backend validators/resources again before implementing each future module. Authenticated workflows were inspected in source/tests but not executed.
- Public catalog pricing remains uncached and rate-limited; personalized caches must not be introduced across customers. Preserve backend-calculated decimal amounts and nullable totals.
- The current audit is a dependency/advisory check and focused code assessment, not a penetration test or production certification.

## Recommended roadmap

| Phase                               | Deliverable                                                                            | Exit criteria                                                                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 — Authentication/session boundary | Login, registration, opaque server sessions, logout and authenticated user projection  | Choose shared protected session storage; exact-origin and CSRF checks; token expiry/revocation and 401 handling; no token in browser data/storage; authorized isolated auth tests       |
| 3 — Customer catalog interactions   | Server-authorized cart, wishlist and reviews; authenticated pricing                    | Use exact item/product IDs; honor nullable prices and availability; validate writes; test ownership, duplicate actions and partial failures                                             |
| 4 — Checkout and order history      | Mock-checkout flow, immutable order details and payment status                         | Same-attempt idempotency key reuse; uncertain-response recovery; server totals/inventory authoritative; no invented gateway/shipping UI                                                 |
| 5 — Administration                  | Authorized catalog/category/discount/order/reporting views supported by current routes | Resolve capability discovery and inactive-product listing limitation; enforce Laravel permissions; test workflow conflicts and terminal states                                          |
| 6 — Release hardening               | Deployment, operational security, performance and accessibility                        | TLS/HSTS/CSP/session-store readiness; compatible dependency remediation; rate-limit/monitoring plan; failure/abuse testing; broader accessibility checks and release rollback procedure |

Each phase should remain a separate, explicitly scoped task. Backend changes needed to remove limitations require separate authorization and work in the backend repository. Nothing was committed, pushed, merged or released in Phase 1.
