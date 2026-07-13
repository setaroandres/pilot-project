import { z } from "zod";
import { withAuth, assertOwnership, parseRequest, auditLog } from "@/lib/security";
import {
  withRateLimit,
  type AuthHandlerContext,
} from "@upstart13-com/aiden-security";
import { createAIStreamResponse }           from "@upstart13-com/aiden-realtime";
import { getConfiguredClient }              from "@/lib/ai";
import { prisma }                           from "@/lib/prisma";

/** Narration is a short 2–3 sentence summary — this is a generous ceiling,
 *  not a target, so a runaway/looping response can't rack up unbounded
 *  provider cost on a single call. */
const NARRATION_MAX_TOKENS = 300;

const Body = z.object({
  turnId: z.string().cuid(),
});

/**
 * POST /api/narrate
 *
 * Streams a 2–3 sentence narration of a query result token-by-token over SSE.
 * Called automatically by the NarrationStream component after each query turn
 * completes.
 *
 * The client sends only a turnId — every other field (question, row count,
 * chart type) is read from the caller's own ConversationTurn server-side,
 * never trusted from the request body. Uses the same shared provider switch
 * as the query engine (src/lib/ai.ts getConfiguredClient) so the one-line
 * aiden.config.ts provider swap genuinely covers this route too.
 *
 * Auth: required. assertOwnership enforces that a turnId belonging to
 * another user 404s, same as every other user-data route. Every narration
 * is audited so the full query → narration lifecycle appears in the audit
 * trail — metadata only, never the question text or result rows. Rate
 * limited per-user, same shape as /api/conversations, since this is also
 * an AI call site.
 */
export const POST = withAuth(
  withRateLimit<AuthHandlerContext>(
    async (req, { session }) => {
      const { turnId } = await parseRequest(req, Body);

      const turn = await prisma.conversationTurn.findUnique({
        where: { id: turnId },
      });

      assertOwnership(turn, session.user.id);

      const question  = turn.userQuery;
      const chartSpec = turn.chartSpec as { type?: string } | null;
      const metadata  = turn.resultMetadata as { rowCount?: number } | null;
      const chartType = chartSpec?.type ?? "bar";
      const rowCount  = metadata?.rowCount ?? 0;

      const client = await getConfiguredClient();

      const stream = await client.stream({
        maxTokens: NARRATION_MAX_TOKENS,
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
        event:      "ai.narrate",
        actorId:    session.user.id,
        resourceId: turnId,
        metadata:   { rowCount, chartType },
      });

      return createAIStreamResponse(stream, { signal: req.signal });
    },
    {
      limit:    20,
      windowMs: 60_000,
      keyFor:   (_req, { session }) => session.user.id,
    }
  )
);
