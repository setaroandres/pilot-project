"use client";

import { useState } from "react";
import { Trash2, Pin, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@upstart13-com/aiden-ui";
import { ChartView } from "@/components/query/chart-view";

interface PinCardProps {
  id:             string;
  title:          string;
  explanation:    string;
  chartSpec:      Record<string, unknown>;
  resultSnapshot: Record<string, unknown>[] | null;
  createdAt:      Date | string;
  onDeleted:      (id: string) => void;
}

export function PinCard({
  id,
  title,
  explanation,
  chartSpec,
  resultSnapshot,
  createdAt,
  onDeleted,
}: PinCardProps) {
  const [expanded,  setExpanded]  = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  const date = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });

  const hasChart =
    !!resultSnapshot &&
    resultSnapshot.length > 0 &&
    !!chartSpec.xAxis &&
    !!chartSpec.yAxis;

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/pins/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Delete failed", { description: "Could not remove this pin." });
        return;
      }
      toast.success("Pin removed");
      onDeleted(id);
    } catch {
      toast.error("Network error", { description: "Please try again." });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="rounded-xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
            <Pin className="text-primary size-4" strokeWidth={1.5} />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            <p className="text-muted-foreground mt-0.5 text-xs">{date}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={deleting}
          onClick={handleDelete}
          className="text-muted-foreground hover:text-destructive shrink-0"
          aria-label="Delete pin"
        >
          <Trash2 className="size-4" strokeWidth={1.5} />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <p className="text-muted-foreground text-sm leading-relaxed">{explanation}</p>

        {hasChart && (
          <div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-primary flex items-center gap-1 text-xs font-medium"
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-3.5" strokeWidth={1.5} /> Hide chart
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5" strokeWidth={1.5} /> Show chart
                </>
              )}
            </button>

            {expanded && (
              <div className="mt-3">
                <ChartView
                  rows={resultSnapshot!}
                  chartSpec={{
                    type:   String(chartSpec.type   ?? "bar"),
                    xAxis:  String(chartSpec.xAxis  ?? ""),
                    yAxis:  String(chartSpec.yAxis  ?? ""),
                    title:  chartSpec.title ? String(chartSpec.title) : undefined,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
