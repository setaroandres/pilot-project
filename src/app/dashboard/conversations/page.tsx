import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { PageHeader, Button } from "@upstart13-com/aiden-ui";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConversationCard } from "@/components/conversations/conversation-card";

export const metadata = { title: "Conversations | AI Data Explorer" };

export default async function ConversationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/conversations");

  const conversations = await prisma.conversation.findMany({
    where:   { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take:    50,
    include: { _count: { select: { turns: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Conversations"
        subtitle="Your query history with the AI Data Explorer."
        action={
          <Button asChild>
            <Link href="/dashboard/query">
              <MessageSquare className="mr-2 size-4" strokeWidth={1.5} />
              New Query
            </Link>
          </Button>
        }
      />

      <div className="space-y-3 px-6 py-8">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="text-muted-foreground mb-3 size-8" strokeWidth={1.5} />
            <p className="text-foreground text-sm font-medium">No conversations yet</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Run your first query to start a conversation.
            </p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/dashboard/query">Start exploring</Link>
            </Button>
          </div>
        ) : (
          conversations.map((c) => (
            <ConversationCard
              key={c.id}
              id={c.id}
              title={c.title}
              domain={c.domain}
              turnCount={c._count.turns}
              createdAt={c.createdAt}
            />
          ))
        )}
      </div>
    </div>
  );
}
