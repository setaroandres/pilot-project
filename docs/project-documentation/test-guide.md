# Meridian Health AI Data Explorer — Test Guide

This document is a hands-on walkthrough of every feature in the app. Use it to:
- Verify each feature works end-to-end after a fresh install
- Understand what each page does and why
- Test role-based access with the different demo accounts

---

## 1. Setup checklist

Before testing, confirm:

```bash
npm run dev            # dev server running on http://localhost:3000
npm run db:push        # schema applied to local Postgres
npx prisma db seed     # demo data loaded (or npm run db:migrate)
```

You should see the server start without errors. Open http://localhost:3000 — it should immediately redirect to `/login`.

---

## 2. Accounts

The seed creates **50 pilot users** total across three departments, plus 4 named demo accounts for hands-on testing. All passwords follow the same pattern by role.

### Demo accounts (use these for manual testing)

| Email | Password | Role | Department | What they can do |
|---|---|---|---|---|
| `admin@meridian.example` | `Admin1234!` | **admin** | BI Team | Everything — queries, pins, catalog edits, user management, cost dashboard |
| `angela@meridian.example` | `Analyst1234!` | **analyst** | Clinical Ops | Queries, pins, catalog browse |
| `david@meridian.example` | `Analyst1234!` | **analyst** | Finance | Queries, pins, catalog browse |
| `sarah@meridian.example` | `Viewer1234!` | **viewer** | Executive | Read-only — sees the app but cannot run queries |

### Pilot user cohort (46 additional users)

| Department | Analysts | Viewers | Total |
|---|---|---|---|
| Clinical Ops | 14 | 6 | 20 |
| Finance | 10 | 4 | 14 |
| Executive | 0 | 12 | 12 |
| **Total (pilot cohort)** | **24** | **22** | **46** |

Email pattern: `<initials>.<lastname>@meridian.example` (e.g. `m.chen@meridian.example`).
All analyst accounts use `Analyst1234!`; all viewer accounts use `Viewer1234!`.

> Credentials are seeded once. Re-running the seed does not overwrite passwords or roles.

---

## 3. Page-by-page test plan

### 3.1 Login / Register

**URL:** `/login` and `/register`

| Test | Expected result | Result |
|---|---|---|
| Visit `/` | Redirects to `/login` | ✅ PASS |
| Submit empty form | Validation errors appear inline | ✅ PASS |
| Login with wrong password | "Invalid credentials" error toast | ✅ PASS |
| Login as `angela@meridian.example` | Redirects to `/dashboard` | ✅ PASS |
| Click "Create account" | Goes to `/register` | ✅ PASS |
| Register a new account | Creates account, redirects to `/dashboard` | ✅ PASS |

---

### 3.2 Overview (`/dashboard`)

**What it is:** The home screen. Explains what the app does and links to each feature.

| Test | Expected result | Result |
|---|---|---|
| Log in as any user and land on `/dashboard` | Page shows title, 4 feature cards (Query, Conversations, Pins, Catalog), 3 highlight cards | ✅ PASS |
| Click any feature card | Navigates to that feature | ✅ PASS |
| "Start Querying" button | Navigates to `/dashboard/query` | ✅ PASS |
| Sidebar shows correct nav items | Query, Conversations, Pins, Catalog in primary nav; Settings (and Admin items for admin) in secondary | ✅ PASS |

---

### 3.3 Query (`/dashboard/query`)

**What it is:** The core feature — type a question in natural language, get SQL-backed results.

**Log in as `angela@meridian.example`**

#### Happy path
| Test | What to type | Expected result | Result |
|---|---|---|---|
| Basic financial query | `Show me total revenue by facility` | Table with facility names + revenue figures; Chart tab shows bar chart | ✅ PASS |
| Patient outcomes | `What is the average readmission rate by facility?` | Table with facility + readmission rate; SQL tab shows the generated SELECT | ✅ PASS |
| Operational metric | `Show bed occupancy rates for all regions` | Table with region + occupancy %; chart if axes are returned | ✅ PASS |
| Follow-up question | After the first query, ask `Which facility has the highest?` | Results narrow to top facility; conversation ID stays the same (follow-up uses prior context) | ✅ PASS |

#### Pin a result | ✅ PASS 
1. Run any query
2. Click **Pin** on the result card
3. A prompt asks for a title — enter one and confirm
4. Navigate to `/dashboard/pins` — pin appears

#### SSE narration
- After each query result appears, the explanation text below the question streams in word-by-word
- A blinking cursor is visible while streaming; it disappears when complete
- The narration is contextual — revenue queries produce a different narration than patient outcome queries
- Try: `Show me bed occupancy trends by quarter` — the narration describes the trend direction

#### Chart types and switcher
- On the **Chart** tab, a toolbar of 6 icon buttons appears: Bar, Line, Area, Scatter, Table, KPI
- The AI's suggested type is pre-selected (violet highlight)
- Click any other type to switch the chart immediately — no re-query needed
- Try `Show me bed occupancy trends by quarter` — the AI suggests a **Line** chart; switch to **Area** to see the fill variant
- Switch to **KPI** on a multi-row result to see each facility rendered as a metric card
- Switch to **Table** to see the same data as the results table

#### CSV export
1. Run any query that returns rows
2. Click **CSV** (ghost button, top-right of result card)
3. Browser downloads `meridian-<id>.csv`
4. Open the file — verify headers match column names and values are correct
5. Run a query that returns 0 rows — the CSV button should be absent

#### SQL tab | ✅ PASS 
- Click **SQL** tab on any result card
- Verify the query is a SELECT statement
- Verify it does not contain any forbidden keywords (INSERT, UPDATE, DELETE, DROP)

#### Viewer access | ✅ PASS 
- Log out and log in as `sarah@meridian.example`
- Navigate to `/dashboard/query`
- The input form is disabled with an info Alert: "Read-only access"
- The Pin button is absent
- The CSV button is still visible (download is read-only — viewers can export)

---

### 3.4 Conversations (`/dashboard/conversations`)

**What it is:** Your query history — every conversation (session) you've started.

| Test | Expected result | Result
|---|---|---|
| After running queries as analyst1, visit this page | List of conversations with title (first question), date, turn count | ✅ PASS |
| Click a conversation card | Navigates to `/dashboard/conversations/[id]` (detail page — currently a placeholder) | ✅ PASS |
| Log in as a different user | No cross-contamination — each user sees only their own conversations | ✅ PASS |
| No conversations yet | Empty state: icon + "No conversations yet" + CTA button | ✅ PASS |

---

### 3.5 Pins (`/dashboard/pins`)

**What it is:** Saved visualizations pinned from query results.

**Log in as `angela@meridian.example`** (after pinning something from the Query page)

| Test | Expected result | Result
|---|---|---|
| Visit `/dashboard/pins` | Grid of PinCard components, one per saved pin | ✅ PASS |
| Click "Show chart" on a pin | Chart expands inline using the saved result snapshot | ✅ PASS |
| Click the delete (trash) icon | Confirmation via toast; card disappears from the list | ✅ PASS |
| Log in as `sarah@meridian.example` | Info Alert shown: "Viewer access — cannot run queries or save pins" | ✅ PASS |
| Viewer with no pins | Empty state below the alert | ✅ PASS |

---

### 3.6 Catalog (`/dashboard/catalog`)

**What it is:** The data dictionary — every table and column the AI can query, with business definitions.

| Test | Expected result | Result
|---|---|---|
| Visit `/dashboard/catalog` | Table of ~25 entries across 3 domains | ✅ PASS |
| Search "readmission" | Filters to rows containing "readmission" in label or definition | ✅ PASS |
| Select domain "patient_outcomes" | Filters to that domain only | ✅ PASS |
| Combine search + domain filter | AND-filters correctly | ✅ PASS |
| Clear search | All entries for the selected domain show | ✅ PASS |
| Check "curated" badge | Entries edited by admin via PATCH /api/catalog/[id] show a "curated" badge |

**Catalog entry fields:**

| Column | Meaning | Result
|---|---|---|
| Domain | `patient_outcomes`, `operational`, or `financial` | ✅ PASS |
| Table | The SQL table name the column lives in | ✅ PASS |
| Column | The SQL column name (blank = table-level entry) | ✅ PASS |
| Label | Human-readable business name | ✅ PASS |
| Definition | Plain-English explanation passed to the AI as schema context | ✅ PASS |
| Caveats | Known data quality issues or interpretation warnings | ✅ PASS |

---

### 3.7 Admin — AI Cost (`/admin/cost`)

**Only accessible to `admin@meridian.example`**

| Test | Expected result |
|---|---|
| Log in as analyst and visit `/admin/cost` | Redirected to `/dashboard` |
| Log in as admin and visit `/admin/cost` | Page loads with metric cards + usage table |
| Metric cards | Total Calls, Total Tokens, Total Cost, Avg Latency |
| Run some queries as analyst, then refresh | Row count in the table increases |
| Usage table | Shows provider (`mock`), model (`mock-1.0`), token counts per call |

---

### 3.8 Admin — Users (`/admin/users`)

**Only accessible to `admin@meridian.example`**

| Test | Expected result |
|---|---|
| Visit `/admin/users` | Table of all registered users with their roles |
| Change a user's role | PATCH /api/admin/users/[id]/roles — role updated immediately |
| Try to remove admin from the last admin | Returns 409 "Cannot remove admin role from the last admin" |

---

## 4. Role-based access matrix

| Feature | admin | analyst | viewer |
|---|---|---|---|
| Run queries | ✅ | ✅ | ❌ (disabled input) |
| Pin results | ✅ | ✅ | ❌ |
| View pins | ✅ | ✅ | ✅ (info alert shown) |
| Browse catalog | ✅ | ✅ | ✅ |
| Edit catalog entries | ✅ | ❌ (403) | ❌ (403) |
| View AI cost | ✅ | ❌ (redirect) | ❌ (redirect) |
| Manage users | ✅ | ❌ (redirect) | ❌ (redirect) |

---

## 5. API smoke tests

With the dev server running, you can curl the endpoints directly. The `Cookie` header must contain a valid session (easiest: copy from browser DevTools after logging in).

```bash
# Test authenticated catalog endpoint
curl http://localhost:3000/api/catalog \
  -H "Cookie: authjs.session-token=<your-token>"

# Run a query (as analyst or admin)
curl -X POST http://localhost:3000/api/conversations \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=<your-token>" \
  -d '{"question": "Show total revenue by facility"}'

# List your pins
curl http://localhost:3000/api/pins \
  -H "Cookie: authjs.session-token=<your-token>"

# Admin cost endpoint
curl http://localhost:3000/api/admin/cost \
  -H "Cookie: authjs.session-token=<admin-token>"
```

---

## 6. Known limitations (pilot scope)

| Limitation | Notes |
|---|---|
| Charts are CSS bar charts | No real charting library — horizontal bars proportional to max value. Sufficient for the pilot. |
| Conversation detail page not built | `/dashboard/conversations/[id]` is a stub route — the API (`GET /api/conversations/[id]`) is implemented. |
| pino-pretty disabled under Turbopack | Logs emit as NDJSON in the terminal. Pipe through `pino-pretty` if you want colorized output: `npm run dev 2>&1 | pino-pretty` |
| Mock AI provider | All queries use the built-in `MockAIClient`. The SQL it generates is keyword-driven (financial/patient/operational) and deterministic. Switch to Anthropic/OpenAI in `aiden.config.ts` + install the provider SDK for real NLP. |
| No catalog edit UI | `PATCH /api/catalog/[id]` is implemented and tested; the admin edit dialog in the UI was deferred. |

---

## 7. Understanding the data

The seed loads three datasets across 5 fictional Meridian Health facilities (Northeast Medical, Riverside General, Mountain View Health, Coastal Community, Valley Regional — plus an adversarial sixth with SQL injection in its name to test the query engine's injection fence).

**Patient outcomes** (80 rows): readmission rates, average LOS, patient satisfaction scores, mortality rates — one row per facility per quarter.

**Operational metrics** (80 rows): bed occupancy %, ED wait times, staff-to-patient ratios, procedure volume — same structure.

**Financial records** (2000 rows): monthly revenue, expenses, net margin, cost-per-case — 10 months × 5 facilities × 8 service lines.

**Catalog** (25 entries): business definitions for 20 columns across the three tables, plus 5 table-level entries. The AI uses these as schema context when generating SQL.

---

## 8. Quick smoke test sequence (5 minutes)

1. Open http://localhost:3000 → redirects to `/login` ✓
2. Log in as `angela@meridian.example`
3. Navigate to **Query**, type: `Show me total revenue by facility`
4. Verify table loads, SQL tab shows a SELECT, Chart tab shows bars
5. Click **Pin**, give it a name
6. Navigate to **Pins** → pin appears, "Show chart" expands it
7. Navigate to **Catalog** → 25 entries visible, search works
8. Navigate to **Conversations** → the session you just created is listed
9. Log out, log in as `sarah@meridian.example`
10. Navigate to **Query** → input is disabled with info alert ✓
11. Navigate to **Pins** → info alert shown ✓
12. Log out, log in as `admin@meridian.example`
13. Navigate to **Admin → AI Cost** → metric cards + usage rows ✓
14. Navigate to **Admin → Users** → all users listed ✓
