/**
 * Single source of truth for RBAC role and permission strings.
 *
 * Imported by `src/lib/abilities.ts` (ability rules) and `prisma/seed.ts`
 * (role/permission seeding) so renaming a role or permission touches one
 * place and is checked at compile time.
 */

/** Permission keys, paired with the descriptions seeded into the DB. */
export const PERMISSIONS = [
  { key: "audit.read",     description: "Read the audit log" },
  { key: "audit.export",   description: "Export audit log entries to CSV" },
  { key: "users.manage",   description: "Assign and revoke user roles" },
  { key: "query.run",      description: "Invoke the NL query engine" },
  { key: "catalog.manage", description: "Edit catalog entries (admin curations)" },
  { key: "cost.view",      description: "View AI usage and cost telemetry" },
] as const;

/** Role names, descriptions, and the permission keys granted to each. */
export const ROLES = [
  {
    name: "admin",
    description: "Full access: audit log, user management, query engine, catalog, cost view",
    permissions: ["audit.read", "audit.export", "users.manage", "query.run", "catalog.manage", "cost.view"],
  },
  {
    name: "analyst",
    description: "Run NL queries, view results, pin personal dashboards",
    permissions: ["query.run"],
  },
  {
    name: "viewer",
    description: "Read-only: catalog and overview only; cannot invoke the query engine",
    permissions: [] as string[],
  },
  {
    name: "member",
    description: "Default registration role with no special permissions",
    permissions: [] as string[],
  },
] as const;

/** A permission key, e.g. `"audit.read"`. */
export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

/** A role name, e.g. `"admin"`. */
export type RoleName = (typeof ROLES)[number]["name"];
