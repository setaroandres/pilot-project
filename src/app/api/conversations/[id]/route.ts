import { NextResponse } from "next/server";
import { withAuth, assertOwnership, auditLog } from "@/lib/security";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const GET = withAuth<Promise<{ id: string }>>(
  async (_req, { session, params }) => {
    const { id } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        turns: {
          orderBy: { createdAt: "asc" },
          select: {
            id:               true,
            userQuery:        true,
            querySpec:        true,
            chartSpec:        true,
            resultMetadata:   true,
            narrativeSummary: true,
            error:            true,
            createdAt:        true,
          },
        },
      },
    });

    assertOwnership(conversation, session.user.id);

    return NextResponse.json({ conversation });
  }
) as (_req: Request, ctx: RouteParams) => Promise<Response>;

// ── DELETE /api/conversations/[id] ───────────────────────────────────────
// Mirrors pins/[id]/route.ts: look up scoped to nothing but the id, verify
// ownership before touching anything, delete, audit, 204. ConversationTurn
// rows cascade via the schema's onDelete: Cascade relation, so no manual
// turn cleanup is needed here.

export const DELETE = withAuth<Promise<{ id: string }>>(
  async (_req, { session, params }) => {
    const { id } = await params;

    const conversation = await prisma.conversation.findUnique({ where: { id } });

    assertOwnership(conversation, session.user.id);

    await prisma.conversation.delete({ where: { id } });

    auditLog({
      event:      "conversation.delete",
      actorId:    session.user.id,
      resourceId: id,
    });

    return new NextResponse(null, { status: 204 });
  }
) as (_req: Request, ctx: RouteParams) => Promise<Response>;
