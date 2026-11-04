/**
 * The lookup service: query -> AI -> validated LookupResult.
 * No Next.js imports, so it can be tested with a fake provider.
 */
import { AiProviderError, type AiProvider } from "@/lib/ai/provider";
import { parseAiResponse } from "@/lib/domain/ai-response";
import type { LookupErrorCode } from "@/lib/domain/lookup-error";
import type { LookupResult } from "@/lib/domain/lookup-result";
import { buildMessages } from "@/lib/domain/prompt";
import type { ParsedQuery } from "@/lib/domain/query";

export type LookupOutcome =
  | { ok: true; result: LookupResult }
  | { ok: false; error: LookupErrorCode; detail?: string };

/** How many times to ask again when the AI's JSON is unusable. */
const RETRIES_ON_INVALID = 1;

export async function lookup(
  query: ParsedQuery,
  provider: AiProvider | null,
  opts?: { signal?: AbortSignal },
): Promise<LookupOutcome> {
  if (!provider) return { ok: false, error: "not_configured", detail: "GROQ_API_KEY is not set" };
  const messages = buildMessages(query);

  for (let attempt = 0; ; attempt++) {
    let raw: string;
    try {
      raw = await provider.complete(messages, opts);
    } catch (e) {
      if (e instanceof AiProviderError) return { ok: false, error: e.code, detail: e.message };
      return { ok: false, error: "upstream_error", detail: String(e) };
    }
    const parsed = parseAiResponse(raw, query);
    if (parsed.ok) return parsed;
    if (parsed.error === "not_found" || attempt >= RETRIES_ON_INVALID) {
      return { ok: false, error: parsed.error, detail: raw.slice(0, 300) };
    }
  }
}
