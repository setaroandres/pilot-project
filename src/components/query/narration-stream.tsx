"use client";

import { useEffect } from "react";
import { useAIStream } from "@upstart13-com/aiden-realtime/react";

interface NarrationStreamProps {
  /**
   * The ConversationTurn id to narrate. The server looks up the question,
   * row count, and chart type from this turn itself (and enforces
   * ownership) — nothing else is trusted from the client.
   */
  turnId:   string;
  /** Static explanation returned by the query engine — shown on error or before stream starts. */
  fallback: string;
}

/**
 * Fires POST /api/narrate automatically on mount and streams the AI's narrated
 * explanation token-by-token. Falls back to the static `explanation` field from
 * the query engine if the stream errors.
 */
export function NarrationStream({
  turnId,
  fallback,
}: NarrationStreamProps) {
  const { text, isLoading, error, send } = useAIStream<{
    turnId: string;
  }>("/api/narrate");

  // Fire once when the result card is first rendered.
  useEffect(() => {
    void send({ turnId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const display = text || fallback;

  return (
    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
      {error ? fallback : display}
      {isLoading && (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-[0.85em] w-[2px] animate-pulse rounded-full bg-muted-foreground align-middle"
        />
      )}
    </p>
  );
}
