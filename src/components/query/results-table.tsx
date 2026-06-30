"use client";

import { Database } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@upstart13-com/aiden-ui";

interface ResultsTableProps {
  rows:        Record<string, unknown>[];
  rowCount:    number;
  executionMs: number;
}

export function ResultsTable({ rows, rowCount, executionMs }: ResultsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Database className="text-muted-foreground mb-3 size-8" strokeWidth={1.5} />
        <p className="text-foreground text-sm font-medium">No rows returned</p>
        <p className="text-muted-foreground mt-1 text-xs">
          The query ran successfully but returned no data.
        </p>
      </div>
    );
  }

  const columns = Object.keys(rows[0]);

  return (
    <div className="space-y-2">
      <div className="rounded-sm border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              {columns.map((col) => (
                <TableHead key={col} className="whitespace-nowrap text-xs font-semibold">
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i} className="hover:bg-muted/50">
                {columns.map((col) => (
                  <TableCell key={col} className="whitespace-nowrap text-sm">
                    {formatCell(row[col])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-xs">
        {rowCount} row{rowCount !== 1 ? "s" : ""} · {executionMs}ms
      </p>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}
