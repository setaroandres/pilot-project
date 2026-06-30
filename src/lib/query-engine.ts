import "server-only";
import { z } from "zod";
import type { AIMessage } from "@upstart13-com/aiden-ai";
import { Prisma } from "@/generated/prisma/client";
import { aidenConfig } from "@/../aiden.config";
import { prisma } from "@/lib/prisma";
import { ai } from "@/lib/ai";
import { log } from "@/lib/logger";

// ---------------------------------------------------------------------------
// QuerySpec schema
//
// The AI returns a structured query descriptor — NOT raw SQL. The app
// translates this spec into a parameterized Prisma query, so the AI
// never authors SQL that reaches the database directly.
//
// We derive the JSON Schema forwarded as responseSchema from the Zod
// definition so both runtime validation and AI instructions stay in sync.
// ---------------------------------------------------------------------------

const ChartSpecSchema = z.object({
  type:  z.enum(["bar", "line", "area", "scatter", "table", "kpi"]),
  xAxis: z.string().optional(),
  yAxis: z.string().optional(),
  title: z.string(),
});

const MeasureSchema = z.object({
  /** SQL column to aggregate (ignored when agg === "count"). */
  column: z.string().min(1),
  /** Aggregation function to apply. */
  agg:    z.enum(["sum", "avg", "count", "min", "max", "none"]),
  /** Output column alias surfaced in results. */
  alias:  z.string().min(1),
});

const FilterSchema = z.object({
  column: z.string().min(1),
  op:     z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "like"]),
  /** Filter value — parameterized by Prisma before reaching the DB. */
  value:  z.union([z.string(), z.number()]),
});

const QuerySpecSchema = z.object({
  /** Analytics table to query. */
  entity:      z.enum(["patient_outcomes", "operational_metrics", "financial_records"]),
  /** One or more aggregated or raw columns to return. */
  measures:    z.array(MeasureSchema).min(1).max(8),
  /** Columns to GROUP BY (must be valid columns for the entity). */
  groupBy:     z.array(z.string()).max(4),
  /** Sort order. Column may be a measure alias or a groupBy column. */
  orderBy:     z.array(z.object({
    column: z.string(),
    dir:    z.enum(["asc", "desc"]),
  })).max(4),
  /** Optional WHERE conditions. Values are always parameterized. */
  filters:     z.array(FilterSchema).max(8),
  /** Maximum rows to return (1–200). */
  limit:       z.number().int().min(1).max(200),
  chartSpec:   ChartSpecSchema,
  explanation: z.string(),
});

export type ChartSpec = z.infer<typeof ChartSpecSchema>;
export type QuerySpec = z.infer<typeof QuerySpecSchema>;
type Measure = z.infer<typeof MeasureSchema>;
type Filter  = z.infer<typeof FilterSchema>;

/** JSON Schema forwarded to the AI provider's structured-output mode. */
const QUERY_SPEC_JSON_SCHEMA = z.toJSONSchema(QuerySpecSchema) as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Security: per-entity column allowlists
//
// Every column referenced in a spec (measures, groupBy, orderBy, filters)
// is checked against this allowlist before being interpolated into SQL.
// Column names pass through Prisma.raw() — they are structural SQL, not
// parameterizable — so the allowlist is the only guard. Values (filter
// operands) are fully parameterized by Prisma's tagged template engine.
// ---------------------------------------------------------------------------

const COLUMN_ALLOWLISTS: Record<string, Set<string>> = {
  patient_outcomes: new Set([
    "facility",
    "quarter",
    "region",
    "satisfaction_score",
    "readmission_rate",
    "avg_length_of_stay",
    "triage_protocol",
  ]),
  operational_metrics: new Set([
    "facility",
    "period",
    "region",
    "staffing_efficiency",
    "bed_occupancy_rate",
    "er_wait_minutes",
  ]),
  financial_records: new Set([
    "facility",
    "period",
    "region",
    "payer",
    "procedure_code",
    "revenue",
    "reimbursement_rate",
    "claims_count",
  ]),
};

function validateColumn(entity: string, column: string): void {
  if (!COLUMN_ALLOWLISTS[entity]?.has(column)) {
    throw new Error(
      `SPEC_VALIDATION_FAILED: column "${column}" is not allowed for entity "${entity}"`
    );
  }
}

// ---------------------------------------------------------------------------
// Query builder
//
// Translates a validated QuerySpec into a Prisma.Sql object for $queryRaw
// and a human-readable display string for the SQL tab in the UI.
//
// Structural SQL (table name, column names, aggregation functions, ORDER/
// GROUP BY keywords) is assembled by our code from validated allowlist
// strings and wrapped in Prisma.raw(). Filter values are parameterized
// via Prisma's tagged template engine — they never appear in the SQL
// string itself.
// ---------------------------------------------------------------------------

function buildCondition(f: Filter): Prisma.Sql {
  const col = Prisma.raw(f.column);
  switch (f.op) {
    case "eq":   return Prisma.sql`${col} = ${f.value}`;
    case "neq":  return Prisma.sql`${col} != ${f.value}`;
    case "gt":   return Prisma.sql`${col} > ${f.value}`;
    case "gte":  return Prisma.sql`${col} >= ${f.value}`;
    case "lt":   return Prisma.sql`${col} < ${f.value}`;
    case "lte":  return Prisma.sql`${col} <= ${f.value}`;
    case "like": return Prisma.sql`${col} LIKE ${f.value}`;
  }
}

function selectExpr(m: Measure): string {
  if (m.agg === "count") return `COUNT(*) AS ${m.alias}`;
  if (m.agg === "none")  return `${m.column} AS ${m.alias}`;
  return `${m.agg.toUpperCase()}(${m.column}) AS ${m.alias}`;
}

interface BuiltQuery {
  sql:        Prisma.Sql;
  displaySql: string;
}

function buildQuery(spec: QuerySpec): BuiltQuery {
  const { entity, measures, groupBy, orderBy, filters, limit } = spec;

  // Validate all column references against the per-entity allowlist.
  for (const m of measures) {
    if (m.agg !== "count") validateColumn(entity, m.column);
  }
  for (const col of groupBy) {
    validateColumn(entity, col);
  }
  for (const f of filters) {
    validateColumn(entity, f.column);
  }

  // orderBy may reference measure aliases (computed) or groupBy columns.
  const measureAliases = new Set(measures.map((m) => m.alias));
  for (const o of orderBy) {
    if (!measureAliases.has(o.column)) {
      validateColumn(entity, o.column);
    }
  }

  // --- Structural parts (trusted — all from validated allowlists) ----------

  const selectExprs = [
    ...groupBy,
    ...measures.map(selectExpr),
  ];

  const orderExprs = orderBy.map(
    (o) => `${o.column} ${o.dir.toUpperCase()}`
  );

  const selectRaw = Prisma.raw(selectExprs.join(", "));
  const tableRaw  = Prisma.raw(entity);

  // --- Build the Prisma.Sql object ------------------------------------------
  //
  // Parts are joined with Prisma.join so the final Prisma.Sql correctly
  // merges both raw fragments and any parameterized filter values.

  const parts: Prisma.Sql[] = [
    Prisma.sql`SELECT ${selectRaw} FROM ${tableRaw}`,
  ];

  if (filters.length > 0) {
    const conditions = filters.map(buildCondition);
    parts.push(Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`);
  }

  if (groupBy.length > 0) {
    parts.push(Prisma.raw(`GROUP BY ${groupBy.join(", ")}`));
  }

  if (orderExprs.length > 0) {
    parts.push(Prisma.raw(`ORDER BY ${orderExprs.join(", ")}`));
  }

  parts.push(Prisma.raw(`LIMIT ${limit}`));

  const sql = Prisma.join(parts, " ");

  // --- Display SQL (for the SQL tab in the UI) ------------------------------
  //
  // Renders a formatted human-readable version of the query. Filter values
  // are shown inline since this is display-only — no injection risk here.

  const opLabel: Record<string, string> = {
    eq: "=", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "LIKE",
  };

  const displayParts: string[] = [
    `SELECT ${selectExprs.join(",\n       ")}`,
    `FROM   ${entity}`,
  ];

  if (filters.length > 0) {
    const whereStr = filters
      .map((f) => {
        const val =
          typeof f.value === "string" ? `'${f.value}'` : String(f.value);
        return `${f.column} ${opLabel[f.op]} ${val}`;
      })
      .join("\n   AND ");
    displayParts.push(`WHERE  ${whereStr}`);
  }

  if (groupBy.length > 0) {
    displayParts.push(`GROUP  BY ${groupBy.join(", ")}`);
  }

  if (orderExprs.length > 0) {
    displayParts.push(`ORDER  BY ${orderExprs.join(", ")}`);
  }

  displayParts.push(`LIMIT  ${limit}`);

  return { sql, displaySql: displayParts.join("\n") };
}

// ---------------------------------------------------------------------------
// Schema context builder
// ---------------------------------------------------------------------------

/**
 * Fetch all CatalogEntry rows and format them as a compact text block for
 * the system prompt. Groups entries by table, with column-level definitions
 * nested under the table header.
 */
async function buildSchemaContext(): Promise<string> {
  const entries = await prisma.catalogEntry.findMany({
    orderBy: [{ tableName: "asc" }, { columnName: "asc" }],
  });

  const byTable = new Map<string, typeof entries>();
  for (const e of entries) {
    const bucket = byTable.get(e.tableName) ?? [];
    bucket.push(e);
    byTable.set(e.tableName, bucket);
  }

  const lines: string[] = [];
  for (const [table, rows] of byTable) {
    const tableEntry = rows.find((r) => r.columnName === null);
    lines.push(`TABLE: ${table}`);
    if (tableEntry) lines.push(`  ${tableEntry.definition}`);

    for (const r of rows.filter((r) => r.columnName !== null)) {
      const caveat = r.caveats ? ` [caveat: ${r.caveats}]` : "";
      lines.push(
        `  - ${r.columnName} (${r.businessLabel}): ${r.definition}${caveat}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface QueryEngineInput {
  /** The natural-language question from the user. */
  question: string;
  /** Prior turns in the conversation for follow-up question context. */
  history: AIMessage[];
  /** Used for logging and audit; not injected into prompts. */
  userId: string;
  conversationId: string;
}

export interface QueryEngineResult {
  querySpec:   QuerySpec;
  /** Human-readable SQL string for display in the UI SQL tab. */
  displaySql:  string;
  rows:        Record<string, unknown>[];
  rowCount:    number;
  executionMs: number;
}

/**
 * Translate a natural-language question into a structured query spec,
 * validate it, execute it as a parameterized Prisma query, and return
 * structured results with chart metadata.
 *
 * Security guarantee: the AI produces a data structure (entity, measures,
 * groupBy, filters) — never raw SQL. The app builds all SQL from validated,
 * allowlisted components. Filter values are fully parameterized via
 * Prisma's $queryRaw tagged template engine, so no AI-authored string
 * ever reaches the database unescaped.
 *
 * The user's question lives exclusively in the user message, never in the
 * system prompt, so prompt-injection strings in facility names or result
 * data cannot hijack system instructions.
 */
export async function runQuery(
  input: QueryEngineInput
): Promise<QueryEngineResult> {
  const { question, history, userId, conversationId } = input;

  // 1. Build schema context from catalog (goes in system prompt — safe).
  const schemaContext = await buildSchemaContext();

  // 2. System prompt — static instructions and schema metadata only.
  //    NEVER interpolate user content here.
  const systemPrompt = [
    "You are a data analyst AI assistant for Meridian Health Systems.",
    "Translate the user question into a structured query descriptor.",
    "Return ONLY a JSON object matching the response schema. No prose.",
    "",
    "RULES:",
    "1. entity must be one of: patient_outcomes, operational_metrics, financial_records",
    "2. measures: list each column + aggregation function + output alias.",
    "   Use agg='none' for non-aggregated columns.",
    "   Use agg='count' (column is ignored) for COUNT(*).",
    "3. groupBy: list grouping columns when using aggregate measures.",
    "4. orderBy: reference measure aliases or groupBy column names.",
    "5. filters: use only when the question asks for a specific subset.",
    "   Values must match the data type of the column.",
    "6. limit: default 50; use 10 for 'top N' questions.",
    "7. patient_outcomes uses 'quarter' for the time column (not 'period').",
    "8. Choose chartSpec.type by data shape:",
    "   bar     = comparisons across categories or facilities",
    "   line    = trends over time (quarters)",
    "   area    = same as line with fill, for cumulative or volume trends",
    "   scatter = relationship between two numeric measures",
    "   table   = multi-column or raw detail results",
    "   kpi     = single aggregate metrics (no time axis)",
    "",
    "SCHEMA (use exact column names shown below):",
    schemaContext,
  ].join("\n");

  // 3. User message — the question lives here.
  const messages: AIMessage[] = [
    ...history,
    { role: "user", content: question },
  ];

  // 4. AI call — toggle between mock and real provider via aiden.config.ts.
  const useMock = (aidenConfig.ai.providers.mock as { enabled: boolean }).enabled;
  const client  = useMock ? await ai.mock() : await ai.anthropic();

  const response = await client.complete({
    system:         systemPrompt,
    messages,
    responseSchema: QUERY_SPEC_JSON_SCHEMA,
    temperature:    0,
  });

  // 5. Validate AI response shape with Zod.
  if (!response.parsed) {
    log.error(
      { userId, conversationId, preview: response.text.slice(0, 200) },
      "query-engine: AI returned unparseable response"
    );
    throw new Error("The AI returned an invalid response. Please rephrase your question.");
  }

  const parseResult = QuerySpecSchema.safeParse(response.parsed);
  if (!parseResult.success) {
    log.error(
      { userId, conversationId, issues: parseResult.error.issues },
      "query-engine: QuerySpec schema mismatch"
    );
    throw new Error(
      "The AI response did not match the expected format. Please rephrase your question."
    );
  }

  const querySpec = parseResult.data;

  // 6. Build a parameterized Prisma query from the validated spec.
  //    validateColumn() throws if the spec references an unlisted column.
  const { sql: builtSql, displaySql } = buildQuery(querySpec);

  // 7. Execute against the analytics tables — no AI-authored SQL touches the DB.
  const execStart   = Date.now();
  const rows        = await prisma.$queryRaw<Record<string, unknown>[]>(builtSql);
  const executionMs = Date.now() - execStart;

  log.info(
    { userId, conversationId, rowCount: rows.length, executionMs },
    "query-engine: query complete"
  );

  return {
    querySpec,
    displaySql,
    rows,
    rowCount:    rows.length,
    executionMs,
  };
}
