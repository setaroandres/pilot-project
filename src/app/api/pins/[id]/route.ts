import { NextResponse } from "next/server";
import { withAuth, assertOwnership, auditLog } from "@/lib/security";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const DELETE = withAuth<Promise<{ id: string }>>(
  async (_req, { session, params }) => {
    const { id } = await params;

    const pin = await prisma.pinnedVisualization.findUnique({ where: { id } });

    assertOwnership(pin, session.user.id);

    await prisma.pinnedVisualization.delete({ where: { id } });

    auditLog({
      event:      "pin.delete",
      actorId:    session.user.id,
      resourceId: id,
    });

    return new NextResponse(null, { status: 204 });
  }
) as (_req: Request, ctx: RouteParams) => Promise<Response>;
