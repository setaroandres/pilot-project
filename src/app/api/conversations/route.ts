import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, assertCan, parseRequest, auditLog } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";
import { runQuery } from "@/lib/query-engine";

const Body = z.object({
  question: z.string().min(1).max(1000),
});

export const POST = withAuth(async (req, { session }) => {
  assertCan(abilities, session, "query.run");

  const { question } = await parseRequest(req, Body);

  const conversation = await prisma.conversation.create({
    data: { userId: session.user.id, title: question.slice(0, 100) },
  });

  const result = await runQuery({
    question,
    history:        [],
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
      conversationId: conversation.id,
      turn: {
        id:          turn.id,
        userQuery:   question,
        querySpec:   result.querySpec,
        rows:        result.rows,
        rowCount:    result.rowCount,
        executionMs: result.executionMs,
      },
    },
    { status: 201 }
  );
});
