import { z } from "zod";
import { withAuth, parseRequest, auditLog } from "@/lib/security";
import { createAIStreamResponse }           from "@upstart13-com/aiden-realtime";
import { ai }                               from "@/lib/ai";

const Body = z.object({
  question:  z.string().min(1).max(1_000),
  rowCount:  z.number().int().min(0),
  chartType: z.string().min(1).max(50),
});

/**
 * POST /api/narrate
 *
 * Streams a 2–3 sentence narration of a query result token-by-token over SSE.
 * Called automatically by the NarrationStream component after each query turn
 * completes. Uses the same mock AI client as the query engine so the
 * provider-switch criterion (one config line) applies here too.
 *
 * Auth: required. Every narration is audited so the full query → narration
 * lifecycle appears in the audit trail.
 */
export const POST = withAuth(async (req, { session }) => {
  const { question, rowCount, chartType } = await parseRequest(req, Body);

  const client = await ai.mock();

  const stream = await client.stream({
    messages: [
      {
        role: "user",
        content: [
          "Narrate the following query result in 2–3 sentences for a healthcare executive.",
          `Question: "${question}"`,
          `Rows returned: ${rowCount}`,
          `Chart type: ${chartType}`,
        ].join("\n"),
      },
    ],
  });

  auditLog({
    event:    "ai.narrate",
    actorId:  session.user.id,
    metadata: { question: question.slice(0, 120), rowCount, chartType },
  });

  return createAIStreamResponse(stream, { signal: req.signal });
});
