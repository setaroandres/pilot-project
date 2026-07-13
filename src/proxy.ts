import { securityHeaders } from "@upstart13-com/aiden-security/middleware";

const isProd = process.env.NODE_ENV === "production";

/**
 * Applies opinionated security headers (HSTS, X-Frame-Options,
 * X-Content-Type-Options, Referrer-Policy, Permissions-Policy, a basic
 * CSP) to every response — the package primitive from
 * @upstart13-com/aiden-security, not a hand-rolled header list.
 *
 * Next.js 16 renamed the "Middleware" file convention to "Proxy": the file
 * must be named proxy.ts (not middleware.ts) and export a function named
 * `proxy` (not `middleware`). This is a framework rename, not a change in
 * behavior — the package's securityHeaders() helper still returns the same
 * kind of function; only the file name and the export name it's assigned
 * to changed. A leftover middleware.ts is ignored at build time with no
 * error, so this rename matters — silently missing headers, not a loud
 * failure.
 *
 * HSTS is disabled outside production: it tells browsers "only ever
 * connect to this host over HTTPS," which is correct advice for a
 * deployed app but wrong advice for http://localhost during local dev —
 * a browser that remembers that instruction can lock you out of your own
 * dev server. `undefined` here means "no override," so production keeps
 * the package's default (2-year max-age, includeSubDomains, preload).
 *
 * CSP is relaxed outside production for the same reason, but for a
 * different symptom: the package's default CSP is `script-src 'self'`
 * with no `'unsafe-inline'` and no nonce. Next.js's dev server (Turbopack)
 * injects an inline bootstrap `<script>` that sets `self.__next_r` before
 * the app's own JS runs — with the strict CSP in place, the browser blocks
 * that inline script outright, which then surfaces as a confusing
 * "Invariant: Expected a request ID to be defined for the document via
 * self.__next_r" error, not as an obvious CSP message (the CSP violation
 * itself is logged separately, right above it, and is the real cause).
 * The result is that no client JS runs at all in dev — including the
 * login form's — which is why login looked broken app-wide, not just on
 * one page. This never affects a production build: `next build` doesn't
 * emit that inline dev-bootstrap script, so production keeps the
 * package's strict default CSP unchanged.
 */
export const proxy = securityHeaders({
  hsts: isProd ? undefined : false,
  csp: isProd ? undefined : false,
});
