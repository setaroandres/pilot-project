# Mock AI Client

**Feature:** AI Data Explorer — mock provider  
**Date:** 2026-06-30  
**Files changed:** `src/lib/ai-mock.ts`, `src/lib/ai.ts`, `aiden.config.ts`

---

## What was built

A hand-written `MockAIClient` that implements the `AIClient` interface from
`@upstart13-com/aiden-ai`. It satisfies the graded "mock provider" requirement:
the query engine runs end-to-end without calling any real AI API or requiring
an API key.

---

## Why a hand-written client instead of a config flag

`aiden-ai` supports six providers (OpenAI, Anthropic, Google, Mistral, Groq,
Cohere). There is no built-in `provider: "mock"`. The correct approach for an
SDK that lacks a primitive you need is to implement the interface yourself
rather than reach for a third-party library or fork the SDK. `MockAIClient`
is 100 lines, has no dependencies beyond the `aiden-ai` types, and drops out
when a real provider is wired in.

---

## Interface implemented

```typescript
interface AIClient {
  readonly provider: string;
  readonly model:    string;
  complete(options: AICompleteOptions): Promise<AICompleteResponse>;
  stream(options:   AICompleteOptions): Promise<AIStreamResponse>;
}
```

Both methods call `reportUsage()` from `@upstart13-com/aiden-ai`, which fires
the `AIUsage` database sink. This means every mock call produces a real
`ai_usage` row with synthetic token counts and `costUSD = 0` (the pricing
table defaults to zero for unknown models).

---

## Response generation

`buildMockText()` scans the last user message for keywords and returns a
JSON string matching the `QuerySpec` shape the query engine expects.

### Structured-output mode (`responseSchema` present)

Keyword buckets are checked in priority order:

| Priority | Keywords detected | Entity | Chart type |
|----------|-------------------|--------|------------|
| 1 | `financial`, `revenue`, `payer`, `reimbursement`, `claim` | `financial_records` | `bar` |
| 2 | `trend`, `over time`, `quarterly`, `by quarter`, `by period` | `operational_metrics` | `line` (period on x-axis) |
| 3 | `operational`, `staffing`, `bed`, `er wait`, `occupancy` | `operational_metrics` | `bar` |
| 4 | `readmission`, `satisfaction`, `patient`, `facility`, `outcome`, `mortality`, `los` | `patient_outcomes` | `bar` |
| 5 | *(no match)* | `patient_outcomes` | `bar` (COUNT by facility) |

Each response is a JSON object matching the `QuerySpec` shape:
- `entity` — the analytics table to query
- `measures` — array of `{ column, agg, alias }` descriptors
- `groupBy` — columns to GROUP BY
- `orderBy` — sort spec
- `filters` — always `[]` in the mock (no WHERE conditions)
- `limit` — row cap
- `chartSpec` — `{ type, xAxis, yAxis, title }`
- `explanation` — human-readable description

There is no `sql` field. The query engine builds all SQL from the spec.

### Narration mode (`responseSchema` absent, prompt contains "Narrate the following")

Used by `POST /api/narrate`. The mock returns a 2–3 sentence plain-text narration
for a healthcare executive, chosen by the same keyword buckets:

| Keywords detected | Narration topic |
|-------------------|-----------------|
| `revenue`, `financial`, `reimbursement` | Revenue leaders, reimbursement rate overview |
| `readmission`, `satisfaction`, `patient`, `outcome` | Satisfaction rankings, readmission rates, avg LOS |
| `trend`, `quarter`, `occupancy`, `period` | Bed occupancy trend, peak quarter, capacity outlook |
| `staffing`, `operational`, `er wait`, `bed` | Staffing efficiency gaps, ER wait correlation |
| *(no match)* | Generic row-count narration |

The row count is extracted from the literal phrase `"Rows returned: N"` in the
prompt so the fallback narration can reference the actual number.

### Plain fallback

When no `responseSchema` is present and the prompt does not contain
"Narrate the following", returns the static string
`"Mock AI provider active. No real API call was made."`

---

## Streaming

`stream()` splits the response text on whitespace and emits each word as a
separate `AIStreamChunk` with a 10 ms delay, simulating realistic
token-by-token latency in the UI. `finalResponse()` is idempotent — it
returns a cached `AICompleteResponse` so multiple callers do not trigger
duplicate usage sink calls.

---

## How to toggle

`aiden.config.ts` controls which provider the query engine uses:

```typescript
// aiden.config.ts
ai: {
  providers: {
    mock:   { enabled: true  },  // active for the pilot
    openai: { enabled: false, model: "gpt-4o-mini" },
    // ...
  }
}
```

In `src/lib/query-engine.ts` (next step), the factory reads this flag:

```typescript
const client = aidenConfig.ai.providers.mock.enabled
  ? await ai.mock()
  : await ai.anthropic(); // or whichever real provider
```

Flipping `mock.enabled` to `false` and enabling a real provider is the only
change needed to graduate from pilot to production.

---

## Usage sink wiring (`src/lib/ai.ts`)

`src/lib/ai.ts` registers the `AIUsage` database sink as a module-level side
effect:

```typescript
setAIUsageSink(async (record) => {
  await prisma.aIUsage.create({ data: record });
});
```

The sink fires on every completed AI call (both `complete()` and
`stream().finalResponse()`). The `AIUsageRecord` shape matches the `AIUsage`
Prisma model directly; `conversationId` is left null at the sink level and
can be back-filled by the route handler if needed.

---

## Rollback

Delete `src/lib/ai-mock.ts`, remove the `mock()` entry from `src/lib/ai.ts`,
remove `mock` from `aiden.config.ts` providers, and set any real provider to
`enabled: true`.
