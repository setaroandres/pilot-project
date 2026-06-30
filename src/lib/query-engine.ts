import "server-only";
import { z } from "zod";
import type { AIMessage } from "@upstart13-com/aiden-ai";
import { aidenConfig } from "@/../aiden.config";
import { prisma } from "@/lib/prisma";
import { ai } from "@/lib/ai";
import { log } from "@/lib/logger";

// ---------------------------------------------------------------------------
// QuerySpec schema
//
// The AI must return a JSON object matching this shape. We derive the JSON
// Schema passed to responseSchema from the Zod definition so both the
// runtime validator and the AI instructions stay in sync automatically.
// ---------------------------------------------------------------------------

const ChartSpecSchema = z.object({
  type:  z.enum(["bar", "line", "pie", "table"]),
  xAxis: z.string().optional(),
  yAxis: z.string().optional(),
  title: z.string(),
});

const QuerySpecSchema = z.object({
  sql:         z.string().min(1),
  chartSpec:   ChartSpecSchema,
  explanation: z.string(),
});

export type ChartSpec = z.infer<typeof ChartSpecSchema>;
export type QuerySpec = z.infer<typeof QuerySpecSchema>;

/** JSON Schema forwarded to the AI provider's structured-output mode. */
const QUERY_SPEC_JSON_SCHEMA = z.toJSONSchema(QuerySpecSchema) as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Security: SQL allow-list and PHI deny-list
// ---------------------------------------------------------------------------

/**
 * Only these PostgreSQL table names may appear in AI-generated SQL.
 * Prevents the model from querying auth tables, audit logs, or any other
 * system table it should not see.
 */
const ENTITY_ALLOWLIST = new Set([
  "patient_outcomes",
  "operational_metrics",
  "financial_records",
  "catalog_entries",
]);

/**
 * Column name patterns that must never appear in AI-generated SQL.
 * Guards against the model inadvertently referencing PHI-style columns that
 * don't exist in the seed data today but might in a real Snowflake migration.
 */
const PHI_DENY_LIST: RegExp[] = [
  /\bssn\b/i,
  /social_security/i,
  /\bdob\b/i,
  /date_of_birth/i,
  /medical_record/i,
  /\bmrn\b/i,
  /\bdiagnosis\b/i,
  /icd_code/i,
  /patient_id/i,
  /patient_name/i,
];

/** SQL verbs that must never appear in AI-generated queries. */
const FORBIDDEN_KEYWORDS: RegExp[] = [
  /\binsert\b/i,
  /\bupdate\b/i,
  /\bdelete\b/i,
  /\bdrop\b/i,
  /\bcreate\b/i,
  /\balter\b/i,
  /\btruncate\b/i,
  /\bgrant\b/i,
  /\brevoke\b/i,
  /\bexec(?:ute)?\b/i,
  /--/,     // single-line comment — injection vector
  /\/\*/,   // block-comment open   — injection vector
];

/**
 * Validate AI-generated SQL before it reaches the database.
 *
 * Throws a plain Error (message starts with "SQL_VALIDATION_FAILED:") so the
 * route handler can surface a safe message to the client without leaking
 * internal details.
 */
function validateSql(sql: string): void {
  const trimmed = sql.trim();

  if (!/^select\s/i.test(trimmed)) {
    throw new Error("SQL_VALIDATION_FAILED: only SELECT statements are allowed");
  }

  if (trimmed.includes(";")) {
    throw new Error("SQL_VALIDATION_FAILED: multiple statements are not allowed");
  }

  for (const re of FORBIDDEN_KEYWORDS) {
    if (re.test(trimmed)) {
      throw new Error("SQL_VALIDATION_FAILED: forbidden keyword or pattern detected");
    }
  }

  for (const re of PHI_DENY_LIST) {
    if (re.test(trimmed)) {
      throw new Error("SQL_VALIDATION_FAILED: query references a restricted column");
    }
  }

  // Extract every identifier that follows FROM or JOIN and check against
  // the allowlist. Schema-qualified names (e.g. public.patient_outcomes) have
  // the schema prefix stripped before the check.
  const tableRefs = [
    ...trimmed.matchAll(/(?:from|join)\s+(?:\w+\.)?([a-z_][a-z0-9_]*)/gi),
  ].map((m) => m[1].toLowerCase());

  for (const table of tableRefs) {
    if (!ENTITY_ALLOWLIST.has(table)) {
      throw new Error(
        `SQL_VALIDATION_FAILED: table "${table}" is not in the allowlist`
      );
    }
  }
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
  rows:        Record<string, unknown>[];
  rowCount:    number;
  executionMs: number;
}

/**
 * Translate a natural-language question into SQL, validate it, execute it,
 * and return structured results with chart metadata.
 *
 * Security guarantee: the user's question is placed exclusively in the user
 * message of the AI conversation — never in the system prompt. This means
 * injection strings embedded in facility names or other data that the model
 * surfaces in its context are fenced inside the user turn and cannot hijack
 * the system instruction.
 */
export async function runQuery(
  input: QueryEngineInput
): Promise<QueryEngineResult> {
  const { question, history, userId, conversationId } = input;

  // 1. Build schema context from catalog (goes in system prompt — safe).
  const schemaContext = await buildSchemaContext();

  // 2. System prompt — contains only static instructions and schema metadata.
  //    NEVER interpolate user content here.
  const systemPrompt = [
    "You are a data analyst AI assistant for Meridian Health Systems.",
    "Translate the user question into a valid PostgreSQL SELECT statement",
    "against the Meridian analytics database.",
    "Return ONLY a JSON object matching the response schema. No prose.",
    "",
    "RULES:",
    "1. Only query these tables: patient_outcomes, operational_metrics, financial_records",
    "2. No semicolons. No subqueries unless needed for correctness.",
    "3. Always GROUP BY when using aggregate functions.",
    "4. Limit to 50 rows unless the user asks for more.",
    "5. Choose chartSpec.type by data shape:",
    "   bar   = comparisons across categories or facilities",
    "   line  = trends over time (quarters)",
    "   pie   = proportional breakdowns of a single metric",
    "   table = multi-column or raw detail results",
    "",
    "SCHEMA:",
    schemaContext,
  ].join("\n");

  // 3. User message — the question lives here. Prompt-injection strings in
  //    query results that get re-used as follow-up history will also be
  //    confined to the user turn, never promoted into the system prompt.
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

  // 6. Validate SQL against allowlist and deny-list before touching the DB.
  validateSql(querySpec.sql);

  // 7. Execute the validated SELECT against the analytics tables.
  const execStart   = Date.now();
  const rows        = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(querySpec.sql);
  const executionMs = Date.now() - execStart;

  log.info(
    { userId, conversationId, rowCount: rows.length, executionMs },
    "query-engine: query complete"
  );

  return {
    querySpec,
    rows,
    rowCount:    rows.length,
    executionMs,
  };
}
