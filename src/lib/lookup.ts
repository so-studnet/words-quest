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
import { AI_BUCKET, ipBucket, windowStart, type Limits } from "@/lib/domain/rate-limit";
import type { LookupCache, RateLimiter } from "@/lib/store";

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

export type LookupDeps = {
  provider: AiProvider | null;
  /** null when Supabase is not configured: no cache, no rate limits. */
  cache: LookupCache | null;
  limiter: RateLimiter | null;
  limits: Limits;
  /** Hashed client IP. */
  ipHash: string;
  now: Date;
  version: number;
  log?: (msg: string) => void;
};

export type CachedOutcome = LookupOutcome & { cached?: boolean };

/**
 * Cache first; on a miss check the limits (per IP, then site-wide), ask the AI,
 * and store the result. Cache and limiter failures are logged and skipped
 * (fail open) so lookups keep working if Supabase is paused or down.
 */
export async function lookupCached(
  query: ParsedQuery,
  deps: LookupDeps,
  opts?: { signal?: AbortSignal },
): Promise<CachedOutcome> {
  const log = deps.log ?? ((m: string) => console.warn(m));

  if (deps.cache) {
    try {
      const hit = await deps.cache.get(query.key, deps.version);
      if (hit) return { ok: true, result: hit, cached: true };
    } catch (e) {
      log(`[cache] ${String(e)}`);
    }
  }

  if (deps.limiter) {
    try {
      const ipOk = await deps.limiter.consume(
        ipBucket(deps.ipHash),
        windowStart(deps.now, "hour"),
        deps.limits.perIpPerHour,
      );
      if (!ipOk) return { ok: false, error: "rate_limited", detail: "per-IP hourly limit" };
      const siteOk = await deps.limiter.consume(AI_BUCKET, windowStart(deps.now, "day"), deps.limits.aiPerDay);
      if (!siteOk) return { ok: false, error: "rate_limited", detail: "site-wide daily AI limit" };
    } catch (e) {
      log(`[rate-limit] ${String(e)}`);
    }
  }

  const outcome = await lookup(query, deps.provider, opts);
  if (outcome.ok && deps.cache && deps.provider) {
    try {
      await deps.cache.put(query.key, deps.version, outcome.result, `${deps.provider.name}:${deps.provider.model}`);
    } catch (e) {
      log(`[cache] ${String(e)}`);
    }
  }
  return { ...outcome, cached: false };
}
