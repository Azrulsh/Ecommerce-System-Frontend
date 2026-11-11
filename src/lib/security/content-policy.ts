// Authentication and authorization stay in the BFF, independently of this policy.
export function contentPolicy(
  nonce: string,
  development: boolean,
  https: boolean,
) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // React style attributes, including report bars, require this exception.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${development ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(!development && https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
