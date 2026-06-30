import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, assertCan, parseRequest, auditLog } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  businessLabel: z.string().min(1).max(200).optional(),
  definition:    z.string().min(1).optional(),
  caveats:       z.string().nullable().optional(),
  lineage:       z.string().nullable().optional(),
}).refine((b) => Object.keys(b).length > 0, { message: "At least one field required" });

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const PATCH = withAuth<Promise<{ id: string }>>(
  async (req, { session, params }) => {
    assertCan(abilities, session, "catalog.manage");

    const { id } = await params;
    const body   = await parseRequest(req, Body);

    const existing = await prisma.catalogEntry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Catalog entry not found" }, { status: 404 });
    }

    const entry = await prisma.catalogEntry.update({
      where: { id },
      data:  { ...body, isOverride: true },
    });

    auditLog({
      event:      "catalog.edit",
      actorId:    session.user.id,
      resourceId: id,
      metadata:   { fields: Object.keys(body) },
    });

    return NextResponse.json({ entry });
  }
) as (_req: Request, ctx: RouteParams) => Promise<Response>;
