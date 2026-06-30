import { NextResponse } from "next/server";
import { withAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";

// All authenticated users can browse the catalog — no role gate.

export const GET = withAuth(async (req) => {
  const url    = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? undefined;
  const q      = url.searchParams.get("q")?.trim() ?? undefined;

  const entries = await prisma.catalogEntry.findMany({
    where: {
      ...(domain ? { domain } : {}),
      ...(q
        ? {
            OR: [
              { businessLabel: { contains: q, mode: "insensitive" } },
              { definition:    { contains: q, mode: "insensitive" } },
              { columnName:    { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ tableName: "asc" }, { columnName: "asc" }],
    select: {
      id:            true,
      domain:        true,
      tableName:     true,
      columnName:    true,
      businessLabel: true,
      definition:    true,
      caveats:       true,
      lineage:       true,
      isOverride:    true,
      updatedAt:     true,
    },
  });

  return NextResponse.json({ entries });
});
