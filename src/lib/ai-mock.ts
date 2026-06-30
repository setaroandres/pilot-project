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
    // Narration request — the narrate route embeds the original question in the
    // prompt so keyword matching still works here.
    if (lastUser.includes("Narrate the following")) {
      if (q.includes("revenue") || q.includes("financial") || q.includes("reimbursement")) {
        return "Austin Medical Center leads Meridian's network in total revenue, driven by strong reimbursement rates across all major payers. Dallas Regional Hospital and Houston Westside Medical follow closely behind, while the remaining facilities show consistent but lower volumes. Overall the portfolio is healthy with no significant outliers, though Fort Worth Community warrants a closer look at its payer mix.";
      }
      if (q.includes("readmission") || q.includes("satisfaction") || q.includes("patient") || q.includes("outcome")) {
        return "Patient satisfaction scores vary meaningfully across facilities, with Austin Medical Center ranking highest in the network and Corpus Christi Hospital showing the most room for improvement. Readmission rates are within acceptable clinical thresholds at most sites, though El Paso Health Center is slightly elevated and may benefit from a targeted care-transition review. Average length of stay across the portfolio sits at approximately 4.2 days, in line with national benchmarks for this case mix.";
      }
      if (q.includes("trend") || q.includes("quarter") || q.includes("occupancy") || q.includes("period")) {
        return "Bed occupancy rates have trended upward across every quarter, peaking at 78% in 2024-Q3 — up from 71% in 2023-Q1 — consistent with seasonal demand patterns and network growth. The steady rise indicates growing utilization without yet reaching capacity constraints, giving the network a reasonable runway before expansion becomes critical. Monitoring Q4 figures will be important to assess whether the peak is cyclical or structural.";
      }
      if (q.includes("staffing") || q.includes("operational") || q.includes("er wait") || q.includes("bed")) {
        return "Staffing efficiency metrics reveal clear performance gaps, with Plano Specialty Center and Austin Medical Center posting the highest scores across the network. ER wait times correlate inversely with staffing efficiency scores, suggesting that targeted workforce investments directly reduce patient wait times. Three facilities are currently operating below the network's 70th-percentile threshold and would benefit from a workforce planning review in the next planning cycle.";
      }
      // Generic narration — row count is embedded in the prompt as "Rows returned: N"
      const rowMatch = /rows returned:\s*(\d+)/i.exec(lastUser);
      const n = rowMatch ? rowMatch[1] : "several";
      return `The query returned ${n} rows from the Meridian Health dataset. Results show meaningful variation across facilities, with some outperforming the network average and others presenting clear opportunities for improvement. This data can be used to prioritise operational initiatives and inform resource allocation decisions in the next planning cycle.`;
    }
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
      entity:   "financial_records",
      measures: [
        { column: "revenue",           agg: "sum", alias: "total_revenue" },
        { column: "reimbursement_rate", agg: "avg", alias: "avg_rate"    },
      ],
      groupBy: ["facility"],
      orderBy: [{ column: "total_revenue", dir: "desc" }],
      filters: [],
      limit:   10,
      chartSpec: {
        type:  "bar",
        xAxis: "facility",
        yAxis: "total_revenue",
        title: "Total Revenue by Facility",
      },
      explanation:
        "Aggregates total revenue and average reimbursement rate per facility for 2023.",
    });
  }

  // Time-series / trend keywords → line chart
  if (
    q.includes("trend")      ||
    q.includes("over time")  ||
    q.includes("by quarter") ||
    q.includes("quarterly")  ||
    q.includes("by period")
  ) {
    return JSON.stringify({
      entity:   "operational_metrics",
      measures: [
        { column: "bed_occupancy_rate", agg: "avg", alias: "avg_bed_occupancy" },
        { column: "er_wait_minutes",    agg: "avg", alias: "avg_er_wait"       },
      ],
      groupBy: ["period"],
      orderBy: [{ column: "period", dir: "asc" }],
      filters: [],
      limit:   50,
      chartSpec: {
        type:  "line",
        xAxis: "period",
        yAxis: "avg_bed_occupancy",
        title: "Bed Occupancy Rate by Quarter",
      },
      explanation:
        "Tracks average bed occupancy rate across all facilities over each quarter.",
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
      entity:   "operational_metrics",
      measures: [
        { column: "staffing_efficiency", agg: "avg", alias: "avg_staffing"  },
        { column: "bed_occupancy_rate",  agg: "avg", alias: "avg_occupancy" },
        { column: "er_wait_minutes",     agg: "avg", alias: "avg_wait"      },
      ],
      groupBy: ["facility"],
      orderBy: [{ column: "avg_staffing", dir: "desc" }],
      filters: [],
      limit:   50,
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
    q.includes("readmission")    ||
    q.includes("satisfaction")   ||
    q.includes("length of stay") ||
    q.includes("los")            ||
    q.includes("patient")        ||
    q.includes("mortality")      ||
    q.includes("outcome")        ||
    q.includes("facility")
  ) {
    return JSON.stringify({
      entity:   "patient_outcomes",
      measures: [
        { column: "satisfaction_score", agg: "avg", alias: "avg_satisfaction" },
        { column: "readmission_rate",   agg: "avg", alias: "avg_readmission"  },
        { column: "avg_length_of_stay", agg: "avg", alias: "avg_los"          },
      ],
      groupBy: ["facility"],
      orderBy: [{ column: "avg_satisfaction", dir: "desc" }],
      filters: [],
      limit:   50,
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

  // Generic fallback — no domain keywords matched
  return JSON.stringify({
    entity:   "patient_outcomes",
    measures: [
      { column: "facility", agg: "count", alias: "record_count" },
    ],
    groupBy: ["facility"],
    orderBy: [{ column: "record_count", dir: "desc" }],
    filters: [],
    limit:   50,
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
