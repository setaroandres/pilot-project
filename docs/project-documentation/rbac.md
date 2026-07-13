# RBAC: Roles and Abilities

**Feature:** AI Data Explorer - RBAC expansion  
**Date:** 2026-06-30  
**Files changed:** `src/config/rbac.ts`, `src/lib/abilities.ts`

---

## What was built

Expanded the starter's two-role RBAC system (`admin`, `member`) to support the four roles and six permissions required by the AI Data Explorer pilot.

---

## Roles

| Role | Description | Who holds it |
|------|-------------|-------------|
| `admin` | Full access to everything | Meridian BI team |
| `analyst` | Can run queries and pin dashboards | Regional Directors, Finance Analysts |
| `viewer` | Read-only: catalog and overview only | COO, executive stakeholders |
| `member` | Default registration role, no special permissions | Any self-registered user |

`member` was kept from the starter template. The `aiden-auth` registration handler does not auto-assign any role, so new users have no permissions until an admin assigns one. This is safe and intentional.

---

## Permissions

| Permission | Granted to | Guards |
|-----------|-----------|--------|
| `audit.read` | admin | `GET /api/admin/audit` |
| `audit.export` | admin | `GET /api/admin/audit` (CSV export) |
| `users.manage` | admin | `GET/PATCH /api/admin/users` |
| `query.run` | admin, analyst | `POST /api/query`, `POST /api/query/stream`, `POST /api/conversations`, `POST /api/pins` |
| `catalog.manage` | admin | `PATCH /api/catalog/[id]` |
| `cost.view` | admin | `GET /api/admin/cost` |

---

## Two-layer access model

Every request goes through two independent checks before any data is touched:

**Layer 1 — Authentication** (`withAuth`): Are you signed in? If not → 401. Every API route uses `withAuth`, no exceptions. All four roles pass this check after signing in.

**Layer 2 — Authorization** (`assertCan`): Are you allowed to perform *this specific action*? If not → 403. Only routes that carry real risk have a named permission gate. Routes that are simply "any logged-in user may see this" (e.g. `GET /api/catalog`) have no `assertCan` call — authentication is sufficient.

This means `viewer` and `member` users are not locked out of the app — they can browse the catalog, see the overview page, and read their own profile. They just can't invoke the query engine, manage users, or export audit logs.

---

## Roles

| Role | Description | Who holds it |
|------|-------------|-------------|
| `admin` | Full access to everything | Meridian BI team |
| `analyst` | Can run queries and pin dashboards | Regional Directors, Finance Analysts |
| `viewer` | Read-only: catalog and overview only; no permission gates | COO, executive stakeholders |
| `member` | Default registration role, no special permissions | Any self-registered user |

`member` was kept from the starter template. The `aiden-auth` registration handler does not auto-assign any role, so new users have no permissions until 
---

## Runtime enforcement: `assertCan`

`assertCan(permission, session)` is the runtime gate that enforces RBAC rules on every protected API route. It throws an `AbilityError` (converted to HTTP 403) if the user's session does not hold the named permission.

### Request perimeter

Every API route follows this four-layer pattern, in order:

```
Request
  → withAuth       not signed in?        → 401
  → assertCan      wrong role/no perm?   → 403
  → parseRequest   malformed body?       → 422
  → your logic     business errors       → 4xx / 5xx
```

### Example

```typescript
export const POST = withAuth(async (req, { session }) => {
  assertCan("query.run", session); // viewer or member → 403 here

  const body = await parseRequest(req, BodySchema);
  // ... safe to proceed
});
```

When Sarah (viewer) hits `POST /api/query`:
1. `withAuth` passes — she is signed in
2. `assertCan("query.run", session)` checks `abilities.ts` → `query.run` requires `admin` or `analyst` → Sarah has neither → throws `AbilityError` → 403
3. She never reaches the query engine

### `assertCan` vs `assertOwnership`

These two guards solve different problems and are often used together:

| Guard | Question it answers | Failure |
|-------|--------------------|---------| 
| `assertCan("query.run", session)` | Does this role have permission to perform this action? | 403 |
| `assertOwnership(row, session.user.id)` | Does this user own this specific resource? | 403 |

`assertCan` is role-based (action gate). `assertOwnership` is resource-based (IDOR guard). A route that returns a user's own conversations needs both: `assertCan` to confirm the role can query at all, and `assertOwnership` to confirm the returned row belongs to that user.
e new permissions (`query.run`, `catalog.manage`, `cost.view`) from `PERMISSIONS` and remove `analyst` and `viewer` from `ROLES`. Re-seed. Users assigned those roles will lose access immediately on next request.
