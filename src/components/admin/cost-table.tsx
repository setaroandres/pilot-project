"use client";

import { DollarSign, Zap, Timer, Activity } from "lucide-react";
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@upstart13-com/aiden-ui";

interface CostRow {
  id:               string;
  provider:         string;
  model:            string;
  promptTokens:     number;
  completionTokens: number;
  totalTokens:      number;
  costUSD:          number | null;
  latencyMs:        number | null;
  userId:           string | null;
  createdAt:        string | Date;
}

interface CostTotals {
  callCount:    number;
  totalTokens:  number;
  totalCostUSD: number;
  avgLatencyMs: number;
}

interface CostTableProps {
  rows:   CostRow[];
  totals: CostTotals;
}

export function CostTable({ rows, totals }: CostTableProps) {
  const metrics = [
    {
      label: "Total Calls",
      value: totals.callCount.toString(),
      icon:  Activity,
    },
    {
      label: "Total Tokens",
      value: formatNumber(totals.totalTokens),
      icon:  Zap,
    },
    {
      label: "Total Cost",
      value: `$${totals.totalCostUSD.toFixed(4)}`,
      icon:  DollarSign,
    },
    {
      label: "Avg Latency",
      value: `${Math.round(totals.avgLatencyMs)}ms`,
      icon:  Timer,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="rounded-xl">
            <CardContent className="flex items-center gap-4 px-5 py-4">
              <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-lg">
                <m.icon className="text-primary size-4" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{m.label}</p>
                <p className="text-foreground text-xl font-semibold tabular-nums">
                  {m.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Usage rows */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Activity className="text-muted-foreground mb-3 size-8" strokeWidth={1.5} />
          <p className="text-foreground text-sm font-medium">No usage recorded yet</p>
          <p className="text-muted-foreground mt-1 text-xs">
            AI usage will appear here after queries are run.
          </p>
        </div>
      ) : (
        <div className="rounded-sm border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="text-xs font-semibold">Time</TableHead>
                <TableHead className="text-xs font-semibold">Provider</TableHead>
                <TableHead className="text-xs font-semibold">Model</TableHead>
                <TableHead className="text-xs font-semibold">Prompt tkns</TableHead>
                <TableHead className="text-xs font-semibold">Completion tkns</TableHead>
                <TableHead className="text-xs font-semibold">Total tkns</TableHead>
                <TableHead className="text-xs font-semibold">Cost USD</TableHead>
                <TableHead className="text-xs font-semibold">Latency</TableHead>
                <TableHead className="text-xs font-semibold">User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/50">
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(row.createdAt).toLocaleString("en-US", {
                      month:  "short",
                      day:    "numeric",
                      hour:   "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.provider}</TableCell>
                  <TableCell className="font-mono text-xs">{row.model}</TableCell>
                  <TableCell className="tabular-nums text-xs">{row.promptTokens}</TableCell>
                  <TableCell className="tabular-nums text-xs">{row.completionTokens}</TableCell>
                  <TableCell className="tabular-nums text-xs font-medium">{row.totalTokens}</TableCell>
                  <TableCell className="tabular-nums text-xs">
                    {row.costUSD != null ? `$${row.costUSD.toFixed(4)}` : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-xs">
                    {row.latencyMs != null ? `${row.latencyMs}ms` : "—"}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate text-xs">
                    {row.userId}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
