import { redirect } from "next/navigation";
import { PageHeader } from "@upstart13-com/aiden-ui";
import { auth } from "@/lib/auth";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";
import { CostTable } from "@/components/admin/cost-table";

export const metadata = { title: "AI Cost | Admin" };

export default async function AdminCostPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/cost");

  // Defense-in-depth: layout guards the segment, but this page re-checks.
  const canView = abilities.can(session as never, "cost.view");
  if (!canView) redirect("/dashboard");

  const [rows, totals] = await Promise.all([
    prisma.aIUsage.findMany({
      orderBy: { createdAt: "desc" },
      take:    200,
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
      _sum:   { totalTokens: true, costUSD: true },
      _avg:   { latencyMs: true },
      _count: true,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="AI Usage & Cost"
        subtitle="Token consumption and cost telemetry for all AI query engine calls."
      />
      <div className="px-6 py-8">
        <CostTable
          rows={rows.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
          }))}
          totals={{
            callCount:    totals._count,
            totalTokens:  totals._sum.totalTokens  ?? 0,
            totalCostUSD: totals._sum.costUSD       ?? 0,
            avgLatencyMs: totals._avg.latencyMs     ?? 0,
          }}
        />
      </div>
    </div>
  );
}
