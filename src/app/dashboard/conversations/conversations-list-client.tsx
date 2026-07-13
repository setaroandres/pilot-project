"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@upstart13-com/aiden-ui";
import Link from "next/link";
import { ConversationCard } from "@/components/conversations/conversation-card";

interface ConversationItem {
  id:        string;
  title:     string;
  domain:    string | null;
  turnCount: number;
  createdAt: string;
}

interface ConversationsListClientProps {
  initialConversations: ConversationItem[];
}

export function ConversationsListClient({
  initialConversations,
}: ConversationsListClientProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>(initialConversations);

  function handleDeleted(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }

  if (conversations.length === 0) {
    return (
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
    );
  }

  return (
    <div className="space-y-3">
      {conversations.map((c) => (
        <ConversationCard
          key={c.id}
          id={c.id}
          title={c.title}
          domain={c.domain}
          turnCount={c.turnCount}
          createdAt={c.createdAt}
          onDeleted={handleDeleted}
        />
      ))}
    </div>
  );
}
