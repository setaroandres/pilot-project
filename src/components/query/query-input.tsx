"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Sparkles } from "lucide-react";
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Textarea,
} from "@upstart13-com/aiden-ui";

const schema = z.object({
  question: z.string().min(1, "Enter a question").max(1000),
});

type FormValues = z.infer<typeof schema>;

export interface QueryTurnResult {
  turnId:      string;
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
}

interface QueryInputProps {
  conversationId?: string;
  onResult:        (result: QueryTurnResult, conversationId: string) => void;
  onError:         (message: string) => void;
  disabled?:       boolean;
}

export function QueryInput({
  conversationId,
  onResult,
  onError,
  disabled,
}: QueryInputProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { question: "" },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: FormValues) {
    try {
      const url = conversationId
        ? `/api/conversations/${conversationId}/turns`
        : "/api/conversations";

      const res = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question: values.question }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError(
          (data as { error?: string }).error ??
            `Request failed (${res.status})`
        );
        return;
      }

      const data = await res.json() as {
        conversationId?: string;
        turn: {
          id:        string;
          userQuery: string;
          querySpec: {
            sql:         string;
            explanation: string;
            chartSpec?: { type: string; xAxis?: string; yAxis?: string; title?: string };
          };
          rows:        Record<string, unknown>[];
          rowCount:    number;
          executionMs: number;
        };
      };

      const newConversationId = data.conversationId ?? conversationId ?? "";
      onResult(
        {
          turnId:      data.turn.id,
          userQuery:   data.turn.userQuery,
          explanation: data.turn.querySpec.explanation,
          sql:         data.turn.querySpec.sql,
          rows:        data.turn.rows,
          rowCount:    data.turn.rowCount,
          executionMs: data.turn.executionMs,
          chartSpec:   data.turn.querySpec.chartSpec,
        },
        newConversationId
      );

      form.reset();
    } catch {
      onError("Network error — please try again.");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void form.handleSubmit(onSubmit)();
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="question"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder='Ask a question about Meridian Health data... e.g. "Show me readmission rates by facility for Q1"'
                  className="min-h-[80px] resize-none"
                  disabled={isSubmitting || disabled}
                  onKeyDown={handleKeyDown}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">
            Press{" "}
            <kbd className="bg-muted rounded-sm border border-border px-1 py-0.5 font-mono text-xs">
              Cmd + Enter
            </kbd>{" "}
            to run
          </p>
          <Button type="submit" disabled={isSubmitting || disabled}>
            {isSubmitting ? (
              <Loader2 className="mr-2 size-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Sparkles className="mr-2 size-4" strokeWidth={1.5} />
            )}
            {isSubmitting ? "Running..." : "Run Query"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
