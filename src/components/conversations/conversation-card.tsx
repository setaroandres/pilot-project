import Link from "next/link";
import { MessageSquare, ChevronRight } from "lucide-react";
import { Card, CardContent, Badge } from "@upstart13-com/aiden-ui";

interface ConversationCardProps {
  id:        string;
  title:     string;
  domain:    string | null;
  turnCount: number;
  createdAt: Date | string;
}

export function ConversationCard({
  id,
  title,
  domain,
  turnCount,
  createdAt,
}: ConversationCardProps) {
  const date = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });

  return (
    <Link href={`/dashboard/conversations/${id}`} className="group block">
      <Card className="rounded-xl transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-4 px-5 py-4">
          <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-lg">
            <MessageSquare className="text-primary size-4" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-medium">{title}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {date} · {turnCount} turn{turnCount !== 1 ? "s" : ""}
            </p>
          </div>
          {domain && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {domain}
            </Badge>
          )}
          <ChevronRight
            className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            strokeWidth={1.5}
          />
        </CardContent>
      </Card>
    </Link>
  );
}
