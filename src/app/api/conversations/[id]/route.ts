import { NextResponse } from "next/server";
import { withAuth, assertOwnership } from "@/lib/security";
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
