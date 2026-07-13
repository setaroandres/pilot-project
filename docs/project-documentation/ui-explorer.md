# UI — AI Data Explorer

This document covers all five pages and their supporting components that make up the AI Data Explorer feature. All UI code follows the Smithers DS design system (`@upstart13-com/aiden-ui`) and the CLAUDE.md non-negotiable rules.

---

## Architecture overview

The UI is split into three layers:

1. **Server pages** (`src/app/dashboard/**/page.tsx`, `src/app/admin/cost/page.tsx`) — fetch data directly from Prisma, check auth/RBAC, and pass serialized props to client components. No API round-trip needed for initial load.
2. **Client components** (`"use client"`) — handle interactivity: form submission, optimistic state, toast feedback, pin/delete mutations.
3. **Shared UI components** (`src/components/*`) — purely presentational, accepting typed props from pages or client wrappers.

The query page is the exception: the _entire result flow_ (submit → fetch → display) is client-side, because each query runs as an API call and the result is held in React state for the session.

---

## Pages

### 1. Query page — `src/app/dashboard/query/`

Two files:
- **`page.tsx`** (server): checks auth and the `query.run` ability, then renders `<QueryPageClient canQuery={boolean} />`.
- **`query-page-client.tsx`** (client): manages all query state.

**State managed in `QueryPageClient`:**

| State | Type | Purpose |
|---|---|---|
| `conversationId` | `string \| undefined` | Tracks the active conversation so follow-up questions hit `POST /api/conversations/[id]/turns` instead of creating a new one |
| `turns` | `TurnState[]` | Ordered list of completed turn results for display |
| `loading` | `boolean` | Skeleton is shown while the current request is in flight |
| `activeTab` | `Record<string, "table" \| "chart" \| "sql">` | Per-turn tab selection |
| `chartTypeOverride` | `Record<string, string>` | Per-turn user-selected chart type; overrides the AI's suggested `chartSpec.type` |

**Query flow:**
1. User submits via `<QueryInput>`.
2. `QueryInput` detects whether a `conversationId` prop exists:
   - First question → `POST /api/conversations` (creates conversation + runs query).
   - Follow-up → `POST /api/conversations/[id]/turns` (adds a turn with history).
3. On success, `onResult` callback fires, turn is appended to state, chart tab is auto-selected if `chartSpec` has both axes.
4. `<NarrationStream>` mounts inside each result card and immediately fires `POST /api/narrate`, streaming a 2–3 sentence narration token-by-token.
5. Each turn card shows three tabs: **Table** (always), **Chart** (only if `chartSpec.xAxis` + `chartSpec.yAxis` present), **SQL** (always).
6. On the Chart tab, a **chart type switcher** toolbar shows 6 icon buttons (Bar, Line, Area, Scatter, Table, KPI). The AI's suggested type is pre-selected; clicking another type updates `chartTypeOverride` for that turn immediately.
7. A **CSV** ghost button appears on any result card with rows. Clicking it generates a valid RFC 4180 CSV in-browser and triggers a download — no server round-trip.
8. The **Pin** button prompts for a title, then calls `POST /api/pins` with the turn ID and a result snapshot (capped at 100 rows).

**Viewer access:** When `canQuery === false`, an info Alert is shown and the input + Pin button are disabled. The CSV download button and chart type switcher remain available (they are read-only actions).

---

### 2. Conversations page — `src/app/dashboard/conversations/page.tsx`

Server component. Fetches `Conversation` rows for the current user directly from Prisma (ordered by `updatedAt desc`, capped at 50). The `_count.turns` relation aggregate is included to show turn counts on each card without a N+1 query.

Renders a list of `<ConversationCard>` components. Each card links to `/dashboard/conversations/[id]` — the detail page is not built in this iteration but the route is reserved.

**Empty state:** Icon + prompt + CTA button linking to `/dashboard/query`.

---

### 3. Pins page — `src/app/dashboard/pins/`

Two files:
- **`page.tsx`** (server): checks auth and `query.run` ability. If viewer, skips the Prisma query entirely (returns `pins = []`) and renders an informational Alert explaining the access restriction. Fetches `PinnedVisualization` rows for analysts/admins and serializes dates to ISO strings before passing as props.
- **`pins-list-client.tsx`** (client): manages local pin list state for optimistic deletes. Renders a 2-column grid of `<PinCard>` components.

**Why not show a 403?** A viewer seeing an empty list with an explanation is far better UX than a hard error. The viewer can still understand what the page is for and what role they need.

---

### 4. Catalog page — `src/app/dashboard/catalog/page.tsx`

Server component. Fetches all `CatalogEntry` rows from Prisma and derives a unique sorted list of domain names. Passes both to `<CatalogTable>` (client).

The catalog is accessible to all authenticated users — no `assertCan` gate. This matches the API route design (GET /api/catalog has no role gate).

---

### 5. Admin cost page — `src/app/admin/cost/page.tsx`

Server component. Lives under `/admin/cost`, which is behind the admin layout segment guard. The page also re-checks `cost.view` as defense-in-depth (layout alone is not a security boundary).

Fetches the last 200 AI usage rows and an aggregate (count, sum tokens, sum cost, avg latency) in a single `Promise.all`. Passes both to `<CostTable>` (client). The client side is purely display — no mutations.

---

## Components

### `src/components/query/query-input.tsx`

`"use client"` form. Uses `react-hook-form` + Zod for validation. The `⌘ Enter` keyboard shortcut submits without clicking.

**Key type:** `QueryTurnResult` — the normalized shape returned via `onResult` callback, extracted from either the `POST /api/conversations` or `POST /api/conversations/[id]/turns` response shape.

**Gotcha:** The `ref` callback wires both `react-hook-form`'s `field.ref` and a local `textareaRef` so the textarea can be refocused after submit.

---

### `src/components/query/results-table.tsx`

Stateless. Derives column names from `Object.keys(rows[0])`. The `formatCell` helper renders `null`/`undefined` as `—`, truncates floats to 2 decimal places, and handles booleans.

---

### `src/components/query/chart-view.tsx`

`"use client"`. Renders one of six chart types using **Recharts** (`recharts` npm package). All colors reference CSS variable tokens (`var(--chart-1)`, `var(--border)`, `var(--muted-foreground)`) — no hardcoded hex values.

| Type | Recharts component | Notes |
|------|--------------------|-------|
| `bar` | `BarChart` + `Bar` | Default. Rounded bar tops (`radius={[3,3,0,0]}`). |
| `line` | `LineChart` + `Line` | Monotone curve with dots. Used for time-series (e.g. quarterly trends). |
| `area` | `AreaChart` + `Area` | Same as line with 12 % opacity fill under the curve. |
| `scatter` | `ScatterChart` + `Scatter` | String x-axis values fall back to row index; original string is shown in tooltip. |
| `table` | — | Delegates to `<ResultsTable>` (reuses existing component). |
| `kpi` | — | Responsive card grid. Single-row results show each column as a card; multi-row shows xAxis/yAxis pairs. |

All axis labels angle at –35° to avoid overlap on long facility names. `ResponsiveContainer` is always `width="100%" height={300}`.

Falls back to a `<ChartUnavailable>` empty state (icon + message) when required axes are missing.

---

### `src/components/query/narration-stream.tsx`

`"use client"`. Fires `POST /api/narrate` once on mount via `useEffect` and streams the response using `useAIStream` from `@upstart13-com/aiden-realtime/react`. Displays a blinking cursor while streaming. Falls back silently to the static `explanation` prop on error.

---

### `src/components/conversations/conversation-card.tsx`

Server-safe (no `"use client"` — no hooks needed). Links to the conversation detail route. Shows domain as a `Badge` if set.

---

### `src/components/pins/pin-card.tsx`

`"use client"`. Manages two local booleans: `expanded` (chart visibility toggle) and `deleting` (disables button during `DELETE /api/pins/[id]` in flight). Calls `onDeleted(id)` on success so the parent list can remove the card optimistically.

---

### `src/components/catalog/catalog-table.tsx`

`"use client"`. Client-side filter using `useMemo` — no debounce or server roundtrip needed given the catalog is small (< 1000 entries). The domain Select dropdown uses `src/components/ui/select.tsx` (a Radix UI primitive, written manually since the shadcn installer requires network access).

---

### `src/components/admin/cost-table.tsx`

`"use client"` (stateless display). Renders four metric `Card` components (calls, tokens, cost, latency) in a responsive grid above the usage table.

---

## Shared UI primitives (`src/components/ui/`)

Two files written manually because the shadcn installer (`npx shadcn@latest add`) requires outbound network access which was unavailable in this environment:

| File | Based on | Used by |
|---|---|---|
| `alert.tsx` | `cva` + semantic tokens | Pins page (viewer info), Query page (viewer warning) |
| `select.tsx` | `@radix-ui/react-select` | Catalog table domain filter |

Both follow the Smithers DS token rules (no hardcoded colors, `rounded-xl` for alert container, `rounded-md` for select trigger).

---

## Navigation updates

`src/config/nav.ts` additions:

| Entry | Path | Icon | Visibility |
|---|---|---|---|
| Query | `/dashboard/query` | `Sparkles` | All authenticated users |
| Conversations | `/dashboard/conversations` | `MessageSquare` | All authenticated users |
| Pins | `/dashboard/pins` | `Pin` | All authenticated users |
| Catalog | `/dashboard/catalog` | `BookOpen` | All authenticated users |
| AI Cost | `/admin/cost` | `DollarSign` | Admin only (gated by `cost.view` in layout) |

The dashboard layout (`src/app/dashboard/layout.tsx`) was updated to conditionally include `adminCostNavItem` in `secondaryNavItems` when the user has the `cost.view` ability.

---

## How to extend

**Add a chart type:** Add the new type string to the `supported` array in `chart-view.tsx`. Implement a dedicated renderer component, then branch on `chartSpec.type` to select it.

**Add the conversation detail page:** Create `src/app/dashboard/conversations/[id]/page.tsx`. It can call `GET /api/conversations/[id]` (already implemented) to fetch the full turn history.

**Real-time query updates:** Replace the `fetch()` call in `QueryInput.onSubmit` with a streaming `EventSource` or `ReadableStream` consuming `client.stream()` from the query engine. The `QueryPageClient` state shape is already turn-oriented for this.

**Catalog edit UI (admin):** Add an edit dialog to `CatalogTable`. It should call `PATCH /api/catalog/[id]` with the updated `businessLabel`, `definition`, `caveats`, or `lineage`. Gate the edit button on `canManage` (a prop passed from a server page that checks `catalog.manage`).
