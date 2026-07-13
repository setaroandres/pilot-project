import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { PageHeader, Button } from "@upstart13-com/aiden-ui";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConversationsListClient } from "./conversations-list-client";

import { conversationsPageMetadata } from "@/config/constants";

export const metadata = conversationsPageMetadata;

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

      <div className="px-6 py-8">
        <ConversationsListClient
          initialConversations={conversations.map((c) => ({
            id:        c.id,
            title:     c.title,
            domain:    c.domain,
            turnCount: c._count.turns,
            createdAt: c.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
