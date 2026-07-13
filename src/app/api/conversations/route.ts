import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, assertCan, parseRequest, auditLog } from "@/lib/security";
import {
  withRateLimit,
  type AuthHandlerContext,
} from "@upstart13-com/aiden-security";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";
import { runQuery, SpecValidationError } from "@/lib/query-engine";

// ── GET /api/conversations ───────────────────────────────────────────────
// Lists the caller's own conversations, most recent first. No role gate —
// same as /api/pins, a viewer with zero conversations just gets [].

export const GET = withAuth(async (_req, { session }) => {
  const conversations = await prisma.conversation.findMany({
    where:   { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id:        true,
      title:     true,
      domain:    true,
      createdAt: true,
      updatedAt: true,
      _count:    { select: { turns: true } },
    },
  });

  return NextResponse.json({ conversations });
});

// ── POST /api/conversations ──────────────────────────────────────────────

const Body = z.object({
  question: z.string().min(1).max(1000),
});

// Each call triggers a real AI call (and, on a real provider, real spend)
// plus a database write — same per-user sliding-window shape already used
// on /api/auth/register (there keyed by IP; here by session.user.id, since
// every caller is authenticated).
export const POST = withAuth(
  withRateLimit<AuthHandlerContext>(
    async (req, { session }) => {
      assertCan(abilities, session, "query.run");

      const { question } = await parseRequest(req, Body);

      const conversation = await prisma.conversation.create({
        data: { userId: session.user.id, title: question.slice(0, 100) },
      });

      let result;
      try {
        result = await runQuery({
          question,
          history:        [],
          userId:         session.user.id,
          conversationId: conversation.id,
        });
      } catch (err) {
        if (err instanceof SpecValidationError) {
          // A blocked spec (deny-list or allowlist rejection) is still a
          // security-relevant event — arguably more so than a successful
          // query — so it gets its own audited event rather than only
          // succeeding queries showing up in the trail. err.message names
          // the rejected column/entity (schema-level), never row data.
          auditLog({
            event:      "query.rejected",
            actorId:    session.user.id,
            resourceId: conversation.id,
            metadata:   { reason: err.message },
          });
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
        throw err;
      }

      const turn = await prisma.conversationTurn.create({
        data: {
          conversationId:   conversation.id,
          userId:           session.user.id,
          userQuery:        question,
          querySpec:        result.querySpec as object,
          chartSpec:        result.querySpec.chartSpec as object,
          resultMetadata:   { rowCount: result.rowCount, executionMs: result.executionMs },
          narrativeSummary: result.querySpec.explanation,
        },
      });

      auditLog({
        event:      "query.run",
        actorId:    session.user.id,
        resourceId: conversation.id,
        metadata:   { rowCount: result.rowCount },
      });

      return NextResponse.json(
        {
          conversationId: conversation.id,
          turn: {
            id:          turn.id,
            userQuery:   question,
            querySpec:   result.querySpec,
            displaySql:  result.displaySql,
            rows:        result.rows,
            rowCount:    result.rowCount,
            executionMs: result.executionMs,
          },
        },
        { status: 201 }
      );
    },
    {
      limit:    20,
      windowMs: 60_000,
      keyFor:   (_req, { session }) => session.user.id,
    }
  )
);
