import "server-only";
/**
 * Lazy AI client factories.
 *
 * Call `ai.mock()`, `ai.openai()`, etc. only when needed so provider SDKs
 * you have not installed never fault. Toggle providers in aiden.config.ts.
 *
 * Side effect on import: registers the AIUsage database sink so every AI
 * call (mock or real) persists a row to the ai_usage table automatically.
 */

import { createAIClient, type AIClient } from "@upstart13-com/aiden-ai";
import { setAIUsageSink }                from "@upstart13-com/aiden-logging";
import { aidenConfig }                   from "@/../aiden.config";
import { prisma }                        from "@/lib/prisma";
import { MockAIClient }                  from "@/lib/ai-mock";

// ---------------------------------------------------------------------------
// AI usage sink — persists one row per AI call to ai_usage.
// Registered once at module load; fired automatically by every adapter
// (including MockAIClient) via reportUsage() / recordAIUsage().
// ---------------------------------------------------------------------------

setAIUsageSink(async (record) => {
  // Strip requestId — it's added by aiden-logging for tracing but the
  // AIUsage Prisma model doesn't have that column.
  const { requestId: _requestId, ...data } = record as typeof record & { requestId?: string };
  await prisma.aIUsage.create({ data });
});

// ---------------------------------------------------------------------------
// Provider factories
// ---------------------------------------------------------------------------

const providerModels = aidenConfig.ai.providers;

export const ai = {
  /**
   * Built-in mock client — no API key, zero cost.
   * Enabled via `aiden.config.ts` ai.providers.mock.enabled.
   */
  mock: (): Promise<AIClient> => Promise.resolve(new MockAIClient()),

  openai: (
    model = providerModels.openai.model ?? "gpt-4o-mini"
  ): Promise<AIClient> =>
    createAIClient({
      provider: "openai",
      model,
      apiKey: process.env.OPENAI_API_KEY,
    }),

  anthropic: (
    model = providerModels.anthropic.model ?? "claude-haiku-4-5"
  ): Promise<AIClient> =>
    createAIClient({
      provider: "anthropic",
      model,
      apiKey: process.env.ANTHROPIC_API_KEY,
    }),

  google: (
    model = providerModels.google.model ?? "gemini-2.5-flash"
  ): Promise<AIClient> =>
    createAIClient({
      provider: "google",
      model,
      apiKey: process.env.GOOGLE_API_KEY,
    }),

  mistral: (
    model = providerModels.mistral.model ?? "mistral-small-latest"
  ): Promise<AIClient> =>
    createAIClient({
      provider: "mistral",
      model,
      apiKey: process.env.MISTRAL_API_KEY,
    }),

  groq: (
    model = providerModels.groq.model ?? "llama-3.3-70b-versatile"
  ): Promise<AIClient> =>
    createAIClient({
      provider: "groq",
      model,
      apiKey: process.env.GROQ_API_KEY,
    }),

  cohere: (
    model = providerModels.cohere.model ?? "command-r"
  ): Promise<AIClient> =>
    createAIClient({
      provider: "cohere",
      model,
      apiKey: process.env.COHERE_API_KEY,
    }),
};

/**
 * The single provider-switch decision point for the app. Every AI call
 * site (query engine, narration) should call this instead of choosing a
 * provider itself, so toggling `aiden.config.ts` ai.providers.mock.enabled
 * is genuinely a one-line, zero-route-edit switch everywhere at once —
 * not just in whichever route happened to implement the check first.
 */
export function getConfiguredClient(): Promise<AIClient> {
  const useMock = providerModels.mock.enabled;
  return useMock ? ai.mock() : ai.anthropic();
}
