# Database Schema

**Feature:** AI Data Explorer — Prisma fragments  
**Date:** 2026-06-30  
**Migration name (pending):** `add_ai_data_explorer`

---

## What was built

Five new Prisma fragments were added under `prisma/fragments/`, and `user.prisma` was extended with two new back-relations. Running `npm run prisma:merge` composes all fragments (consumer + aiden-db packages) into the single `prisma/schema.prisma` that Prisma's CLI consumes.

The schema now has 15 models total: 6 from `@upstart13-com/aiden-db` (auth, audit, RBAC) and 9 new consumer-owned models for the pilot feature.

---

## Fragments added

### `analytics.prisma` — Read-only seed data

Three tables standing in for Meridian's Snowflake warehouse during the pilot:

| Model | Table | Purpose |
|-------|-------|---------|
| `PatientOutcome` | `patient_outcomes` | Satisfaction scores, readmission rates, triage protocol by facility/quarter |
| `OperationalMetric` | `operational_metrics` | Staffing efficiency, bed occupancy, ER wait times by facility/period |
| `FinancialRecord` | `financial_records` | Revenue, reimbursement rates, claims count by facility/payer/procedure |

**Key design decisions:**
- No `userId` FK — these are shared reference data, not user-owned resources. No cascade needed.
- `region` added to all three for regional director queries (Angela Torres persona).
- `procedureCode` indexed on `FinancialRecord` because payer + procedure is the primary query pattern for the Finance Analyst persona.
- `triageProtocol` is nullable on `PatientOutcome` — some facilities hadn't adopted either protocol yet.
- All multi-word fields use `@map()` to keep database columns in snake_case while TypeScript uses camelCase.

### `ai-usage.prisma` — AI call telemetry

One row per AI provider call. **Not shipped by `@upstart13-com/aiden-db`** — must be consumer-owned.

Wired via `setAIUsageSink()` in `src/lib/ai.ts`. Under the mock provider, `costUSD` is always `0` and token counts are synthetic fixture values.

**Key design decision:** `userId` is a plain `String?` (no FK, no cascade) — same pattern as `AuditLog.actorId`. Cost history must survive user deletion for billing and audit purposes.

### `conversation.prisma` — Chat sessions and turns

`Conversation` groups multiple `ConversationTurn` records (one per Q&A exchange). The route passes the last N turns as prior messages to the AI client for follow-up question context (capped at 10 turns).

**Cascade chain:**
```
User deleted → Conversation deleted (onDelete: Cascade)
                 → ConversationTurn deleted (onDelete: Cascade)
```

**Key design decision:** `resultMetadata` on `ConversationTurn` stores only structural metadata (`{ rowCount, executionMs }`) — never the actual result rows. Raw data is never persisted, only returned in the API response. This is the PHI discipline boundary even though the pilot seed has no real PHI.

### `pin.prisma` — Personal dashboard pins

A `PinnedVisualization` is created from a `ConversationTurn` — the `querySpec`, `chartSpec`, and a snapshot of the result rows are copied over at pin time.

**Key design decision:** No FK to `ConversationTurn`. The pin is self-contained so it survives conversation deletion. `resultSnapshot` stores the cached rows at pin time for instant re-render without re-querying.

Only `analyst` and `admin` roles can create pins. Viewers see an informational message on the pins page.

### `catalog.prisma` — Semantic data catalog

One row per table or column, seeded with business labels, definitions, caveats, and lineage notes for every pilot table and column (~60 entries).

**Key design decisions:**
- `columnName` is nullable — a null value means the entry is a table-level description rather than a column-level one.
- `@@unique([domain, tableName, columnName])` prevents duplicate entries for the same table/column combination.
- `isOverride` flags human-curated admin edits so they can be distinguished from the base seed entries.
- In Phase 2, this table is replaced by an embeddings-backed semantic search store.

---

## `user.prisma` changes

Two back-relations added:

```prisma
conversations        Conversation[]
pinnedVisualizations PinnedVisualization[]
```

These are required because Prisma validates that both sides of a relation are declared. The foreign key and `@relation` directive live on the child models (`Conversation.userId`, `PinnedVisualization.userId`) — the back-refs on `User` are virtual convenience accessors with no database column.

---

## Why `@map()` is used

Prisma fields use camelCase (TypeScript convention). Database columns use snake_case (PostgreSQL convention). `@map("column_name")` bridges the two. Fields that are a single word (e.g. `id`, `facility`, `model`) don't need it — the name is identical in both conventions.

---

## What is NOT in `@upstart13-com/aiden-db`

| Model | Where it lives | Why |
|-------|---------------|-----|
| `AIUsage` | Consumer fragment (`ai-usage.prisma`) | aiden-db only ships auth, audit, rbac |
| `User` | Consumer fragment (`user.prisma`) | Must declare all back-relations — can't be fixed by the package |
| All domain models | Consumer fragments | Business data is always consumer-owned |

---

## Rollback

To remove this feature from the schema:

1. Delete `prisma/fragments/analytics.prisma`, `ai-usage.prisma`, `conversation.prisma`, `pin.prisma`, `catalog.prisma`
2. Remove `conversations` and `pinnedVisualizations` back-relations from `prisma/fragments/user.prisma`
3. Run `npm run prisma:merge`
4. Create and run a migration named `drop_ai_data_explorer` that drops all affected tables

`AuditLog` and `AIUsage` rows written during the feature's lifetime persist after rollback — this is intentional and accepted.

---

## Next steps

- `npm run db:migrate -- --name add_ai_data_explorer` — run the migration
- Extend `prisma/seed.ts` with analytics data, catalog entries, and demo users
- Update `src/config/rbac.ts` with `analyst`, `viewer` roles and new permissions
