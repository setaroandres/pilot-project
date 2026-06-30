import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { abilities } from "@/lib/abilities";
import { QueryPageClient } from "./query-page-client";
import { queryPageMetadata } from "@/config/constants";

export const metadata = queryPageMetadata;

interface PageProps {
  searchParams: Promise<{ conversationId?: string }>;
}

export default async function QueryPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/query");

  const canQuery             = abilities.can(session as never, "query.run");
  const { conversationId }   = await searchParams;

  return <QueryPageClient canQuery={canQuery} initialConversationId={conversationId} />;
}
