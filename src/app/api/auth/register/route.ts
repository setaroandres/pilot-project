import { NextResponse } from "next/server";
import { z } from "zod";
import { createRegisterHandler } from "@upstart13-com/aiden-auth";
import { withRateLimit } from "@upstart13-com/aiden-security";
import { parseRequest, RequestValidationError } from "@/lib/security";
import { prisma } from "@/lib/prisma";

/**
 * Derive a per-request client IP for rate limiting. Falls back to a
 * shared bucket when no IP can be determined (fail closed, not open) so
 * a missing header can't bypass the limit.
 */
function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Fields this wrapper cares about — everything else in the body passes
 * through untouched via `.passthrough()` (email, fullName, etc.), since
 * `createRegisterHandler` does the real, full validation downstream via
 * its own `registerSchema`. This schema only needs to be permissive
 * enough to read `password`/`confirmPassword` without rejecting a
 * legitimately-shaped request before it reaches that real validator.
 */
const NormalizeBody = z
  .object({
    password:        z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .passthrough();

/**
 * Normalise the register payload so callers don't need to send
 * `confirmPassword` — if it's absent we mirror `password` automatically.
 * The underlying handler still validates both fields match.
 *
 * Reads the body via `parseRequest` (not a raw `req.json()`) so this
 * route follows the same request-perimeter convention as every other
 * route in the app, even though it sits outside `withAuth` (registration
 * is necessarily unauthenticated, so there's no session to catch the
 * thrown error for us — caught explicitly below instead).
 */
function withConfirmPassword(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    let body: Record<string, unknown>;
    try {
      body = await parseRequest(req, NormalizeBody);
    } catch (err) {
      if (err instanceof RequestValidationError) {
        return NextResponse.json(
          { error: "Invalid request body", details: err.zodFlatten },
          { status: 400 }
        );
      }
      throw err;
    }
    if (!body.confirmPassword && body.password) {
      body = { ...body, confirmPassword: body.password };
    }
    const normalised = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(body),
    });
    return handler(normalised);
  };
}

/**
 * Self-service registration, rate-limited per IP to blunt account
 * enumeration and signup spam (each register runs bcrypt, a CPU-DoS
 * amplifier). The in-memory store suits single-instance deploys; swap in
 * a shared `RateLimitStore` (Redis/Upstash) for multi-instance setups.
 */
export const POST = withRateLimit(
  withConfirmPassword(createRegisterHandler({ prisma })),
  {
    limit: 5,
    windowMs: 60_000,
    keyFor: (req) => `register:${clientIp(req)}`,
  }
);