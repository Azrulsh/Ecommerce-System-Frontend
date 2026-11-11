# Single-host portfolio demonstration deployment

Phase 6 prepares a **v1.0.0 portfolio/demo release candidate**, not a published
release. No environment was deployed by this work. Public deployment remains
NO-GO until its environment and disposable-backend acceptance are verified.
Mock checkout does not support real commercial transactions.

## Local setup

Use Node.js 20.9+ and npm (the validation report records the actual version).
Manage Laravel separately; the frontend never installs PHP dependencies, changes
its database, runs migrations or provisions administrators. The API must already
be running and have a catalog. From this frontend repository:

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Set `LARAVEL_API_URL=http://127.0.0.1:8000/api` and
`APP_ORIGIN=http://localhost:3000`, then visit that exact browser origin.
Restart Next after changing environment variables. The development store/key live
in an OS temporary directory outside the checkout; OS cleanup loses development
sessions and workflow recovery. Use no real purchase data in a disposable demo.

## Runtime configuration

| Variable                  | Requirement                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `LARAVEL_API_URL`         | Server-reachable Laravel API URL including `/api`; HTTPS for remote production             |
| `APP_ORIGIN`              | Exact external browser origin, without credentials/path/query; HTTPS for remote deployment |
| `SESSION_DEPLOYMENT`      | `single-host` in production                                                                |
| `SESSION_STORE_DIRECTORY` | Absolute durable private directory outside the checkout, all web roots and HTTP aliases    |
| `SESSION_ENCRYPTION_KEY`  | Random 32-byte base64 secret supplied privately; never a `NEXT_PUBLIC_` variable           |

`API_BASE_URL` remains a deprecated fallback; prefer `LARAVEL_API_URL`. No database
credentials belong in Next.js. Keep `.env.local`, secrets and records untracked.
Do not expose the repository itself through Apache/XAMPP; only proxy the running
Next server. Known web-root paths are rejected, but arbitrary aliases, symbolic
links and NTFS access cannot be established by lexical configuration checks.

Provision the directory under the actual service identity. POSIX uses directories
0700/files 0600. On Windows, set and inspect NTFS ACLs explicitly: only the service
account and authorized operators should access the directory/key/backups. Node
`chmod` is not proof of equivalent Windows isolation. Reject publicly served,
shared-user, ephemeral, network or multi-host storage. Never mount this volume
as static assets or serve backups from it.

Keep the encryption key separately in protected deployment configuration. Preserve
it and the entire store together across restarts and upgrades. Key replacement
cannot decrypt existing records; there is no automatic key-rotation migration.
Missing/invalid configuration, corrupt records, wrong keys or inaccessible disk
fail safely, with no memory-store or unencrypted fallback.

## Build and run

Build from a clean dependency install and run the release checks in README.
The test launcher requires the existing production build; never rebuild while
that launcher or another process is using the same `.next` directory.

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

For a separately approved deployment, inject the production variables into the
service and use `npm.cmd run start -- --hostname 127.0.0.1 --port 3000` behind its
TLS reverse proxy. Use a supervised service, not a developer terminal. A build
passing without private environment values does not verify runtime configuration.
Install runtime dependencies with the lockfile; development tooling is required
in the build/check environment, not as a public HTTP service. Do not run Next dev
on the public Internet. Keep Node/framework dependencies maintained.

## HTTP and proxy controls

- Terminate HTTPS on a verified certificate and redirect public HTTP to HTTPS.
  Forward to the single Node host on a private/loopback interface. Restrict direct
  access to internal Node, Laravel and fixture ports.
- Next issues `__Host-everyday_session` with Secure, HttpOnly, SameSite=Lax, Path=/
  and no Domain on HTTPS. Loopback HTTP is supported only for local verification.
  Do not rewrite Origin headers to make a rejected mutation pass.
- Document responses use a random script nonce and strict-dynamic CSP. Next's
  framework scripts receive the nonce at request time. Scripts cannot use inline
  event handlers, arbitrary inline script or production eval. Styles retain
  unsafe-inline for React style attributes; this is not an exception for scripts.
- HTTPS production document responses emit HSTS (`max-age=31536000`, without
  preload/includeSubDomains) and upgrade-insecure-requests. Confirm actual TLS,
  redirect behavior and headers at the external edge before public acceptance.
  Apply equivalent HSTS to other edge responses where appropriate; the app's
  document proxy does not cover API/static routes.
- Preserve the existing nosniff, frame denial, referrer and permissions headers.
  A CSP nonce must match its own document. Never publicly cache/reuse HTML/RSC or
  authenticated responses. APIs use no-store/private and Vary: Cookie; static
  versioned assets may use Next's normal cache headers. No CDN configuration was
  verified by local tests.
- Set body, header, request, concurrent-connection and per-IP/global rate limits
  at the edge, including anonymous session discovery and guest quotes. BFF JSON
  reads have a five-second deadline and a 32 KB default (64 KB for admin product/
  category bodies). Choose edge limits that allow those bodies. Upstream JSON is
  limited to 8 MiB of decoded bytes and an eight-second request/body deadline.
  Do not bypass Laravel throttles; admin capability probes consume its limiter.
- Server-to-server Laravel calls need no browser CORS workaround. Keep its existing
  bearer-only Sanctum contract. Proxy/IP rate aggregation and backend trusted-proxy
  decisions require the backend owner's separately approved environment review.

## Operations and recovery

Monitor readiness, response status/latency, storage capacity, lock contention,
rate limiting and workflow uncertainty. Log only allowlisted method, route
template, status, duration and a random correlation ID. Do not log raw bodies,
query strings, headers, cookies, credentials, tokens, keys or purchase records.
Protect and limit log retention. There is no new telemetry service or dedicated
health endpoint in this phase; verify the actual application and secure session
discovery on an authorized environment rather than inventing a health URL.

Expired sessions are rejected and removed when accessed. There is no automatic
sweep of unvisited sessions/rate records or safe expiry for all workflow journals.
Monitor disk and impose quotas/abuse limits. Never age-delete checkout attempts,
merge journals, import owners or review markers: they prevent duplicate actions.
Hashed filenames cannot be classified safely by name/mtime alone.

An ordinary restart reuses the same directory/key. Crash-left `.lock` files fail
closed. Recovery requires stopping **all** frontend processes and confirming no
request remains in flight; inspect only that store and remove only locks verified
stale. Never unlock solely because of age. In-progress writes can leave encrypted
temporary files after a hard crash; they are not committed checkpoints. Do not
replace a committed record from one without controlled investigation.

Sync/rename protects normal record replacement, not a transaction with Laravel or
all hardware/power failures. Take protected, consistent backups of store plus key;
test restoration in a separate private directory. Restoring an older backup can
resurrect stale sessions/workflows and lose newer idempotency history. Freeze
mutations and reconcile with the backend owner before reopening checkout/imports.
Do not erase uncertainty to make the UI usable. If recovery is impossible, keep
purchases disabled operationally until reconciliation; no automatic recovery claim
is made.

Rollback uses a compatible frontend artifact plus its configuration and intact
current workflow store. Do not blindly roll back storage or rotate the key. One
host only; serverless, horizontal scaling and unverified network filesystems remain
unsupported. Validate restart, restore, stale-lock recovery, TLS/cookies, CSP,
external cache behavior and ACLs before approving a public demo.
