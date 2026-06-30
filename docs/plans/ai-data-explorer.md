# AI Data Explorer — Feature Plan

> **Status:** Draft — awaiting review and approval before any code is written.
> **Methodology:** Module 13 Plan-Then-Build ritual (seven dimensions).
> **Author:** Andrés Setaro · asetaro@upstart13.com
> **Date:** 2026-06-29

---

## 1. Outcome

A signed-in user at Meridian Health Systems can type a question in plain English about patient outcomes, operational efficiency, or financial performance — and receive an interactive chart or table in seconds, along with a streamed narrative explanation of what the data shows. They can save any result to a personal dashboard to revisit it later. Non-technical staff (Regional Directors, Finance Analysts) get answers without filing a BI ticket; executives (COO role) can read pinned dashboards prepared for them. An admin can browse the semantic data catalog, curate business definitions, and monitor AI query spend and audit history.

The entire pilot runs on a de-identified seed in local Postgres using a deterministic mock AI provider — no live warehouse, no LLM tokens, no PHI. Switching to a real provider and Snowflake in Phase 2 is a single `aiden.config.ts` change per provider and a one-line data-source adapter swap, requiring zero route edits.

---

## 2. Data

### New Prisma Fragments

All fragments live under `prisma/fragments/`. Run `npm run prisma:merge` after adding them.

#### `prisma/fragments/analytics.prisma` — Pilot seed data tables

Three analytics domains, shaped to mirror what a Snowflake adapter will satisfy in Phase 2.

```
model PatientOutcome {
  id                 String   @id @default(cuid())
  facility           String
  quarter            String   // e.g. "2024-Q1"
  region             String
  satisfactionScore  Float    @map("satisfaction_score")
  readmissionRate    Float    @map("readmission_rate")
  avgLengthOfStay    Float    @map("avg_length_of_stay")
  triageProtocol     String?  @map("triage_protocol") // "new" | "legacy" | null
  createdAt          DateTime @default(now()) @map("created_at")

  @@index([facility])
  @@index([quarter])
  @@index([region])
  @@map("patient_outcomes")
}

model OperationalMetric {
  id                String   @id @default(cuid())
  facility          String
  period            String   // "2024-Q1"
  region            String
  staffingEfficiency Float   @map("staffing_efficiency")
  bedOccupancyRate  Float    @map("bed_occupancy_rate")
  erWaitMinutes     Int      @map("er_wait_minutes")
  createdAt         DateTime @default(now()) @map("created_at")

  @@index([facility])
  @@index([period])
  @@map("operational_metrics")
}

model FinancialRecord {
  id                String   @id @default(cuid())
  facility          String
  period            String   // "2024-Q1"
  payer             String   // "Medicare" | "Medicaid" | "BlueCross" | ...
  procedureCode     String   @map("procedure_code")
  revenue           Float
  reimbursementRate Float    @map("reimbursement_rate")
  claimsCount       Int      @map("claims_count")
  createdAt         DateTime @default(now()) @map("created_at")

  @@index([facility])
  @@index([payer])
  @@index([period])
  @@map("financial_records")
}
```

#### `prisma/fragments/conversation.prisma` — Chat sessions & turns

```
model Conversation {
  id        String             @id @default(cuid())
  userId    String             @map("user_id")
  title     String             @default("New Conversation")
  domain    String?            // "patient_outcomes" | "operational" | "financial" | null (multi)
  createdAt DateTime           @default(now()) @map("created_at")
  updatedAt DateTime           @updatedAt @map("updated_at")

  user  User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  turns ConversationTurn[]

  @@index([userId])
  @@map("conversations")
}

model ConversationTurn {
  id               String       @id @default(cuid())
  conversationId   String       @map("conversation_id")
  userId           String       @map("user_id")
  userQuery        String       @map("user_query")      @db.Text
  querySpec        Json?        @map("query_spec")      // AI-generated, Zod-validated
  chartSpec        Json?        @map("chart_spec")      // { chartType, x, y, series }
  resultMetadata   Json?        @map("result_metadata") // { rowCount, executionMs }
  narrativeSummary String?      @map("narrative_summary") @db.Text
  error            String?
  createdAt        DateTime     @default(now()) @map("created_at")

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@index([userId])
  @@map("conversation_turns")
}
```

#### `prisma/fragments/pin.prisma` — Personal dashboard pins

```
model PinnedVisualization {
  id            String   @id @default(cuid())
  userId        String   @map("user_id")
  title         String
  querySpec     Json     @map("query_spec")
  chartSpec     Json     @map("chart_spec")
  resultSnapshot Json?   @map("result_snapshot") // cached rows at pin time
  createdAt     DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("pinned_visualizations")
}
```

#### `prisma/fragments/ai-usage.prisma` — AI call telemetry

`AIUsage` is **not** shipped by `aiden-db` — it must be added as a consumer fragment. The shape mirrors the `AIUsage` interface exported by `aiden-ai` plus a `userId` for the admin cost view.

```
model AIUsage {
  id               String   @id @default(cuid())
  provider         String
  model            String
  promptTokens     Int      @map("prompt_tokens")
  completionTokens Int      @map("completion_tokens")
  totalTokens      Int      @map("total_tokens")
  costUSD          Float    @map("cost_usd")
  latencyMs        Int      @map("latency_ms")
  userId           String?  @map("user_id")  // denormalized; survives User deletion
  createdAt        DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@index([createdAt])
  @@map("ai_usage")
}
```

Wire in `src/lib/ai.ts` via `setAIUsageSink` from `@upstart13-com/aiden-logging`:

```ts
setAIUsageSink(async (record) => {
  await prisma.aIUsage.create({ data: record });
});
```

Under the mock provider, `costUSD` will always be `0` and token counts will be synthetic fixture values — this is intentional and acceptable for the pilot.

#### `prisma/fragments/catalog.prisma` — Semantic data catalog

```
model CatalogEntry {
  id           String   @id @default(cuid())
  domain       String   // "patient_outcomes" | "operational" | "financial"
  tableName    String   @map("table_name")
  columnName   String?  @map("column_name") // null = table-level entry
  businessLabel String  @map("business_label")
  definition   String   @db.Text
  caveats      String?  @db.Text
  lineage      String?  @db.Text // where the metric comes from / how calculated
  isOverride   Boolean  @default(false) @map("is_override") // human-curated override
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@unique([domain, tableName, columnName])
  @@index([domain])
  @@map("catalog_entries")
}
```

### Modified Fragments

#### `prisma/fragments/user.prisma`

Add back-relations for new models:

```diff
  roles    Role[]    @relation("UserRoles")
+ conversations       Conversation[]
+ pinnedVisualizations PinnedVisualization[]
```

### Migrations

- **Migration name:** `add_ai_data_explorer`
- Covers: `patient_outcomes`, `operational_metrics`, `financial_records`, `conversations`, `conversation_turns`, `pinned_visualizations`, `catalog_entries`
- Command: `npm run db:migrate -- --name add_ai_data_explorer`

### Seed Additions (`prisma/seed.ts`)

Extend `main()` to:

1. Seed three new roles (`analyst`, `viewer`) + new permissions (`query.run`, `catalog.manage`, `cost.view`) into the existing RBAC tables.
2. Seed demo users:
   - `angela@meridian.example` → role `analyst` (Regional Director persona)
   - `david@meridian.example` → role `analyst` (Finance Analyst persona)
   - `sarah@meridian.example` → role `viewer` (COO persona)
   - `admin@meridian.example` → role `admin` (BI team)
3. Seed ~200–500 rows across the three analytics tables (de-identified, representative).
4. Seed `CatalogEntry` rows for every pilot table and column (descriptions, lineage, caveats).

---

## 3. Permissions

### RBAC Design

The feature uses **three roles**, mapped in `src/config/rbac.ts` and `src/lib/abilities.ts`.

| Role     | Who                        | What they can do                                                        |
|----------|----------------------------|-------------------------------------------------------------------------|
| `admin`  | Meridian BI team           | Everything: run queries, curate catalog, view audit log, view AI cost   |
| `analyst`| Regional Directors, Finance | Run queries, view results, pin dashboards, view catalog                 |
| `viewer` | COO, read-only executives  | View catalog; **cannot** invoke query engine (403 on `query.run` routes)|

**New permissions to add to `src/config/rbac.ts`:**

```ts
{ key: "query.run",      description: "Invoke the NL query engine" },
{ key: "catalog.manage", description: "Edit catalog entries (admin curations)" },
{ key: "cost.view",      description: "View AI usage and cost telemetry" },
```

**New roles to add:**

```ts
{
  name: "analyst",
  description: "Run NL queries, view results, pin personal dashboards",
  permissions: ["query.run"],
},
{
  name: "viewer",
  description: "Read-only access to shared dashboards and catalog",
  permissions: [],
},
```

**Updated `admin` role permissions:**

```ts
permissions: ["audit.read", "audit.export", "users.manage", "query.run", "catalog.manage", "cost.view"],
```

### Ability Rules (`src/lib/abilities.ts`)

```ts
"query.run":      { roles: ["admin", "analyst"] },
"catalog.manage": { roles: ["admin"] },
"cost.view":      { roles: ["admin"] },
```

### Ownership vs. Role Gate

- **Conversations and pins** are owner-scoped: `assertOwnership(resource, session.user.id)`. No new ability is needed — the owner is the only one who can see/delete their own conversations and pins.
- **Query execution** is role-gated: `assertCan("query.run")`. A `viewer` hitting the query route gets **403**. This also caps cost: viewers never trigger AI calls.
- **Catalog reads** are open to any authenticated user. Catalog writes (`PATCH`) require `assertCan("catalog.manage")`.
- **Cost view** requires `assertCan("cost.view")`.

---

## 4. Request Perimeter

Every route follows the standard AIDEN pattern:

```
withAuth → parseRequest (when body) → assertOwnership / assertCan → work → auditLog → response
```

Unhappy-path shapes:
- **401** — not authenticated (withAuth fires before handler)
- **400** — body fails Zod validation (parseRequest throws RequestValidationError)
- **403** — authed but insufficient role/ability (assertCan throws AbilityError)
- **404** — resource not found OR resource exists but belongs to another user (assertOwnership throws OwnershipError → same 404 shape to avoid ID enumeration)
- **429** — rate-limit exceeded (withRateLimit fires)

### Routes

#### `POST /api/query`
- **Auth:** `withAuth` + `withRateLimit` (20 req/min per userId)
- **Body (Zod `QueryBody`):** `{ conversationId?: z.string().cuid(), query: z.string().min(1).max(2_000), domain?: z.enum(["patient_outcomes", "operational", "financial"]) }`
- **Checks:** `assertCan("query.run")` — viewer → 403
- **Flow:** send query to mock AI with `QuerySpecSchema` as `responseSchema`, validate returned spec, map entity → allowlisted Prisma query, execute, return data + chartSpec, create/update ConversationTurn, auditLog
- **PHI deny-list:** before query execution, verify no deny-listed column names appear in the spec
- **Response:** `{ turnId, data: unknown[], chartSpec: ChartSpec, querySpec: QuerySpec, executionMs }`

#### `POST /api/query/stream`
- **Auth:** `withAuth` + `withRateLimit` (20 req/min per userId)
- **Body:** `{ turnId: z.string().cuid() }`
- **Checks:** `assertCan("query.run")`, `assertOwnership(turn, userId)` — ensures user only streams their own turns
- **Flow:** fetch the turn's `querySpec` + `resultMetadata`, send to mock AI for narrative, `createAIStreamResponse(stream)`, `setAIUsageSink` captures synthetic usage
- **Response:** SSE stream of text tokens ending with `[DONE]`

#### `GET /api/conversations`
- **Auth:** `withAuth`
- **Query:** scoped `where: { userId: session.user.id }`, ordered by `updatedAt desc`, paginated (`?page=&pageSize=`)
- **Response:** `{ conversations: [{ id, title, domain, createdAt, updatedAt, turnCount }] }`

#### `POST /api/conversations`
- **Auth:** `withAuth`
- **Body:** `{ title?: z.string().max(120), domain?: z.enum([...]) }`
- **Checks:** `assertCan("query.run")` — only roles that can query can create conversations
- **Response:** `{ id, title, domain, createdAt }`

#### `GET /api/conversations/[id]`
- **Auth:** `withAuth`
- **Checks:** `assertOwnership(conversation, userId)` → 404 if not found or not owner
- **Response:** `{ id, title, domain, turns: ConversationTurn[] }`

#### `DELETE /api/conversations/[id]`
- **Auth:** `withAuth`
- **Checks:** `assertOwnership(conversation, userId)` → 404
- **Response:** `{ ok: true }`

#### `GET /api/pins`
- **Auth:** `withAuth`
- **Query:** scoped `where: { userId: session.user.id }`
- **Response:** `{ pins: PinnedVisualization[] }`

#### `POST /api/pins`
- **Auth:** `withAuth`
- **Body:** `{ title: z.string().min(1).max(120), turnId: z.string().cuid() }`
- **Checks:** `assertCan("query.run")`, verify `turn.userId === session.user.id` (IDOR guard before pin creation)
- **Flow:** create PinnedVisualization, copy querySpec + chartSpec + snapshot from turn
- **Response:** `{ id, title, createdAt }`

#### `DELETE /api/pins/[id]`
- **Auth:** `withAuth`
- **Checks:** `assertOwnership(pin, userId)` → 404
- **Response:** `{ ok: true }`

#### `GET /api/catalog`
- **Auth:** `withAuth`
- **Query:** optional `?domain=&search=`, paginated
- **Response:** `{ entries: CatalogEntry[] }`

#### `GET /api/catalog/[id]`
- **Auth:** `withAuth`
- **Checks:** 404 if not found (no ownership — catalog is global)
- **Response:** `CatalogEntry`

#### `PATCH /api/catalog/[id]`
- **Auth:** `withAuth`
- **Body:** `{ definition?: z.string(), caveats?: z.string(), lineage?: z.string(), isOverride?: z.boolean() }`
- **Checks:** `assertCan("catalog.manage")` → 403
- **Response:** updated `CatalogEntry`

#### `GET /api/admin/cost`
- **Auth:** `withAuth`
- **Checks:** `assertCan("cost.view")` → 403
- **Query:** optional `?from=&to=&userId=`, paginated
- **Response:** `{ records: AIUsage[], totals: { tokens, estimatedCost } }`

---

## 5. Audit

All mutable and AI-invoking routes emit an audit event via `auditLog()` from `@/lib/security`. Read-only routes (GET) do not audit. The `AuditLog` model (already in schema) captures `event`, `actorId` (userId), `resourceId`, `metadata`, `requestId` (auto-attached by `withAuth`).

| Route                         | Event                    | `resourceId`         | `metadata`                                            |
|-------------------------------|--------------------------|----------------------|-------------------------------------------------------|
| `POST /api/query`             | `query.executed`         | `turn.id`            | `{ domain, entityQueried, rowCount, executionMs }`    |
| `POST /api/query/stream`      | `query.narrated`         | `turn.id`            | `{ tokenCount }` (synthetic under mock)               |
| `POST /api/conversations`     | `conversation.created`   | `conversation.id`    | `{ title, domain }`                                   |
| `DELETE /api/conversations/[id]` | `conversation.deleted` | `conversation.id`  | `{ title }`                                           |
| `POST /api/pins`              | `pin.created`            | `pin.id`             | `{ title, turnId }`                                   |
| `DELETE /api/pins/[id]`       | `pin.deleted`            | `pin.id`             | `{ title }`                                           |
| `PATCH /api/catalog/[id]`     | `catalog.entry.updated`  | `catalogEntry.id`    | `{ field, previousValue }` (per changed field)        |

**Important:** Bodies, user queries, and result data are **never logged** to `AuditLog`. Only structural metadata (IDs, counts, domain) goes in `metadata`. This holds even though the pilot has no real PHI — discipline applies now.

**AI usage telemetry:** `setAIUsageSink` is wired in `src/lib/ai.ts` to write synthetic `AIUsage` rows (tokens in/out, estimated cost = 0 under mock) for every `query.executed` and `query.narrated` call. These rows survive a feature rollback — accepted.

---

## 6. Files Touched

### New Prisma Fragments

| File | Change |
|------|--------|
| `prisma/fragments/analytics.prisma` | New: PatientOutcome, OperationalMetric, FinancialRecord models |
| `prisma/fragments/ai-usage.prisma` | New: AIUsage model (not shipped by aiden-db — must be consumer-owned) |
| `prisma/fragments/conversation.prisma` | New: Conversation, ConversationTurn models |
| `prisma/fragments/pin.prisma` | New: PinnedVisualization model |
| `prisma/fragments/catalog.prisma` | New: CatalogEntry model |

### Modified Fragments

| File | Change |
|------|--------|
| `prisma/fragments/user.prisma` | Add `conversations Conversation[]` and `pinnedVisualizations PinnedVisualization[]` back-relations |

### Config

| File | Change |
|------|--------|
| `src/config/rbac.ts` | Add `query.run`, `catalog.manage`, `cost.view` permissions; add `analyst` and `viewer` roles; extend `admin` permissions |
| `src/lib/abilities.ts` | Add ability rules for `query.run`, `catalog.manage`, `cost.view` |
| `src/lib/ai.ts` | Wire `setAIUsageSink` to the new `AIUsage` Prisma model; add `mock()` export that returns the `MockAIClient` |
| `src/lib/ai-mock.ts` | New: hand-written `MockAIClient` implementing the `AIClient` interface — fixture-backed `complete()` + chunked `stream()`, synthetic usage (`costUSD: 0`) |
| `aiden.config.ts` | Update `app.name` / `app.shortName` / `app.tagline` for Meridian; add `mock` to `ai.providers` |
| `src/config/nav.ts` | Add Explore, My Dashboard, Catalog nav items; add Admin→Cost nav item |

### Seed

| File | Change |
|------|--------|
| `prisma/seed.ts` | Extend `main()` to seed new roles/permissions, demo users, analytics data (~200–500 rows), catalog entries (~60 entries across 3 domains) |

### New API Routes

| File | What it does |
|------|-------------|
| `src/app/api/query/route.ts` | POST — NL query → AI spec → parameterized Prisma query → data + chartSpec |
| `src/app/api/query/stream/route.ts` | POST — fetch turn, stream narrated explanation via SSE |
| `src/app/api/conversations/route.ts` | GET list / POST create conversation |
| `src/app/api/conversations/[id]/route.ts` | GET single / DELETE conversation |
| `src/app/api/pins/route.ts` | GET list / POST create pin |
| `src/app/api/pins/[id]/route.ts` | DELETE pin |
| `src/app/api/catalog/route.ts` | GET list catalog entries |
| `src/app/api/catalog/[id]/route.ts` | GET single / PATCH update (admin) |
| `src/app/api/admin/cost/route.ts` | GET AIUsage records (admin only) |

### New Shared Types / Schemas

| File | What it does |
|------|-------------|
| `src/lib/query-engine.ts` | `QuerySpecSchema` (Zod), `ChartSpecSchema`, `PHI_DENY_LIST`, `ENTITY_ALLOWLIST`, `executeQuerySpec()` |

### New Pages

| File | What it does |
|------|-------------|
| `src/app/dashboard/explore/page.tsx` | Main NL query UI — conversation sidebar + query input + result area |
| `src/app/dashboard/explore/[conversationId]/page.tsx` | Individual conversation view with full turn history |
| `src/app/dashboard/pins/page.tsx` | Personal pinned dashboard grid |
| `src/app/dashboard/catalog/page.tsx` | Catalog browser — searchable, filterable by domain |
| `src/app/admin/cost/page.tsx` | AIUsage cost view (admin) |

### New Components

| File | What it does |
|------|-------------|
| `src/components/explore/query-input.tsx` | Controlled textarea + domain selector + submit button |
| `src/components/explore/result-table.tsx` | Tabular data display (sortable columns) |
| `src/components/explore/chart-renderer.tsx` | Auto-chart from ChartSpec using Recharts (bar/line/area/scatter/KPI card) |
| `src/components/explore/narrative-stream.tsx` | SSE consumer using `useAIStream`; renders streaming narrative text |
| `src/components/explore/conversation-sidebar.tsx` | Left panel — conversation list, new conversation button |
| `src/components/explore/turn-card.tsx` | Single Q&A turn: query → chart/table + narrative + pin button |
| `src/components/pins/pin-card.tsx` | Pinned visualization card (title, chart preview, delete button) |
| `src/components/catalog/catalog-table.tsx` | Browsable data dictionary table with edit modal for admins |
| `src/components/admin/cost-table.tsx` | AIUsage records table with totals |

### Dependencies to Install

| Package | Reason |
|---------|--------|
| `recharts` | Chart rendering (bar, line, area, scatter). Already in `devDependencies` of some AIDEN packages but must be in app `dependencies`. |

---

## 7. Rollback

### Migration Rollback

Run a follow-up migration named `drop_ai_data_explorer` that drops all new tables:

```sql
DROP TABLE IF EXISTS conversation_turns CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS pinned_visualizations CASCADE;
DROP TABLE IF EXISTS catalog_entries CASCADE;
DROP TABLE IF EXISTS patient_outcomes CASCADE;
DROP TABLE IF EXISTS operational_metrics CASCADE;
DROP TABLE IF EXISTS financial_records CASCADE;
```

This is preferable to a Prisma down-step because we're dropping multiple unrelated tables — a named cleanup migration is clearer and auditable.

### RBAC Rollback

Remove `analyst` and `viewer` roles and the `query.run`, `catalog.manage`, `cost.view` permissions from `src/config/rbac.ts` and re-seed. Users currently assigned these roles will lose access to the query engine, which is the desired behavior.

### Non-Reversible Side Effects (accepted)

- **`AuditLog` rows** for `query.*`, `conversation.*`, `pin.*`, `catalog.*` events will remain after the feature is removed. We accept this — audit history is intentionally append-only and never purged.
- **`AIUsage` rows** (synthetic under mock) will remain. We accept this — cost telemetry is also append-only.
- **User back-relations in `user.prisma`** — if the migration is reverted, the back-relation fields (`conversations`, `pinnedVisualizations`) must also be removed from `user.prisma` and re-merged. Failing to do so will cause a Prisma schema validation error on next `prisma:merge`.

### Feature Flag

There is no feature flag wired in `aiden.config.ts` for this feature. The RBAC roles serve as the access gate. To disable the feature without a migration rollback: remove the `analyst` role from any users in the database — they will get 403/404 on all query/pin routes and an empty conversations list.

---

## Pre-Implementation Checklist

Before writing code, verify the following:

- [ ] `aiden-ai` package README confirms `provider: "mock"` is a valid option in `createAIClient` — check `node_modules/@upstart13-com/aiden-ai/README.md`
- [ ] `aiden-ai` package README confirms `ai.complete({ responseSchema })` signature for structured output
- [ ] `aiden-realtime` package README confirms `setAIUsageSink` is the correct hook and its sink interface
- [ ] `aiden-security` README confirms `assertCan` signature (it may differ from `assertOwnership`)
- [ ] Confirm `recharts` is not already re-exported by `@upstart13-com/aiden-ui` (if it is, import from there)
- [ ] Confirm `AIUsage` model is provided by `aiden-db` (check `node_modules/@upstart13-com/aiden-db/schema/`) or must be added as a fragment
- [ ] Read `docs/design-system/00-overview.md` + `05-data-display.md` + `08-page-layouts.md` before touching any UI file
- [ ] Invoke `frontend-design` skill before writing any UI code

---

## Open Questions (to resolve before build)

1. **Context window for follow-up turns:** `aiden-ai`'s `AICompleteOptions` accepts a `messages: AIMessage[]` array — confirmed from type definitions. Multi-turn context is supported natively. The route will pass the last N turns (capped at 10) as prior messages.
2. **Export (PNG, CSV):** the spec lists this under Dynamic Visualization. Which routes expose raw data for CSV download? Does this need a dedicated `/api/query/[turnId]/export` route, or does the client render from cached `data` in the turn?
3. **Prompt injection probe:** the spec says "a seeded adversarial record must not override or echo the system prompt — probed and graded even under the mock provider." We need one adversarial row in the seed (e.g., a facility name that contains an injection attempt) and a test to confirm it's fenced in the user message.
4. ~~**`AIUsage` model source**~~ — **Resolved:** not in `aiden-db`. Must be added as `prisma/fragments/ai-usage.prisma`. See Data section above.
5. ~~**Viewer shared dashboards**~~ — **Resolved:** The pins page is visible to viewers in the nav, but renders an informational box instead of the pins grid: *"Pinned visualizations are available to Analyst and Admin accounts. Contact your administrator to upgrade your access."* Role is checked server-side in the page component before rendering. No sharing mechanism is built — "dashboards her team pinned for her" in the persona is Phase 2 vision language, not pilot scope. The out-of-scope section ("shared/team dashboards — personal only") takes precedence.

## Resolved Pre-Build Blockers

| Question | Finding | Impact on Plan |
|----------|---------|----------------|
| `AIUsage` in `aiden-db`? | **No** — only `auth`, `audit`, `rbac` fragments ship | Added `prisma/fragments/ai-usage.prisma` to Data section |
| `provider: "mock"` in `aiden-ai`? | **No** — supported providers: openai, anthropic, google, mistral, groq, cohere | Replace with `src/lib/ai-mock.ts`: hand-written `AIClient` interface implementation with fixture responses. Phase 2 swap is still one line in `src/lib/ai.ts`. Graded criterion ("zero route edits, one config line") is still satisfied. |
| Prompt injection probe | Implementation clear: system prompt is a fixed string with zero user content; adversarial facility row in seed; unit test inspects `messages[]` to verify fencing | Added adversarial seed row + probe test to seed/testing plan |
| Viewer pins page | Viewer sees the page but gets an informational box ("Analyst/Admin only") instead of the pins grid. Role checked server-side. No sharing mechanism built — Phase 2. | `src/app/dashboard/pins/page.tsx` conditionally renders based on server-side role check |

---

*This plan covers all seven Module 13 dimensions. No code will be written until this document is approved.*
