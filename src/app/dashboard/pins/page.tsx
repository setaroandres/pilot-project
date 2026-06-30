import { redirect } from "next/navigation";
import { Pin, AlertCircle } from "lucide-react";
import { PageHeader, Button } from "@upstart13-com/aiden-ui";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PinsListClient } from "./pins-list-client";

import { pinsPageMetadata } from "@/config/constants";

export const metadata = pinsPageMetadata;

export default async function PinsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/pins");

  const canQuery = abilities.can(session as never, "query.run");

  // Viewers have no pins — skip the DB query.
  const pins = canQuery
    ? await prisma.pinnedVisualization.findMany({
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
      })
    : [];

  return (
    <div>
      <PageHeader
        title="Pins"
        subtitle="Saved visualizations you can return to."
        action={
          canQuery ? (
            <Button asChild>
              <Link href="/dashboard/query">
                <Pin className="mr-2 size-4" strokeWidth={1.5} />
                New Query
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6 px-6 py-8">
        {!canQuery && (
          <Alert variant="info">
            <AlertCircle className="size-4" strokeWidth={1.5} />
            <AlertTitle>Viewer access</AlertTitle>
            <AlertDescription>
              Your current role can view this page but cannot run queries or save
              pins. Ask an admin to upgrade your role to Analyst.
            </AlertDescription>
          </Alert>
        )}

        <PinsListClient
          initialPins={pins.map((p) => ({
            id:             p.id,
            title:          p.title,
            explanation:    (p.querySpec as { explanation?: string }).explanation ?? "",
            chartSpec:      p.chartSpec as Record<string, unknown>,
            resultSnapshot: p.resultSnapshot as Record<string, unknown>[] | null,
            createdAt:      p.createdAt.toISOString(),
          }))}
          canQuery={canQuery}
        />
      </div>
    </div>
  );
}
