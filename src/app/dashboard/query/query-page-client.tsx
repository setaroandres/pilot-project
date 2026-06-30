"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pin, Code2, MessageSquare, AlertCircle } from "lucide-react";
import {
  PageHeader,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Badge,
} from "@upstart13-com/aiden-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QueryInput, type QueryTurnResult } from "@/components/query/query-input";
import { ResultsTable }                      from "@/components/query/results-table";
import { ChartView }                         from "@/components/query/chart-view";

interface QueryPageClientProps {
  canQuery:              boolean;
  initialConversationId?: string;
}

interface TurnState {
  id:          string;
  userQuery:   string;
  explanation: string;
  sql:         string;
  rows:        Record<string, unknown>[];
  rowCount:    number;
  executionMs: number;
  chartSpec?: {
    type:   string;
    xAxis?: string;
    yAxis?: string;
    title?: string;
  };
  pinning: boolean;
  pinned:  boolean;
}

export function QueryPageClient({ canQuery, initialConversationId }: QueryPageClientProps) {
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [turns,          setTurns]          = useState<TurnState[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [activeTab,      setActiveTab]      = useState<Record<string, "table" | "chart" | "sql">>({});

  function getTab(turnId: string): "table" | "chart" | "sql" {
    return activeTab[turnId] ?? "table";
  }

  function setTab(turnId: string, tab: "table" | "chart" | "sql") {
    setActiveTab((prev) => ({ ...prev, [turnId]: tab }));
  }

  function handleResult(result: QueryTurnResult, cid: string) {
    setConversationId(cid);
    setTurns((prev) => [
      ...prev,
      {
        id:          result.turnId,
        userQuery:   result.userQuery,
        explanation: result.explanation,
        sql:         result.sql,
        rows:        result.rows,
        rowCount:    result.rowCount,
        executionMs: result.executionMs,
        chartSpec:   result.chartSpec,
        pinning:     false,
        pinned:      false,
      },
    ]);
    setLoading(false);
    // Default to chart tab if chartSpec is available
    if (result.chartSpec?.xAxis && result.chartSpec?.yAxis) {
      setTab(result.turnId, "chart");
    }
  }

  function handleError(message: string) {
    toast.error("Query failed", { description: message });
    setLoading(false);
  }

  async function handlePin(turn: TurnState) {
    const title = window.prompt("Name this pin:", turn.userQuery.slice(0, 80));
    if (!title) return;

    setTurns((prev) =>
      prev.map((t) => (t.id === turn.id ? { ...t, pinning: true } : t))
    );

    try {
      const res = await fetch("/api/pins", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationTurnId: turn.id,
          title,
          resultSnapshot: turn.rows.slice(0, 100),
        }),
      });

      if (!res.ok) {
        toast.error("Could not save pin");
      } else {
        toast.success("Pinned!", { description: title });
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turn.id ? { ...t, pinned: true, pinning: false } : t
          )
        );
        return;
      }
    } catch {
      toast.error("Network error — pin not saved");
    }

    setTurns((prev) =>
      prev.map((t) => (t.id === turn.id ? { ...t, pinning: false } : t))
    );
  }

  return (
    <div>
      <PageHeader
        title="Data Explorer"
        subtitle="Ask questions about Meridian Health data in plain English."
      />

      <div className="space-y-8 px-6 py-8">
        {!canQuery && (
          <Alert variant="info">
            <AlertCircle className="size-4" strokeWidth={1.5} />
            <AlertTitle>Read-only access</AlertTitle>
            <AlertDescription>
              Your role can view saved pins but cannot run new queries. Contact an
              admin to request analyst access.
            </AlertDescription>
          </Alert>
        )}

        {/* Input */}
        <Card className="rounded-xl">
          <CardContent className="px-5 pt-5 pb-4">
            <QueryInput
              conversationId={conversationId}
              onResult={(result, cid) => {
                setLoading(true);
                handleResult(result, cid);
              }}
              onError={handleError}
              disabled={!canQuery || loading}
            />
          </CardContent>
        </Card>

        {/* Loading skeleton */}
        {loading && (
          <Card className="rounded-xl">
            <CardContent className="space-y-3 px-5 py-5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        )}

        {/* Turn results — most recent first */}
        {[...turns].reverse().map((turn) => (
          <Card key={turn.id} className="rounded-xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <MessageSquare className="text-primary size-4" strokeWidth={1.5} />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">{turn.userQuery}</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    {turn.explanation}
                  </p>
                </div>
              </div>
              {canQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={turn.pinning || turn.pinned}
                  onClick={() => void handlePin(turn)}
                  className="shrink-0"
                >
                  <Pin className="mr-1.5 size-3.5" strokeWidth={1.5} />
                  {turn.pinned ? "Pinned" : turn.pinning ? "Saving…" : "Pin"}
                </Button>
              )}
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              {/* Tab bar */}
              <div className="flex gap-2 border-b border-border pb-3">
                {(["table", "chart", "sql"] as const).map((tab) => {
                  const isChart = tab === "chart";
                  const hasChart =
                    turn.chartSpec?.xAxis && turn.chartSpec?.yAxis && turn.rows.length > 0;
                  if (isChart && !hasChart) return null;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setTab(turn.id, tab)}
                      className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                        getTab(turn.id) === tab
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {tab === "sql" ? "SQL" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  );
                })}
                <Badge variant="secondary" className="ml-auto text-xs">
                  {turn.rowCount} rows · {turn.executionMs}ms
                </Badge>
              </div>

              {getTab(turn.id) === "table" && (
                <ResultsTable
                  rows={turn.rows}
                  rowCount={turn.rowCount}
                  executionMs={turn.executionMs}
                />
              )}

              {getTab(turn.id) === "chart" && turn.chartSpec && (
                <ChartView rows={turn.rows} chartSpec={turn.chartSpec} />
              )}

              {getTab(turn.id) === "sql" && (
                <div className="overflow-x-auto rounded-md border border-border bg-muted">
                  <pre className="p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    <Code2
                      className="text-muted-foreground mr-2 inline size-3.5"
                      strokeWidth={1.5}
                    />
                    {turn.sql}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Empty state */}
        {turns.length === 0 && !loading && canQuery && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="text-muted-foreground mb-3 size-8" strokeWidth={1.5} />
            <p className="text-foreground text-sm font-medium">Ask your first question</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Type a question above to query Meridian Health data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
