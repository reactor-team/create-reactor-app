import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Bring-your-own LLM for the live director, server side only: the key never
// reaches the browser. Configure it in .env.local:
//
//   LLM_PROVIDER   anthropic | openai (default: whichever key below is set)
//   LLM_API_KEY    the provider's key (or ANTHROPIC_API_KEY / OPENAI_API_KEY)
//   LLM_MODEL      optional; defaults to the provider's fast, light model
//   LLM_BASE_URL   optional; with openai, any OpenAI-compatible endpoint
//
// Each call writes one short prompt while the stream keeps playing, so a
// fast, light model is the right default.

export type LlmProvider = "anthropic" | "openai";

export const DEFAULT_MODELS: Record<LlmProvider, string> = {
  anthropic: "claude-haiku-5-5",
  openai: "gpt-5.4-mini",
};

type LlmConfig = { provider: LlmProvider; model: string; apiKey: string; baseUrl: string | null };

/** What the page may show about the director: no key, no endpoint. */
export type DirectorInfo = { provider: LlmProvider; model: string };

function config(): LlmConfig | null {
  const env = process.env;
  const named = env.LLM_PROVIDER?.trim().toLowerCase();
  const provider: LlmProvider | null =
    named === "anthropic" || named === "openai" ? named
      : named ? null
        : env.ANTHROPIC_API_KEY ? "anthropic"
          : env.OPENAI_API_KEY || env.LLM_BASE_URL ? "openai"
            : env.LLM_API_KEY ? "anthropic"
              : null;
  if (!provider) return null;
  const apiKey = (env.LLM_API_KEY || (provider === "anthropic" ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY) || "").trim();
  const baseUrl = env.LLM_BASE_URL?.trim() || null;
  // A local OpenAI-compatible server may take no key; everything else needs one.
  if (!apiKey && !(provider === "openai" && baseUrl)) return null;
  return { provider, model: env.LLM_MODEL?.trim() || DEFAULT_MODELS[provider], apiKey, baseUrl };
}

/** The director's provider and model, or null when no LLM is configured. */
export function directorInfo(): DirectorInfo | null {
  const current = config();
  return current && { provider: current.provider, model: current.model };
}

/** A failure whose message is safe to show the viewer. */
export class LlmError extends Error {}

/**
 * One completion. `stable` follows the system prompt and is the same on every
 * call of a stream; `changing` comes last. That order lets the provider cache
 * the prefix (Anthropic with the breakpoints below; OpenAI on its own once the
 * prefix is long enough).
 */
export async function complete(system: string, stable: string, changing: string, signal: AbortSignal): Promise<string> {
  const current = config();
  if (!current) throw new LlmError("No LLM is configured.");
  return current.provider === "anthropic"
    ? anthropic(current, system, stable, changing, signal)
    : openai(current, system, stable, changing, signal);
}

async function anthropic({ model, apiKey, baseUrl }: LlmConfig, system: string, stable: string, changing: string, signal: AbortSignal): Promise<string> {
  const client = new Anthropic({ apiKey, ...(baseUrl ? { baseURL: baseUrl } : {}), maxRetries: 1 });
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 4000,
      output_config: { effort: "low" },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: [
          { type: "text", text: stable, cache_control: { type: "ephemeral" } },
          { type: "text", text: changing },
        ],
      }],
    }, { signal });
    if (response.stop_reason === "refusal") throw new LlmError("The LLM declined to write this clip.");
    return response.content.map(block => (block.type === "text" ? block.text : "")).join("");
  } catch (error) {
    if (error instanceof LlmError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new LlmError("Anthropic rejected the API key.");
    if (error instanceof Anthropic.RateLimitError) throw new LlmError("Anthropic is rate limiting this key.");
    if (error instanceof Anthropic.APIError && error.status) throw new LlmError(`Anthropic returned ${error.status}.`);
    throw error;
  }
}

// Chat Completions, the shape OpenAI-compatible servers share.
async function openai({ model, apiKey, baseUrl }: LlmConfig, system: string, stable: string, changing: string, signal: AbortSignal): Promise<string> {
  const official = !baseUrl;
  const response = await fetch(`${(baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `${stable}\n\n${changing}` },
      ],
      ...(official ? { reasoning_effort: "low" } : {}),
    }),
  });
  if (!response.ok) throw new LlmError(`The LLM endpoint returned ${response.status}.`);
  const data = await response.json() as { choices?: { message?: { content?: string | null; refusal?: string | null } }[] };
  const message = data.choices?.[0]?.message;
  if (message?.refusal) throw new LlmError("The LLM declined to write this clip.");
  return message?.content ?? "";
}
