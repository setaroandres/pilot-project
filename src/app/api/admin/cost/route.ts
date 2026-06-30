import { NextResponse } from "next/server";
import { withAuth, assertCan } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(Math.max(n, lo), hi);
}

export const GET = withAuth(async (req, { session }) => {
  assertCan(abilities, session, "cost.view");

  const url   = new URL(req.url);
  const from  = url.searchParams.get("from");
  const to    = url.searchParams.get("to");
  const limit = clamp(
    parseInt(url.searchParams.get("limit") ?? "100", 10),
    1,
    500
  );

  const where = {
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to   ? { lte: new Date(to)   } : {}),
          },
        }
      : {}),
  };

  const [rows, totals] = await Promise.all([
    prisma.aIUsage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take:    limit,
      select: {
        id:               true,
        provider:         true,
        model:            true,
        promptTokens:     true,
        completionTokens: true,
        totalTokens:      true,
        costUSD:          true,
        latencyMs:        true,
        userId:           true,
        createdAt:        true,
      },
    }),
    prisma.aIUsage.aggregate({
      where,
      _sum:  { totalTokens: true, costUSD: true },
      _avg:  { latencyMs: true },
      _count: true,
    }),
  ]);

  return NextResponse.json({
    rows,
    totals: {
      callCount:   totals._count,
      totalTokens: totals._sum.totalTokens ?? 0,
      totalCostUSD: totals._sum.costUSD    ?? 0,
      avgLatencyMs: totals._avg.latencyMs  ?? 0,
    },
  });
});
