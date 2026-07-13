# Fix: `BigInt` serialization crash on `COUNT(*)` queries

**Bug:** `POST /api/conversations` (and `POST /api/conversations/[id]/turns`) returned an unhandled 500 with an empty response body for any question whose generated `QuerySpec` used a `COUNT(*)` aggregate.
**Reported as:** "I get a 500 when I ask 'tell me something'" — the wording of the question was a red herring; the real trigger was the aggregate type, not the text.
**Date:** 2026-07-13
**File changed:** `src/lib/query-engine.ts`

## What was built

Added `normalizeBigInts()`, a small helper in `query-engine.ts` that converts any `bigint`-typed value in a query's result rows to a plain `Number` before the rows are returned from `runQuery()`. It's applied once, immediately after `prisma.$queryRaw()` returns:

```ts
const rawRows = await prisma.$queryRaw<Record<string, unknown>[]>(builtSql);
const rows    = normalizeBigInts(rawRows);
```

## Why this happened

Postgres returns `COUNT(*)` — and `SUM()` over an `Int`-typed column — as SQL type `bigint`, not `integer`. Prisma's `$queryRaw` (unlike a typed model query, which maps results through the schema's declared field types) surfaces `bigint` columns as native JS `BigInt` values. `JSON.stringify` — which `NextResponse.json` uses internally — has no support for `BigInt` at all, with no flag to opt in. It throws `TypeError: Do not know how to serialize a BigInt` unconditionally, the moment it encounters one anywhere in the object being serialized.

This app's query engine (`src/lib/query-engine.ts`) builds its own `$queryRaw` calls from AI-generated `QuerySpec`s (see `docs/aiden-defense-guide.md` §7.2 for why the AI never writes SQL directly — it only ever chooses `entity`/`measures`/`groupBy`/etc., and this app assembles the SQL). Every domain-keyword question in `src/lib/ai-mock.ts` happens to use `sum` or `avg` over `Float` columns (`revenue`, `satisfaction_score`, etc.) — Postgres returns those as `double precision`, which Prisma maps to a plain JS `number`, no `BigInt` involved. The *only* spec in this app that uses `agg: "count"` is `ai-mock.ts`'s generic fallback — the spec returned when a question doesn't match any domain keyword. That's why this was invisible through every demo question tried during the certification remediation pass, and only surfaced once someone asked something with no keyword match.

## Why this fix, not a SQL-level cast

An alternative fix would be casting the aggregate expression itself, e.g. `COUNT(*)::int AS record_count`, inside `selectExpr()` (`query-engine.ts`). That would fix *this* occurrence, but the same failure mode also applies to `SUM()` over an `Int` column (Postgres: `sum(integer)` also returns `bigint`) — for example, a future or real-provider-generated spec doing `SUM(claims_count)` on `financial_records` would hit the identical crash, and casting would need to be remembered at every call site that builds an aggregate expression, forever.

Converting at the boundary — the one place every query's raw Postgres rows become the data this app hands back as JSON — fixes the whole class of bug once, for every aggregate this app can currently produce and any it adds later, without relying on remembering a cast per expression.

## Caveats

- **Safe specifically because this is a small seeded demo dataset** (see `prisma/seed.ts` — dozens to a couple thousand rows per analytics table). `Number` loses precision above `Number.MAX_SAFE_INTEGER` (2^53-1); nothing in this app's data volume is remotely close. A genuinely huge-scale count (billions of rows) would need a different representation (e.g. serialize as a string) — not a concern at this app's scale, but worth knowing if the underlying data source is ever swapped for something much larger (see the Snowflake-adapter note in `prisma/fragments/analytics.prisma`).
- **This fix lives in `query-engine.ts` only.** Any *new* raw SQL call site added elsewhere in the app that could return a `bigint`-typed column (a different `$queryRaw` call outside this file) would need the same treatment — either route through `normalizeBigInts()` or add an equivalent conversion. There's exactly one `$queryRaw` call site in this app today (`query-engine.ts`'s `runQuery()`), so this isn't yet a pattern needing a shared/exported utility, but it's worth revisiting if a second one is ever added.
- Also recorded in `.claude/fixes/prisma.md` per this project's "Lessons Learned" convention — though writing to that file was blocked in this session (protected-path restriction); the same writeup is included there in spirit via this document until it can be appended directly.
