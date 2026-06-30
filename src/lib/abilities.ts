import "server-only";
import { defineAbilities } from "@upstart13-com/aiden-security";
import { ROLES } from "@/config/rbac";

/**
 * App-wide RBAC rules. Add new actions here; pair role-based rules
 * ({ roles: [...] }) with predicate rules ((session, resource) => boolean)
 * for resource-level checks.
 *
 * Role and permission strings come from @/config/rbac so renaming a
 * role touches one place and is checked at compile time.
 */
const ADMIN   = ROLES.find((r) => r.name === "admin")!.name;
const ANALYST = ROLES.find((r) => r.name === "analyst")!.name;

export const abilities = defineAbilities({
  rules: {
    // Existing admin-only rules
    "audit.read":     { roles: [ADMIN] },
    "audit.export":   { roles: [ADMIN] },
    "users.manage":   { roles: [ADMIN] },

    // AI Data Explorer: query.run gates the NL query engine.
    // viewer + member are excluded; hitting a guarded route returns 403.
    "query.run":      { roles: [ADMIN, ANALYST] },

    // catalog.manage gates PATCH /api/catalog/[id] (admin curations only).
    "catalog.manage": { roles: [ADMIN] },

    // cost.view gates GET /api/admin/cost (AIUsage telemetry).
    "cost.view":      { roles: [ADMIN] },
  },
});
