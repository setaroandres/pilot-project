import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Code2, ChevronRight } from "lucide-react";
import {
  PageHeader,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@upstart13-com/aiden-ui";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where:  { id },
    select: { title: true },
  });
  return { title: conversation ? `${conversation.title} | Conversations` : "Conversation" };
}

export default async function ConversationDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/conversations");

  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where:   { id, userId: session.user.id },
    include: {
      turns: {
        orderBy: { createdAt: "asc" },
        select: {
          id:               true,
          userQuery:        true,
          querySpec:        true,
          narrativeSummary: true,
          resultMetadata:   true,
          error:            true,
          createdAt:        true,
        },
      },
    },
  });

  if (!conversation) notFound();

  return (
    <div>
      <PageHeader
        title={conversation.title}
        subtitle={`${conversation.turns.length} turn${conversation.turns.length !== 1 ? "s" : ""} · ${new Date(conversation.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/conversations">
              <ArrowLeft className="mr-2 size-4" strokeWidth={1.5} />
              All conversations
            </Link>
          </Button>
        }
      />

      <div className="space-y-4 px-6 py-8">
        {conversation.turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="text-muted-foreground mb-3 size-8" strokeWidth={1.5} />
            <p className="text-foreground text-sm font-medium">No turns yet</p>
          </div>
        ) : (
          conversation.turns.map((turn, i) => {
            const qs = turn.querySpec as {
              sql?:         string;
              explanation?: string;
              chartSpec?:   { type?: string; xAxis?: string; yAxis?: string };
            } | null;

            const meta = turn.resultMetadata as {
              rowCount?:    number;
              executionMs?: number;
            } | null;

            return (
              <Card key={turn.id} className="rounded-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg">
                      <span className="text-primary text-xs font-bold">{i + 1}</span>
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-sm font-semibold leading-snug">
                        {turn.userQuery}
                      </CardTitle>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {new Date(turn.createdAt).toLocaleTimeString("en-US", {
                          hour:   "2-digit",
                          minute: "2-digit",
                        })}
                        {meta?.rowCount != null && (
                          <> · {meta.rowCount} rows</>
                        )}
                        {meta?.executionMs != null && (
                          <> · {meta.executionMs}ms</>
                        )}
                      </p>
                    </div>
                    {qs?.chartSpec?.type && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {qs.chartSpec.type}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  {turn.error ? (
                    <p className="text-destructive text-sm">{turn.error}</p>
                  ) : (
                    <>
                      {turn.narrativeSummary && (
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {turn.narrativeSummary}
                        </p>
                      )}

                      {qs?.sql && (
                        <details className="group">
                          <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium">
                            <ChevronRight
                              className="size-3.5 transition-transform group-open:rotate-90"
                              strokeWidth={1.5}
                            />
                            <Code2 className="size-3.5" strokeWidth={1.5} />
                            View SQL
                          </summary>
                          <div className="mt-2 overflow-x-auto rounded-md border border-border bg-muted">
                            <pre className="p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                              {qs.sql}
                            </pre>
                          </div>
                        </details>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}

        {/* Continue this conversation */}
        <div className="pt-2">
          <Button asChild>
            <Link href={`/dashboard/query?conversationId=${conversation.id}`}>
              <MessageSquare className="mr-2 size-4" strokeWidth={1.5} />
              Continue this conversation
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
