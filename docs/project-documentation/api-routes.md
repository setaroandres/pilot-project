# API Routes

**Feature:** AI Data Explorer  
**Date:** 2026-06-30  
**Files:** `src/app/api/conversations/`, `src/app/api/pins/`, `src/app/api/catalog/`, `src/app/api/admin/cost/`

---

## Overview

Nine routes across four resource groups. Every route follows the same perimeter:

```
withAuth  →  assertCan (if gated)  →  parseRequest (if body)  →  assertOwnership (if user-owned)  →  work  →  auditLog (on mutations)  →  response
```

---

## Conversations

### `POST /api/conversations`
**Permission:** `query.run`  
**Body:** `{ question: string }`

Creates a new `Conversation`, calls `runQuery()` with empty history (first question), persists a `ConversationTurn` with the QuerySpec and metadata (never the raw rows), and fires an audit log entry.

**Returns `201`:**
```json
{
  "conversationId": "...",
  "turn": {
    "id": "...",
    "userQuery": "...",
    "querySpec": { "sql": "...", "chartSpec": { ... }, "explanation": "..." },
    "rows": [ ... ],
    "rowCount": 42,
    "executionMs": 18
  }
}
```

`rows` are returned here but **never stored** — PHI discipline. On subsequent page loads the client uses the stored `querySpec.sql` to re-run if needed.

---

### `GET /api/conversations/[id]`
**Permission:** authenticated + ownership  

Fetches a conversation and all its turns. Each turn exposes `querySpec`, `chartSpec`, `resultMetadata` (`{ rowCount, executionMs }`), and `narrativeSummary` — but not the original result rows.

---

### `POST /api/conversations/[id]/turns`
**Permission:** `query.run` + ownership  
**Body:** `{ question: string }`

Adds a follow-up question to an existing conversation. Fetches the last 10 turns, builds an `AIMessage[]` history (alternating user question / assistant explanation), and calls `runQuery()` with that context so the AI can answer follow-ups correctly.

Returns same shape as `POST /api/conversations`, scoped to the new turn only.

---

## Pins

### `GET /api/pins`
**Permission:** authenticated (no role gate)  

Returns the requesting user's pins ordered newest first. Viewers get an empty array — they have no pins because they cannot create them. No 403 is thrown, which lets the UI show the "pins are analyst/admin only" informational box rather than an error.

---

### `POST /api/pins`
**Permission:** `query.run`  
**Body:** `{ conversationTurnId: string, title: string, resultSnapshot?: object[] }`

Creates a `PinnedVisualization` by copying `querySpec` and `chartSpec` from a `ConversationTurn`. The client optionally supplies `resultSnapshot` (the rows it received when the turn was created) for instant re-render without re-querying.

Ownership is checked directly against `ConversationTurn.userId` — no intermediate lookup required.

---

### `DELETE /api/pins/[id]`
**Permission:** authenticated + ownership  

Deletes the pin. Returns `204 No Content`. `assertOwnership` throws a 404 (not 403) if the pin doesn't exist or belongs to another user — this avoids leaking whether the ID exists.

---

## Catalog

### `GET /api/catalog`
**Permission:** authenticated (all roles)  

Browsable by everyone. Supports two optional query params:
- `?domain=patient_outcomes` — filter by domain
- `?q=readmission` — full-text search across `businessLabel`, `definition`, and `columnName`

Returns entries ordered by `tableName` then `columnName`.

---

### `PATCH /api/catalog/[id]`
**Permission:** `catalog.manage` (admin only)  
**Body:** One or more of `{ businessLabel, definition, caveats, lineage }`

Allows an admin to override any catalog entry's business definition. Sets `isOverride: true` automatically so human-curated edits are distinguishable from the base seed entries.

---

## Admin

### `GET /api/admin/cost`
**Permission:** `cost.view` (admin only)  

Returns AI usage telemetry. Supports:
- `?from=2024-01-01` / `?to=2024-12-31` — date range filter
- `?limit=100` — max rows (capped at 500)

**Returns:**
```json
{
  "rows": [ { "provider": "mock", "model": "mock-1.0", "totalTokens": 600, "costUSD": 0, ... } ],
  "totals": {
    "callCount": 47,
    "totalTokens": 28200,
    "totalCostUSD": 0,
    "avgLatencyMs": 12
  }
}
```

Under the mock provider `costUSD` is always `0`. When a real provider is wired in, the pricing table in `aiden-ai` populates it automatically.

---

## Security patterns used

| Pattern | Used in |
|---------|---------|
| `withAuth` | All 9 routes |
| `assertCan(abilities, session, action)` | conversations POST, turns POST, pins POST, catalog PATCH, admin/cost GET |
| `assertOwnership(row, userId)` | conversations GET, turns POST, pins DELETE |
| `parseRequest(req, ZodSchema)` | All mutation routes |
| `auditLog(...)` | All mutations (query.run, pin.create, pin.delete, catalog.edit) |

### Why GET /api/pins has no `assertCan`

Viewers are restricted from creating pins but there is no reason to 403 them on the list endpoint. The page UI checks the user's role server-side before rendering — the API simply returns an empty array. Separating "cannot act" from "cannot visit" makes the viewer experience smoother: they see the pins page with an explanation rather than a blank error screen.

### Why catalog PATCH has no `assertOwnership`

Catalog entries are shared reference data, not user-owned resources. Any admin can edit any entry. `assertCan("catalog.manage")` is the only gate needed.
