"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BarChart2 } from "lucide-react";
import { Card } from "@upstart13-com/aiden-ui";
import { ResultsTable } from "@/components/query/results-table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChartSpec {
  type:   string;
  xAxis?: string;
  yAxis?: string;
  title?: string;
}

interface ChartViewProps {
  rows:      Record<string, unknown>[];
  chartSpec: ChartSpec;
}

// ---------------------------------------------------------------------------
// Design-system tokens forwarded to Recharts SVG attributes.
// Recharts renders into SVG so Tailwind classes don't apply there —
// CSS variable references work because the browser resolves them from
// the nearest element that has the :root theme defined.
// ---------------------------------------------------------------------------

const CHART_COLOR    = "var(--chart-1)";   // primary-600 violet
const GRID_COLOR     = "var(--border)";
const AXIS_TICK      = { fontSize: 11, fill: "var(--muted-foreground)" };
const TOOLTIP_STYLE  = {
  background:   "var(--card)",
  border:       "1px solid var(--border)",
  borderRadius: "4px",
  fontSize:     12,
  color:        "var(--foreground)",
};

/** Shared chart margin — leaves room for angled x-axis labels. */
const CHART_MARGIN = { top: 4, right: 16, left: 0, bottom: 48 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTick(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return Number.isInteger(v) ? v.toString() : v.toFixed(2);
}

function toChartData(
  rows:  Record<string, unknown>[],
  xAxis: string,
  yAxis: string,
): { name: string; value: number }[] {
  return rows.map((r) => ({
    name:  String(r[xAxis] ?? ""),
    value: parseFloat(String(r[yAxis] ?? "0")) || 0,
  }));
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function ChartUnavailable({ reason }: { reason: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <BarChart2 className="text-muted-foreground mb-3 size-8" strokeWidth={1.5} />
      <p className="text-muted-foreground text-sm">{reason}</p>
    </div>
  );
}

function SharedAxes({ xAxis, yAxis }: { xAxis: string; yAxis: string }) {
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
      <XAxis
        dataKey="name"
        tick={{ ...AXIS_TICK, angle: -35, textAnchor: "end" }}
        interval={0}
        label={{ value: xAxis, position: "insideBottom", offset: -8, fontSize: 11, fill: "var(--muted-foreground)" }}
      />
      <YAxis
        tick={AXIS_TICK}
        width={64}
        tickFormatter={formatTick}
        label={{ value: yAxis, angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "var(--muted-foreground)" }}
      />
      <Tooltip
        contentStyle={TOOLTIP_STYLE}
        formatter={(v: number) => [formatTick(v), yAxis]}
        labelFormatter={(label: string) => `${xAxis}: ${label}`}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Chart type renderers
// ---------------------------------------------------------------------------

function BarChartView({ data, xAxis, yAxis }: { data: ReturnType<typeof toChartData>; xAxis: string; yAxis: string }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={CHART_MARGIN}>
        <SharedAxes xAxis={xAxis} yAxis={yAxis} />
        <Bar
          dataKey="value"
          fill={CHART_COLOR}
          fillOpacity={0.85}
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartView({ data, xAxis, yAxis }: { data: ReturnType<typeof toChartData>; xAxis: string; yAxis: string }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={CHART_MARGIN}>
        <SharedAxes xAxis={xAxis} yAxis={yAxis} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={CHART_COLOR}
          strokeWidth={2}
          dot={{ fill: CHART_COLOR, r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AreaChartView({ data, xAxis, yAxis }: { data: ReturnType<typeof toChartData>; xAxis: string; yAxis: string }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={CHART_MARGIN}>
        <SharedAxes xAxis={xAxis} yAxis={yAxis} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={CHART_COLOR}
          fill={CHART_COLOR}
          fillOpacity={0.12}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ScatterChartView({ rows, xAxis, yAxis }: { rows: Record<string, unknown>[]; xAxis: string; yAxis: string }) {
  // Build {x, y, label} — if xAxis is a string column use the row index as x
  // and surface the label in the tooltip.
  const isNumericX = rows.length > 0 && typeof rows[0]![xAxis] === "number";

  const data = rows.map((r, i) => ({
    x:     isNumericX ? (Number(r[xAxis]) || 0) : i,
    y:     parseFloat(String(r[yAxis] ?? "0")) || 0,
    label: String(r[xAxis] ?? ""),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={CHART_MARGIN}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis
          dataKey="x"
          type="number"
          name={xAxis}
          tick={AXIS_TICK}
          tickFormatter={isNumericX ? formatTick : (v: number) => data[v]?.label ?? String(v)}
          label={{ value: xAxis, position: "insideBottom", offset: -8, fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          dataKey="y"
          type="number"
          name={yAxis}
          tick={AXIS_TICK}
          width={64}
          tickFormatter={formatTick}
          label={{ value: yAxis, angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v: number, name: string) => [formatTick(v), name]}
          labelFormatter={(_: unknown, payload) => {
            const pt = payload?.[0]?.payload as { label?: string } | undefined;
            return pt?.label ? `${xAxis}: ${pt.label}` : "";
          }}
        />
        <Scatter data={data} fill={CHART_COLOR} fillOpacity={0.75} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function KpiView({
  rows,
  xAxis,
  yAxis,
}: {
  rows:   Record<string, unknown>[];
  xAxis?: string;
  yAxis?: string;
}) {
  if (rows.length === 0 || !yAxis) {
    return <ChartUnavailable reason="No data available for KPI display." />;
  }

  // If rows has a single row and multiple columns, treat each column as a KPI.
  // If rows has multiple rows, treat each row as a KPI card (xAxis = label, yAxis = value).
  const cards =
    rows.length === 1
      ? Object.entries(rows[0]!).map(([key, val]) => ({
          label: key,
          value: typeof val === "number" ? formatTick(val) : String(val ?? "—"),
        }))
      : rows.map((r) => ({
          label: xAxis ? String(r[xAxis] ?? "—") : "—",
          value: formatTick(parseFloat(String(r[yAxis] ?? "0")) || 0),
        }));

  const colClass =
    cards.length <= 2
      ? "grid-cols-1 sm:grid-cols-2"
      : cards.length === 3
        ? "grid-cols-1 sm:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={`grid gap-4 ${colClass}`}>
      {cards.map((card, i) => (
        <Card key={i} className="rounded-xl p-5">
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            {card.label}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{card.value}</p>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ChartView({ rows, chartSpec }: ChartViewProps) {
  const { type, xAxis, yAxis, title } = chartSpec;

  // Table — delegate entirely to ResultsTable
  if (type === "table") {
    return <ResultsTable rows={rows} rowCount={rows.length} executionMs={0} />;
  }

  // KPI — special layout, no axis requirement
  if (type === "kpi") {
    return (
      <div className="space-y-3">
        {title && <p className="text-foreground text-sm font-semibold">{title}</p>}
        <KpiView rows={rows} xAxis={xAxis} yAxis={yAxis} />
      </div>
    );
  }

  // Scatter — needs both axes and rows
  if (type === "scatter") {
    if (!xAxis || !yAxis || rows.length === 0) {
      return <ChartUnavailable reason="Scatter chart requires both an x-axis and y-axis column." />;
    }
    return (
      <div className="space-y-3">
        {title && <p className="text-foreground text-sm font-semibold">{title}</p>}
        <ScatterChartView rows={rows} xAxis={xAxis} yAxis={yAxis} />
        <p className="text-muted-foreground text-xs">{yAxis} vs {xAxis}</p>
      </div>
    );
  }

  // All other types (bar, line, area) need xAxis + yAxis + rows
  if (!xAxis || !yAxis || rows.length === 0) {
    return <ChartUnavailable reason="Chart data unavailable for this result." />;
  }

  const data = toChartData(rows, xAxis, yAxis);

  return (
    <div className="space-y-3">
      {title && <p className="text-foreground text-sm font-semibold">{title}</p>}

      {type === "line"  && <LineChartView  data={data} xAxis={xAxis} yAxis={yAxis} />}
      {type === "area"  && <AreaChartView  data={data} xAxis={xAxis} yAxis={yAxis} />}
      {/* Default to bar for unknown types */}
      {(type === "bar" || (type !== "line" && type !== "area")) && (
        <BarChartView data={data} xAxis={xAxis} yAxis={yAxis} />
      )}

      <p className="text-muted-foreground text-xs">
        {yAxis} by {xAxis}
      </p>
    </div>
  );
}
