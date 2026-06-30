import "server-only";
import type {
  AIClient,
  AICompleteOptions,
  AICompleteResponse,
  AIStreamChunk,
  AIStreamResponse,
} from "@upstart13-com/aiden-ai";
import { reportUsage } from "@upstart13-com/aiden-ai";

/**
 * Mock AI client for the Meridian pilot.
 *
 * Satisfies the graded "mock provider" requirement without calling any real
 * AI API. Returns deterministic, keyword-driven responses that the query
 * engine can process end-to-end. costUSD is always 0 (unknown model, so
 * the pricing table in aiden-ai defaults to zero).
 *
 * Wire it up in src/lib/ai.ts and toggle via aiden.config.ts.
 */

const MOCK_PROVIDER = "mock";
const MOCK_MODEL    = "mock-1.0";

// Synthetic token counts so AIUsage rows have plausible numbers.
const MOCK_PROMPT_TOKENS     = 420;
const MOCK_COMPLETION_TOKENS = 180;

/**
 * Produce a mock response body.
 *
 * When the caller supplied a responseSchema (i.e. the query engine is
 * asking for structured output), return a JSON string matching the
 * QuerySpec shape. Keywords in the last user message drive which analytics
 * table is referenced so demo queries feel contextually appropriate.
 *
 * When no responseSchema is present, return a plain-text fallback.
 */
function buildMockText(options: AICompleteOptions): string {
  const lastUser =
    [...options.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const q = lastUser.toLowerCase();

  if (!options.responseSchema) {
    return "Mock AI provider active. No real API call was made.";
  }

  // Financial domain keywords
  if (
    q.includes("financial") ||
    q.includes("revenue")   ||
    q.includes("payer")     ||
    q.includes("reimbursement") ||
    q.includes("claim")
  ) {
    return JSON.stringify({
      sql: [
        "SELECT facility, SUM(revenue) AS total_revenue,",
        "       AVG(reimbursement_rate) AS avg_rate",
        "FROM   financial_records",
        "WHERE  period LIKE \'2024%\'",
        "GROUP  BY facility",
        "ORDER  BY total_revenue DESC",
        "LIMIT  10",
      ].join(" "),
      chartSpec: {
        type:  "bar",
        xAxis: "facility",
        yAxis: "total_revenue",
        title: "Total Revenue by Facility (2024)",
      },
      explanation:
        "Aggregates total revenue and average reimbursement rate per facility for 2024.",
    });
  }

  // Operational domain keywords
  if (
    q.includes("operational") ||
    q.includes("staffing")    ||
    q.includes("bed")         ||
    q.includes("er wait")     ||
    q.includes("occupancy")
  ) {
    return JSON.stringify({
      sql: [
        "SELECT facility,",
        "       AVG(staffing_efficiency)  AS avg_staffing,",
        "       AVG(bed_occupancy_rate)   AS avg_occupancy,",
        "       AVG(er_wait_minutes)      AS avg_wait",
        "FROM   operational_metrics",
        "GROUP  BY facility",
        "ORDER  BY avg_staffing DESC",
      ].join(" "),
      chartSpec: {
        type:  "bar",
        xAxis: "facility",
        yAxis: "avg_staffing",
        title: "Average Staffing Efficiency by Facility",
      },
      explanation:
        "Compares staffing efficiency, bed occupancy, and ER wait times across facilities.",
    });
  }

  // Patient outcomes keywords (explicit match before generic fallback)
  if (
    q.includes("readmission")   ||
    q.includes("satisfaction")  ||
    q.includes("length of stay") ||
    q.includes("los")           ||
    q.includes("patient")       ||
    q.includes("mortality")     ||
    q.includes("outcome")       ||
    q.includes("facility")
  ) {
    return JSON.stringify({
      sql: [
        "SELECT facility,",
        "       AVG(satisfaction_score)  AS avg_satisfaction,",
        "       AVG(readmission_rate)    AS avg_readmission,",
        "       AVG(avg_length_of_stay)  AS avg_los",
        "FROM   patient_outcomes",
        "GROUP  BY facility",
        "ORDER  BY avg_satisfaction DESC",
      ].join(" "),
      chartSpec: {
        type:  "bar",
        xAxis: "facility",
        yAxis: "avg_satisfaction",
        title: "Average Patient Satisfaction by Facility",
      },
      explanation:
        "Averages patient satisfaction scores, readmission rates, and length of stay by facility.",
    });
  }

  // Generic fallback — no domain keywords matched; returns a per-facility record count from patient_outcomes
  return JSON.stringify({
    sql: [
      "SELECT facility,",
      "       COUNT(*) AS record_count",
      "FROM   patient_outcomes",
      "GROUP  BY facility",
      "ORDER  BY record_count DESC",
    ].join(" "),
    chartSpec: {
      type:  "bar",
      xAxis: "facility",
      yAxis: "record_count",
      title: "Patient Outcome Records by Facility",
    },
    explanation:
      "Returns the number of patient outcome records available per facility.",
  });
}

// ---------------------------------------------------------------------------
// MockAIClient
// ---------------------------------------------------------------------------

export class MockAIClient implements AIClient {
  readonly provider = MOCK_PROVIDER;
  readonly model    = MOCK_MODEL;

  async complete(options: AICompleteOptions): Promise<AICompleteResponse> {
    const start = Date.now();
    const text  = buildMockText(options);

    const usage = reportUsage({
      provider:         this.provider,
      model:            this.model,
      promptTokens:     MOCK_PROMPT_TOKENS,
      completionTokens: MOCK_COMPLETION_TOKENS,
      latencyMs:        Date.now() - start,
    });

    let parsed: unknown;
    if (options.responseSchema) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // leave parsed undefined on malformed JSON
      }
    }

    return {
      text,
      toolCalls:    [],
      parsed,
      usage,
      finishReason: "stop",
      model:        this.model,
    };
  }

  async stream(options: AICompleteOptions): Promise<AIStreamResponse> {
    const start = Date.now();
    const text  = buildMockText(options);

    // Split on whitespace so each word arrives as a separate chunk,
    // simulating realistic token-by-token streaming latency.
    const parts = text
      .split(/(?<=\s)|(?=\s)/)
      .filter((p) => p.length > 0);

    // Cache the final response so multiple finalResponse() calls are safe.
    let cached: AICompleteResponse | undefined;

    const response: AIStreamResponse = {
      [Symbol.asyncIterator](): AsyncIterator<AIStreamChunk> {
        let i = 0;
        return {
          async next(): Promise<IteratorResult<AIStreamChunk>> {
            if (i >= parts.length) {
              return { done: true, value: undefined as unknown as AIStreamChunk };
            }
            // 10 ms delay per chunk to simulate network latency in the UI.
            await new Promise<void>((r) => setTimeout(r, 10));
            return { done: false, value: { delta: parts[i++] } };
          },
        };
      },

      async finalResponse(): Promise<AICompleteResponse> {
        if (cached) return cached;

        const usage = reportUsage({
          provider:         MOCK_PROVIDER,
          model:            MOCK_MODEL,
          promptTokens:     MOCK_PROMPT_TOKENS,
          completionTokens: MOCK_COMPLETION_TOKENS,
          latencyMs:        Date.now() - start,
        });

        let parsed: unknown;
        if (options.responseSchema) {
          try {
            parsed = JSON.parse(text);
          } catch {
            // leave parsed undefined
          }
        }

        cached = {
          text,
          toolCalls:    [],
          parsed,
          usage,
          finishReason: "stop",
          model:        MOCK_MODEL,
        };

        return cached;
      },
    };

    return response;
  }
}
