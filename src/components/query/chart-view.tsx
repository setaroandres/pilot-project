"use client";

import { BarChart2 } from "lucide-react";

interface ChartSpec {
  type:   string;
  xAxis?: string;
  yAxis?: string;
  title?: string;
}

interface ChartViewProps {
  rows:      Record<string, unknown>[];
  chartSpec: ChartSpec;
}

export function ChartView({ rows, chartSpec }: ChartViewProps) {
  const { type, xAxis, yAxis, title } = chartSpec;

  // Require at least an x-axis label column and a numeric y-axis column.
  if (!xAxis || !yAxis || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BarChart2 className="text-muted-foreground mb-3 size-8" strokeWidth={1.5} />
        <p className="text-muted-foreground text-sm">Chart data unavailable</p>
      </div>
    );
  }

  const supported = ["bar", "line", "pie"].includes(type);
  if (!supported) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BarChart2 className="text-muted-foreground mb-3 size-8" strokeWidth={1.5} />
        <p className="text-muted-foreground text-sm">
          Chart type <code className="font-mono">{type}</code> is not supported in preview.
        </p>
      </div>
    );
  }

  const values = rows.map((r) => ({
    label: String(r[xAxis] ?? ""),
    value: parseFloat(String(r[yAxis] ?? "0")) || 0,
  }));

  const max = Math.max(...values.map((v) => v.value), 0.001);

  return (
    <div className="space-y-3">
      {title && (
        <p className="text-foreground text-sm font-semibold">{title}</p>
      )}
      <div className="space-y-2">
        {values.map((item, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span
              className="text-muted-foreground w-36 shrink-0 truncate text-right text-xs"
              title={item.label}
            >
              {item.label}
            </span>
            <div className="relative flex h-6 flex-1 items-center rounded-sm bg-muted">
              <div
                className="absolute left-0 h-full rounded-sm bg-primary/70 transition-all"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
              <span className="text-foreground relative z-10 pl-2 text-xs font-medium">
                {formatValue(item.value)}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        {yAxis} by {xAxis}
      </p>
    </div>
  );
}

function formatValue(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}
