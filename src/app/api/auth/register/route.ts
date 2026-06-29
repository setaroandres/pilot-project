import { createRegisterHandler } from "@upstart13-com/aiden-auth";
import { withRateLimit } from "@upstart13-com/aiden-security";
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
 * Self-service registration, rate-limited per IP to blunt account
 * enumeration and signup spam (each register runs bcrypt, a CPU-DoS
 * amplifier). The in-memory store suits single-instance deploys; swap in
 * a shared `RateLimitStore` (Redis/Upstash) for multi-instance setups.
 */
/**
 * Normalise the register payload so callers don't need to send
 * `confirmPassword` — if it's absent we mirror `password` automatically.
 * The underlying handler still validates both fields match.
 */
function withConfirmPassword(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
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

export const POST = withRateLimit(
  withConfirmPassword(createRegisterHandler({ prisma })),
  {
    limit: 5,
    windowMs: 60_000,
    keyFor: (req) => `register:${clientIp(req)}`,
  }
);