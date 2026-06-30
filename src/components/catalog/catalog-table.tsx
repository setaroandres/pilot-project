"use client";

import { useState, useMemo } from "react";
import { Search, BookOpen } from "lucide-react";
import {
  Input,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@upstart13-com/aiden-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CatalogEntry {
  id:            string;
  domain:        string;
  tableName:     string;
  columnName:    string | null;
  businessLabel: string;
  definition:    string;
  caveats:       string | null;
  isOverride:    boolean;
}

interface CatalogTableProps {
  entries: CatalogEntry[];
  domains: string[];
}

export function CatalogTable({ entries, domains }: CatalogTableProps) {
  const [search,       setSearch]       = useState("");
  const [domainFilter, setDomainFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return entries.filter((e) => {
      if (domainFilter !== "all" && e.domain !== domainFilter) return false;
      if (!q) return true;
      return (
        e.businessLabel.toLowerCase().includes(q) ||
        e.definition.toLowerCase().includes(q) ||
        (e.columnName?.toLowerCase().includes(q) ?? false) ||
        e.tableName.toLowerCase().includes(q)
      );
    });
  }, [entries, search, domainFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2"
            strokeWidth={1.5}
          />
          <Input
            placeholder="Search labels, definitions, columns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={domainFilter} onValueChange={setDomainFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All domains" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All domains</SelectItem>
            {domains.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="text-muted-foreground mb-3 size-8" strokeWidth={1.5} />
          <p className="text-foreground text-sm font-medium">No entries found</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Try adjusting your search or domain filter.
          </p>
        </div>
      ) : (
        <div className="rounded-sm border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="text-xs font-semibold">Domain</TableHead>
                <TableHead className="text-xs font-semibold">Table</TableHead>
                <TableHead className="text-xs font-semibold">Column</TableHead>
                <TableHead className="text-xs font-semibold">Label</TableHead>
                <TableHead className="text-xs font-semibold">Definition</TableHead>
                <TableHead className="text-xs font-semibold">Caveats</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-muted/50">
                  <TableCell className="text-xs">
                    <Badge variant="secondary">{entry.domain}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{entry.tableName}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {entry.columnName ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {entry.businessLabel}
                    {entry.isOverride && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        curated
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm leading-relaxed">
                    {entry.definition}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs leading-relaxed">
                    {entry.caveats ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        {filtered.length} of {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
      </p>
    </div>
  );
}
