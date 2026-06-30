"use client";

import { useState } from "react";
import { Pin } from "lucide-react";
import { Button } from "@upstart13-com/aiden-ui";
import Link from "next/link";
import { PinCard } from "@/components/pins/pin-card";

interface PinItem {
  id:             string;
  title:          string;
  explanation:    string;
  chartSpec:      Record<string, unknown>;
  resultSnapshot: Record<string, unknown>[] | null;
  createdAt:      string;
}

interface PinsListClientProps {
  initialPins: PinItem[];
  canQuery:    boolean;
}

export function PinsListClient({ initialPins, canQuery }: PinsListClientProps) {
  const [pins, setPins] = useState<PinItem[]>(initialPins);

  function handleDeleted(id: string) {
    setPins((prev) => prev.filter((p) => p.id !== id));
  }

  if (pins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Pin className="text-muted-foreground mb-3 size-8" strokeWidth={1.5} />
        <p className="text-foreground text-sm font-medium">No pins yet</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {canQuery
            ? `Run a query and click "Pin" to save a visualization here.`
            : "Pinned visualizations from analysts will appear here."}
        </p>
        {canQuery && (
          <Button asChild className="mt-4" size="sm">
            <Link href="/dashboard/query">Start exploring</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {pins.map((pin) => (
        <PinCard
          key={pin.id}
          id={pin.id}
          title={pin.title}
          explanation={pin.explanation}
          chartSpec={pin.chartSpec}
          resultSnapshot={pin.resultSnapshot}
          createdAt={pin.createdAt}
          onDeleted={handleDeleted}
        />
      ))}
    </div>
  );
}
