import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, assertCan, assertOwnership, parseRequest, auditLog } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";
import { runQuery } from "@/lib/query-engine";
import type { AIMessage } from "@upstart13-com/aiden-ai";

const Body = z.object({
  question: z.string().min(1).max(1000),
});

const MAX_HISTORY_TURNS = 10;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const POST = withAuth<Promise<{ id: string }>>(
  async (req, { session, params }) => {
    assertCan(abilities, session, "query.run");

    const { id } = await params;
    const { question } = await parseRequest(req, Body);

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        turns: {
          orderBy: { createdAt: "asc" },
          take:    MAX_HISTORY_TURNS,
          select:  { userQuery: true, narrativeSummary: true },
        },
      },
    });

    assertOwnership(conversation, session.user.id);

    // Build AI message history from prior turns (user question + assistant explanation).
    const history: AIMessage[] = conversation.turns.flatMap((t) => [
      { role: "user" as const,      content: t.userQuery },
      { role: "assistant" as const, content: t.narrativeSummary ?? "" },
    ]);

    const result = await runQuery({
      question,
      history,
      userId:         session.user.id,
      conversationId: conversation.id,
    });

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
      metadata:   { question: question.slice(0, 200), rowCount: result.rowCount },
    });

    return NextResponse.json(
      {
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
  }
) as (_req: Request, ctx: RouteParams) => Promise<Response>;
