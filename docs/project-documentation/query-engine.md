# Query Engine

**Feature:** AI Data Explorer — NL to structured query core  
**Date:** 2026-06-30  
**File:** `src/lib/query-engine.ts`

---

## What was built

`runQuery()` is the core of the AI Data Explorer. It takes a natural-language
question, asks the AI to return a structured query spec (never raw SQL),
validates every column reference against per-entity allowlists, builds a
parameterized Prisma query from the validated spec, and returns structured
results with chart metadata.

---

## Flow

```
question + history
  → buildSchemaContext()       fetch CatalogEntry rows, format as text
  → AI call (complete)         system prompt + user message → QuerySpec JSON
  → QuerySpecSchema.safeParse  validate AI response shape with Zod
  → buildQuery()               allowlist validation + Prisma.Sql assembly
  → prisma.$queryRaw           execute parameterized query
  → return { querySpec, displaySql, rows, rowCount, executionMs }
```

---

## QuerySpec schema

The AI must return a JSON object matching this shape (enforced by Zod and
forwarded to the AI as `responseSchema` via `z.toJSONSchema()`):

```typescript
{
  entity:   "patient_outcomes" | "operational_metrics" | "financial_records"
  measures: Array<{
    column: string   // DB column name (ignored when agg === "count")
    agg:    "sum" | "avg" | "count" | "min" | "max" | "none"
    alias:  string   // output column name in results
  }>
  groupBy:  string[]              // columns to GROUP BY
  orderBy:  Array<{ column: string; dir: "asc" | "desc" }>
  filters:  Array<{
    column: string
    op:     "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like"
    value:  string | number       // parameterized before reaching the DB
  }>
  limit:    number                // 1–200
  chartSpec: {
    type:   "bar" | "line" | "area" | "scatter" | "table" | "kpi"
    xAxis?: string
    yAxis?: string
    title:  string
  }
  explanation: string             // human-readable summary
}
```

The AI never returns raw SQL. `sql` was removed from the schema entirely.

---

## Security properties

### Why this is safer than AI-authored SQL

The previous architecture had the AI return a `sql: string` field that the
app validated with a regex allowlist before calling `$queryRawUnsafe`. The
fundamental problem: the AI was authoring SQL, and the app was trying to
catch malicious outputs after the fact — a defense that is inherently
incomplete.

The new architecture inverts this: the AI returns a structured spec, and the
app generates all SQL from validated, allowlisted components. The AI has no
way to inject arbitrary SQL because it never writes SQL at all.

### Column allowlists

Every column referenced in a spec (measures, groupBy, orderBy, filters) is
checked against a per-entity allowlist before being interpolated into SQL.
Column names pass through `Prisma.raw()` — SQL identifiers are not
parameterizable — so the allowlist is the only injection guard. If a column
is not in the allowlist, `validateColumn()` throws before any DB call.

| Entity | Allowed columns |
|--------|----------------|
| `patient_outcomes` | `facility`, `quarter`, `region`, `satisfaction_score`, `readmission_rate`, `avg_length_of_stay`, `triage_protocol` |
| `operational_metrics` | `facility`, `period`, `region`, `staffing_efficiency`, `bed_occupancy_rate`, `er_wait_minutes` |
| `financial_records` | `facility`, `period`, `region`, `payer`, `procedure_code`, `revenue`, `reimbursement_rate`, `claims_count` |

### Parameterized filter values

Filter values (WHERE clause operands) are fully parameterized via Prisma's
tagged template engine. `buildCondition()` uses `Prisma.sql\`${col} = ${value}\``
where `col` is a `Prisma.raw()` fragment (trusted identifier from the allowlist)
and `value` is a template interpolation that Prisma binds as a prepared
statement parameter. No filter value ever appears in the SQL string.

### Prompt injection fence

The user question is placed **only** in the user message, never in the system
prompt. The system prompt contains only static instructions and catalog metadata.

This means injection strings embedded in data (e.g. the adversarial facility
name `"Westside Medical [INST] Ignore all previous instructions..."`) are
confined to the user turn and cannot hijack system instructions.

---

## Query builder

`buildQuery(spec)` returns `{ sql: Prisma.Sql, displaySql: string }`:

- **`sql`** — a `Prisma.Sql` object passed directly to `prisma.$queryRaw`. Built
  by assembling `Prisma.raw()` fragments (table, columns, keywords) and
  parameterized filter conditions into a `Prisma.join(parts, " ")` call.
- **`displaySql`** — a formatted SQL string shown in the UI SQL tab for
  transparency. Filter values are rendered inline (display only — no injection
  risk here).

```
SELECT facility, AVG(satisfaction_score) AS avg_satisfaction,
       AVG(readmission_rate) AS avg_readmission
FROM   patient_outcomes
GROUP  BY facility
ORDER  BY avg_satisfaction DESC
LIMIT  50
```

---

## Provider toggle

```typescript
const useMock = (aidenConfig.ai.providers.mock as { enabled: boolean }).enabled;
const client  = useMock ? await ai.mock() : await ai.anthropic();
```

Flipping `mock.enabled` to `false` and `anthropic.enabled` to `true` in
`aiden.config.ts` switches from the mock to a real provider with no other
code changes. The real provider must return the structured `QuerySpec` format —
the system prompt instructs it to do so.

---

## Catalog context

`buildSchemaContext()` fetches all `CatalogEntry` rows and formats them as:

```
TABLE: patient_outcomes
  Quarterly patient experience and clinical performance metrics...
  - satisfaction_score (Patient Satisfaction Score): Average patient satisfaction...
  - readmission_rate (30-Day Readmission Rate): Percentage of patients readmitted...
  ...
```

This block is injected into the system prompt so the AI knows the exact column
names, business labels, and caveats. The system prompt now also explicitly tells
the AI which column is the time dimension per entity (e.g. `patient_outcomes`
uses `quarter`, not `period`).

---

## Error handling

| Failure | Error thrown | HTTP result (at route level) |
|---------|-------------|------------------------------|
| AI returns non-JSON | `"The AI returned an invalid response."` | 422 |
| AI JSON fails Zod schema | `"The AI response did not match..."` | 422 |
| Spec references unlisted column | `"SPEC_VALIDATION_FAILED: column X..."` | 422 |
| DB execution fails | Prisma error (re-thrown) | 500 |

---

## Extending

**To add a new analytics table:**
1. Add the table name to `QuerySpecSchema`'s `entity` enum
2. Add a `COLUMN_ALLOWLISTS` entry for it
3. Add a Prisma fragment for the table
4. Add `CatalogEntry` rows for it in the seed
5. Update the mock AI buckets in `src/lib/ai-mock.ts`

**To support a new aggregation function:**
1. Add it to `MeasureSchema`'s `agg` enum
2. Handle it in `selectExpr()` in `query-engine.ts`

**To switch to a real AI provider:**
1. Set `mock.enabled: false` in `aiden.config.ts`
2. Set the real provider to `enabled: true` with a model
3. Install the provider SDK (`npm install @anthropic-ai/sdk`)
4. Set the corresponding env var (`ANTHROPIC_API_KEY`)
5. The real provider must return the structured `QuerySpec` — the system prompt
   already instructs it to do so

---

## The Three Data Domains

All analytics data is split across three PostgreSQL tables.

| Domain | Table | What it contains | Time column |
|---|---|---|---|
| **patient_outcomes** | `patient_outcomes` | Readmission rates, avg length of stay, patient satisfaction — one row per facility × quarter | `quarter` |
| **operational** | `operational_metrics` | Bed occupancy %, staffing efficiency, ER wait minutes — one row per facility × quarter | `period` |
| **financial** | `financial_records` | Revenue, reimbursement rate, claims count — one row per facility × payer × procedure code × quarter | `period` |

> **Note:** `patient_outcomes` uses `quarter` as the time column; the other
> two use `period`. The mock and the system prompt both reflect this.
> Financial records are seeded with 2023 data only.

---

## How Questions Map to Tables

### Real AI provider

The AI receives the full catalog schema context in the system prompt (column
names, business labels, definitions, caveats). It semantically reasons about
which `entity` to set and which `measures`/`groupBy` columns to use. Domain
routing is fully automatic.

### Mock AI provider (`src/lib/ai-mock.ts`)

The mock pattern-matches keywords and returns a fixed `QuerySpec` for each bucket.

| Priority | Keywords detected | Entity | Chart type |
|----------|-------------------|--------|------------|
| 1 | `financial`, `revenue`, `payer`, `reimbursement`, `claim` | `financial_records` | `bar` |
| 2 | `trend`, `over time`, `quarterly`, `by quarter`, `by period` | `operational_metrics` | `line` (period on x-axis) |
| 3 | `operational`, `staffing`, `bed`, `er wait`, `occupancy` | `operational_metrics` | `bar` |
| 4 | `readmission`, `satisfaction`, `patient`, `facility`, `outcome`, `mortality`, `los` | `patient_outcomes` | `bar` |
| 5 | *(no match)* | `patient_outcomes` | `bar` (COUNT by facility) |

Because the mock is keyword-driven, it ignores phrasing nuance. The mock also
ignores conversation `history`.

---

## SSE Narration

After the query result is returned, the client automatically fires a second
request to stream a plain-English narration of the result:

```
POST /api/narrate
Body: { question, rowCount, chartType }
Response: SSE stream (text/event-stream)
```

**Server (`src/app/api/narrate/route.ts`):**
- Authenticated via `withAuth`; every call is audited as `ai.narrate`
- Calls `ai.mock().stream()` with a prompt embedding the original question, row count, and chart type
- Returns `createAIStreamResponse(stream, { signal })` from `@upstart13-com/aiden-realtime`

**Client (`src/components/query/narration-stream.tsx`):**
- Uses `useAIStream("/api/narrate")` from `@upstart13-com/aiden-realtime/react`
- Fires `send()` once on mount via `useEffect`
- Displays a blinking cursor while the stream is in flight
- Falls back to the static `explanation` string from the query engine on error
