# AI Data Explorer — Meridian Health Systems

An AIDEN pilot project: a natural-language analytics assistant for Meridian
Health Systems' internal reporting data. Analysts and admins ask questions
in plain English ("Which facility has the highest readmission rate this
quarter?"); the app translates that into a validated, parameterized SQL
query — never AI-authored raw SQL — runs it against three de-identified
analytics tables, and returns a chart, a data table, and a short narrated
explanation.

This is the Meridian/SQL-gen archetype of the AIDEN Capstone brief (see
`docs/plans/`), built on the `@upstart13-com/aiden-*` package stack rather
than as a from-scratch app.

## What it does

- **Ask a question, get a chart.** The query engine (`src/lib/query-engine.ts`)
  turns a natural-language question into a structured `QuerySpec` (entity,
  measures, filters, grouping — never raw SQL), validates every column
  reference against a per-entity allowlist *and* a PHI deny-list, then
  builds a parameterized Prisma query from it.
- **PHI-safe by design.** A deny-list (SSN, DOB, MRN, patient name, and
  other direct identifiers) is checked before the per-entity allowlist and
  before the AI ever sees a column listed as an option — defense in depth,
  not just a UI claim.
- **Conversations, not one-shot queries.** Follow-up questions carry the
  last 10 turns of context. Every conversation and turn is saved
  (`/dashboard/conversations`) and can be revisited or deleted.
- **Pin and export.** Any result can be pinned as a named snapshot
  (`/dashboard/pins`) or exported to CSV.
- **Role-based access.** `admin` and `analyst` can run queries; `viewer`
  can browse saved pins and the data catalog but gets a 403 from the query
  engine. Every query, narration, pin, and deletion is audit-logged.
- **Mock-first AI.** Ships with a deterministic mock provider
  (`src/lib/ai-mock.ts`) so the whole app runs end-to-end with zero API
  keys and zero cost. Toggling to a real provider (OpenAI, Anthropic,
  Google, Mistral, Groq, Cohere) is a single line in `aiden.config.ts` —
  every AI call site (query engine, narration) goes through one shared
  switch (`getConfiguredClient()` in `src/lib/ai.ts`), so the toggle covers
  the whole app at once, not route-by-route.

## What's wired

| Concern              | Package                          | File                                        |
| --------------------- | --------------------------------- | -------------------------------------------- |
| Auth                  | `@upstart13-com/aiden-auth`       | `src/lib/auth.ts`                            |
| Database              | `@upstart13-com/aiden-db`         | `src/lib/prisma.ts`                          |
| Security primitives   | `@upstart13-com/aiden-security`   | `src/lib/security.ts`, `src/proxy.ts`   |
| Logging + AI usage    | `@upstart13-com/aiden-logging`    | `src/lib/logger.ts`, `src/lib/audit.ts`      |
| AI client (mock/real)  | `@upstart13-com/aiden-ai`         | `src/lib/ai.ts`, `src/lib/ai-mock.ts`        |
| Streaming (narration) | `@upstart13-com/aiden-realtime`   | `src/app/api/narrate/route.ts`               |
| UI tokens + components| `@upstart13-com/aiden-ui`         | `src/lib/styles.css`                         |
| Feature flags          | —                                  | `aiden.config.ts`                            |
| Schema fragments       | `@upstart13-com/aiden-db`         | `prisma/fragments/*.prisma`                  |

## Getting started

```bash
# 1. Install
npm install

# 2. Set up env (copy and fill in DATABASE_URL + AUTH_SECRET at minimum)
cp .env.example .env.local
# Generate AUTH_SECRET:  openssl rand -base64 32

# 3. Spin up Postgres locally (any way you like)
docker run -d \
  --name pilot-project \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=pilot-project \
  -p 5432:5432 \
  postgres:16

# 4. Generate Prisma client (composes fragments + runs prisma generate)
npm run prisma:generate

# 5. Run migrations
npm run db:migrate

# 6. Seed roles, permissions, catalog entries, and demo users
npm run db:seed

# 7. Dev
npm run dev
```

Visit <http://localhost:3000>:

- `/` — landing
- `/login`, `/register` — auth flows powered by `aiden-auth/components`
- `/dashboard` — overview, with feature tiles for each area below
- `/dashboard/query` — the natural-language query engine
- `/dashboard/conversations` — saved conversation history
- `/dashboard/pins` — pinned visualizations
- `/dashboard/catalog` — the data catalog (tables/columns exposed to the query engine)

### Demo accounts (seeded)

| Email                        | Password        | Role      | Can query? |
| ----------------------------- | ---------------- | --------- | ---------- |
| `admin@meridian.example`      | `Admin1234!`     | `admin`   | Yes        |
| `angela@meridian.example`     | `Analyst1234!`   | `analyst` | Yes        |
| `david@meridian.example`      | `Analyst1234!`   | `analyst` | Yes        |
| `sarah@meridian.example`      | `Viewer1234!`    | `viewer`  | No (403)   |

`npm run db:seed` also seeds ~30 additional analyst/viewer accounts across
Clinical Ops and Finance departments for a more realistic-looking user list
— the four above are the ones worth logging in as by hand.

### Try it out

With the mock provider enabled (the default — see below), ask things like:

- "Which facility has the highest readmission rate?"
- "Show revenue by facility for 2023"
- "How has bed occupancy trended by quarter?"
- "What's the average staffing efficiency across the network?"

The mock provider matches keywords in your question to return a
contextually relevant chart, so most healthcare-analytics-shaped questions
"just work" without a real API key.

## Environment variables

`.env.example` is the single source of truth — copy it to `.env.local` and
fill in what you need:

```bash
cp .env.example .env.local
```

At minimum, set `DATABASE_URL` and `AUTH_SECRET`. AI provider keys are only
needed if you disable the mock provider in `aiden.config.ts` and want to
call a real model. `npx aiden doctor` validates the keys you actually need
based on that config.

### Switching from mock to a real AI provider

1. Install the provider SDK you want (e.g. `npm install @anthropic-ai/sdk`).
2. Set the matching API key in `.env.local` (e.g. `ANTHROPIC_API_KEY`).
3. In `aiden.config.ts`, set `ai.providers.mock.enabled = false`.

That's the whole change — no route code is touched, because every AI call
site reads the same `getConfiguredClient()` switch.

## Security model, in brief

- **No AI-authored SQL.** The AI returns a structured `QuerySpec` (entity,
  columns, aggregation, filters) — the app builds parameterized SQL from
  validated, allowlisted pieces. Filter values are always parameterized.
- **PHI deny-list wins over the column allowlist.** Even a column that
  somehow made it onto an entity's allowlist is still rejected if it's on
  the deny-list, and denied columns are never described to the AI in the
  first place.
- **IDOR guard on every user-owned resource.** `assertOwnership` returns an
  identical 404 whether a resource is missing or belongs to someone else —
  no distinguishable error messages that let an attacker enumerate ids.
- **Rate limiting on every AI call site.** `/api/conversations`,
  `/api/conversations/[id]/turns`, and `/api/narrate` are each capped at 20
  requests/minute per user.
- **Token ceilings on every AI call.** Query generation and narration both
  set an explicit `maxTokens`, so a misbehaving model call can't run away
  unbounded.
- **Nothing sensitive in logs.** Audit metadata records row counts and
  chart types, never the question text or result rows.
- **Security headers on every response.** `src/proxy.ts` (Next.js 16's
  renamed "Proxy" convention — formerly `middleware.ts`) applies HSTS
  (production only), X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, and a basic CSP via the
  `@upstart13-com/aiden-security` middleware primitive.

See `docs/plans/ai-data-explorer-fixes-plan.md` for the full history of how
this security model was verified and hardened, and `docs/project-documentation/`
for a deeper writeup of each feature.

## Schema fragments

`prisma/schema.prisma` is generated by `aiden-db-merge-schema` from:

- `prisma/fragments/_base.prisma` — datasource + generator
- `prisma/fragments/user.prisma` — the User model
- `prisma/fragments/conversation.prisma` — Conversation + ConversationTurn
- `prisma/fragments/pin.prisma` — PinnedVisualization
- `prisma/fragments/catalog.prisma` — CatalogEntry (data catalog metadata)
- `pkg:@upstart13-com/aiden-db/schema/*.prisma` — Account, Session, VerificationToken (NextAuth bookkeeping)

Add new fragments to `prisma/fragments/` and rerun `npm run prisma:merge`
(also run automatically as part of `db:migrate`, `db:push`, `prisma:generate`,
and `build`).

## Documentation

- `docs/plans/` — the original plan-then-build plan and the remediation
  plan for grading feedback, including a fix-by-fix explanation of every
  security change.
- `docs/project-documentation/` — implementation writeups per feature
  (query engine, RBAC, mock AI client, API routes, database schema, etc).

## Upgrading

```bash
npx aiden upgrade
```

Reads `aiden.config.ts` to determine your installed AIDEN version, fetches
the latest, runs registered codemods, applies migrations, and bumps
`package.json`.
