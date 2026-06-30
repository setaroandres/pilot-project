import "server-only";
import { configureSecurity } from "@upstart13-com/aiden-security";
import { auth } from "@/lib/auth";
// Side-effect: registers the Prisma audit sink so every auditLog() call from
// any API route persists to audit_logs. Imported here (rather than relying
// solely on instrumentation.ts) because Next.js Turbopack can run
// instrumentation and route handlers in separate module instances.
import "@/lib/audit";

configureSecurity({ getSession: () => auth() });

export {
  withAuth,
  parseRequest,
  assertOwnership,
  assertCan,
  auditLog,
  RequestValidationError,
  OwnershipError,
  AbilityError,
} from "@upstart13-com/aiden-security";
