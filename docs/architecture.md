# Phase 1 architecture assessment and foundation

Assessment date: 9 November 2026. Scope: frontend foundation only. Laravel was inspected as a read-only contract reference; no authenticated or mutating workflows were executed.

## Starting architecture

The PoC already used App Router Server Components for catalog rendering, a small native-fetch wrapper, hand-written runtime validators, strict TypeScript, reusable cards and pricing components, and a single interactive navigation component. Search/filter/sort state lived in URLs. Laravel calculated all prices, discounts and inventory. These choices remain appropriate.

The main weaknesses were organizational and operational rather than visual:

| Finding                                                                                       | Phase 1 improvement                                                                              | Reason                                                                            |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Catalog code spread across global component, type and API directories                         | Colocate it in `features/catalog`                                                                | Future modules can own their contracts without enlarging shared folders           |
| Fetching orchestration and product identity checks lived in pages                             | Small server query functions; identity validation at the API boundary                            | Pages compose UI; adapters own response correctness                               |
| `API_BASE_URL` did not match the requested configuration name                                 | Canonical `LARAVEL_API_URL`, validated centrally; deprecated legacy fallback                     | Existing PoC environments keep working while deployment has a documented contract |
| Missing configuration silently selected a local API in production                             | Production requires an explicit URL and remote HTTPS                                             | Avoid accidental deployments pointing to an unintended local service              |
| Network, timeout, malformed JSON, invalid fields and configuration errors all became HTTP 503 | Typed `ApiError.code` with optional real HTTP status                                             | Distinguish transport failures from backend business/authentication responses     |
| JSON success responses had no media-type check                                                | Validate JSON content type, envelope and feature fields                                          | HTML error pages and contract drift must fail safely                              |
| Product responses could contain the wrong ID; checks were inconsistent                        | Both product and pricing IDs must match the request inside their parsers                         | Never display pricing for another product                                         |
| Pagination validated individual fields but not their relationships                            | Validate page counts, ranges and item counts, including empty/out-of-range pages                 | Avoid misleading pagination or silently inconsistent lists                        |
| Pure contract tests required the application test launcher                                    | Separate unit and E2E projects, using existing Playwright                                        | Configuration/HTTP tests run without Laravel, Edge or a build                     |
| HTTP wrapper behavior was untested                                                            | Unit and local HTTP integration tests                                                            | Check safety settings, status normalization and body/header timeouts              |
| Baseline response headers were absent                                                         | `nosniff`, frame denial, referrer policy, restricted browser permissions; disable `X-Powered-By` | Establish simple protections without changing storefront behavior                 |
| Duplicate `test-results` ignore entry                                                         | Remove duplicate                                                                                 | Keep repository conventions clear                                                 |

No authentication, shopping mutation, order or admin implementation was added. No packages were added, removed, upgraded or overridden.

## Current structure

```text
src/
  app/                       # Route composition, metadata, loading/error/not-found boundaries
  components/
    layout/                  # Shared Header and Footer
    ui/                      # Shared Button, Skeleton and API notice
  features/
    catalog/
      components/            # Presentation; no HTTP or environment access
      types/                 # Catalog response types and query types
      api/                   # Product/category adapters and runtime validators
      server/queries.ts      # Concurrent reads and partial-failure decisions
      product-query.ts       # URL query normalization and link construction
  lib/
    api/
      client.ts              # server-only entry point; sole runtime environment access
      config.ts              # Pure URL/environment validation
      request.ts             # Injectable native-fetch GET transport, no environment access
      errors.ts              # Safe normalized errors and HTTP status mapping
    format.ts                # MYR display formatting, no price calculations
    utils.ts                 # CSS class composition
tests/
  api-foundation.spec.ts      # Configuration, transport, local HTTP and validation checks
  contracts.spec.ts           # Existing pure catalog contract tests
  storefront.spec.ts          # Existing live-API regression tests plus identity/header checks
  support/                   # Read-only fault relay, owned-process launcher, screenshots
```

Future features should follow the catalog's proportions: `features/auth`, `cart`, `checkout`, `orders`, `wishlist`, `reviews`, and `admin`, added only when their phase begins. Do not create empty modules now. Introduce an application/service layer only for actual workflows, not as a mandatory four-folder template.

## Dependency and boundary conventions

1. Routes compose feature presentation and server query functions. Keep transport and backend-specific branching out of route JSX.
2. Feature components receive typed values. They do not fetch, access environment variables, or determine server authorization.
3. Feature API adapters know Laravel endpoint names and response schemas. Parse `unknown` at that boundary, retain monetary decimal strings, and project only fields the feature needs. Additional future resource validators belong to their owning features.
4. Shared infrastructure never imports catalog types. Do not create a generic repository hierarchy, dependency-injection container, global store, or combined client/server barrel.
5. `client.ts`, feature API adapters and server query functions use `server-only`. Pure parsers/configuration/transport remain directly testable; production code reaches transport through the guarded client. These pure modules have no environment reads or stored credentials.
6. Client Components are for interactions requiring browser state. Continue using native GET forms for catalog filters and server rendering for initial data.
7. Backend authorization is always authoritative. A hidden button or a Next.js route check is not permission to mutate Laravel data.

## Configuration and errors

`LARAVEL_API_URL` is server-only, includes the `/api` prefix, and overrides `API_BASE_URL` if both exist. The legacy name is a migration fallback, not a second upstream. Development/test can use the existing loopback default; production requires an explicit URL. Empty or malformed configured values fail rather than silently selecting another URL. Credentials, query strings, fragments, non-HTTP protocols and remote production HTTP are rejected. Loopback HTTP is allowed for local production-build verification.

Configuration is evaluated at request time, not module import time. `loadCatalog` explicitly awaits Next.js `connection()` before reading data. This keeps the homepage dynamic even when build-time environment variables are absent; a temporary configuration failure must not become a statically generated outage page. Deployment must still configure the URL before serving traffic.

`ApiError` has a controlled message, `code`, optional HTTP `status` and bounded numeric `retryAfterSeconds`. Codes cover configuration, network, timeout, invalid response, authentication, authorization, not found, validation, conflict, rate limit, server unavailability and other HTTP failures. No backend exception body, raw error message, URL, token or request payload is included. A timeout/network failure has no fabricated upstream HTTP status. Known statuses such as 401/403/404/409/422/429 are preserved.

Transport is intentionally GET-only. It has an eight-second timeout covering headers **and body**, explicit JSON acceptance, `no-store`, omitted credentials and redirect rejection. Endpoint paths cannot change origin or escape the configured API prefix. Public reads never copy incoming browser cookies or authorization headers. No automatic retries are performed, including after `Retry-After`; mutation retry semantics must be designed with their feature. Future 422 form handling should map only allowlisted fields and reviewed messages, not blindly render arbitrary upstream error text.

The UI retains the existing safe retry/empty/loading states. A pricing outage leaves product information visible; a category outage does not block product results. Catalog cards still show labeled base prices, and product details show Laravel-calculated public pricing. No discount arithmetic or speculative per-card pricing requests were introduced.

## Security limits

These changes are a foundation, not a production-readiness claim. Authentication/session storage, mutation CSRF protection, distributed session revocation, application rate limiting, monitoring/redaction, deployment TLS/HSTS and a nonce-compatible Content Security Policy remain future work. A blanket CSP was not added because Next.js streaming and script requirements need a tested policy. HSTS belongs to the actual HTTPS deployment and must not be guessed from local HTTP.

Keep backend errors private in future logs as well as UI. Add structured telemetry at the guarded server boundary with reviewed metadata, never serialized request/response objects. Use separate public and authenticated data-access functions once auth exists; authenticated responses must never share a cross-user cache.

See [backend contracts](backend-contracts.md), [authentication strategy](authentication-strategy.md), and [verification and roadmap](phase-1-report.md).
