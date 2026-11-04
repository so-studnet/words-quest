import "server-only";
import type { ChatMessage } from "@/lib/domain/prompt";
import { AiProviderError, type AiProvider } from "./provider";

export const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
/** Override with GROQ_MODEL when Groq retires or adds models (console.groq.com → Models). */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const TIMEOUT_MS = 20_000;

export class GroqProvider implements AiProvider {
  readonly name = "groq";

  constructor(
    private readonly apiKey: string,
    readonly model: string = DEFAULT_GROQ_MODEL,
    private readonly fetchImpl: typeof fetch = fetch,
    /** Only changed for local testing against a stub server. */
    private readonly baseUrl: string = DEFAULT_GROQ_BASE_URL,
  ) {}

  async complete(messages: ChatMessage[], opts?: { signal?: AbortSignal }): Promise<string> {
    const signal = opts?.signal
      ? AbortSignal.any([opts.signal, AbortSignal.timeout(TIMEOUT_MS)])
      : AbortSignal.timeout(TIMEOUT_MS);
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: 0.2,
      max_completion_tokens: 2048,
      response_format: { type: "json_object" },
    };
    // gpt-oss models "think" before answering; keep it short to save the daily token quota.
    if (this.model.startsWith("openai/gpt-oss")) body.reasoning_effort = "low";

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      throw new AiProviderError("upstream_error", `Groq request failed: ${String(e)}`);
    }

    if (res.status === 429) throw new AiProviderError("rate_limited", "Groq rate limit reached");
    if (res.status === 401 || res.status === 403) {
      throw new AiProviderError("not_configured", `Groq rejected the API key (${res.status})`);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AiProviderError("upstream_error", `Groq returned ${res.status}: ${detail.slice(0, 300)}`);
    }

    const json = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: unknown } }[];
    } | null;
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new AiProviderError("upstream_error", "Groq returned no message content");
    }
    return content;
  }
}

/** The provider configured by environment variables, or null when GROQ_API_KEY is missing. */
export function providerFromEnv(env: Record<string, string | undefined> = process.env): AiProvider | null {
  const key = env.GROQ_API_KEY?.trim();
  if (!key) return null;
  return new GroqProvider(
    key,
    env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
    fetch,
    env.GROQ_BASE_URL?.trim() || DEFAULT_GROQ_BASE_URL,
  );
}
