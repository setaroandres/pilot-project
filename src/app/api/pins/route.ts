import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, assertCan, parseRequest, auditLog } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";

// ── GET /api/pins ──────────────────────────────────────────────────────────
// Authenticated; no role gate — viewers get an empty array (they have no pins).

export const GET = withAuth(async (_req, { session }) => {
  const pins = await prisma.pinnedVisualization.findMany({
    where:   { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id:             true,
      title:          true,
      querySpec:      true,
      chartSpec:      true,
      resultSnapshot: true,
      createdAt:      true,
    },
  });

  return NextResponse.json({ pins });
});

// ── POST /api/pins ─────────────────────────────────────────────────────────

const Body = z.object({
  conversationTurnId: z.string().cuid(),
  title:              z.string().min(1).max(200),
  resultSnapshot:     z.array(z.record(z.string(), z.unknown())).optional(),
});

export const POST = withAuth(async (req, { session }) => {
  assertCan(abilities, session, "query.run");

  const { conversationTurnId, title, resultSnapshot } = await parseRequest(req, Body);

  const turn = await prisma.conversationTurn.findUnique({
    where: { id: conversationTurnId },
  });

  if (!turn) {
    return NextResponse.json({ error: "Turn not found" }, { status: 404 });
  }

  // ConversationTurn has userId directly — use it for ownership check.
  if (turn.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pin = await prisma.pinnedVisualization.create({
    data: {
      userId:         session.user.id,
      title,
      querySpec:      turn.querySpec as object ?? {},
      chartSpec:      turn.chartSpec as object ?? {},
      resultSnapshot: resultSnapshot as object[] | undefined,
    },
  });

  auditLog({
    event:      "pin.create",
    actorId:    session.user.id,
    resourceId: pin.id,
    metadata:   { conversationTurnId, title },
  });

  return NextResponse.json({ pin }, { status: 201 });
});
