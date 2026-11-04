import { providerFromEnv } from "@/lib/ai/groq";
import { errorBody, errorStatus, type LookupErrorCode } from "@/lib/domain/lookup-error";
import { RESULT_VERSION } from "@/lib/domain/lookup-result";
import { parseQuery, QUERY_ERROR_MESSAGES } from "@/lib/domain/query";
import { clientIp, limitsFromEnv } from "@/lib/domain/rate-limit";
import { lookupCached } from "@/lib/lookup";
import { hashIp, SupabaseLookupCache, SupabaseRateLimiter, supabaseFromEnv } from "@/lib/supabase/server";

/**
 * GET /api/v1/lookup?q=<word, phrase, or sentence>
 * 200: LookupResult (header X-Cache: HIT | MISS)   4xx/5xx: { error: { code, message } }
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const parsed = parseQuery(q);
  if (!parsed.ok) {
    return fail("invalid_query", QUERY_ERROR_MESSAGES[parsed.error]);
  }

  const db = supabaseFromEnv();
  const outcome = await lookupCached(
    parsed.query,
    {
      provider: providerFromEnv(),
      cache: db && new SupabaseLookupCache(db),
      limiter: db && new SupabaseRateLimiter(db),
      limits: limitsFromEnv(process.env),
      ipHash: hashIp(clientIp(request.headers)),
      now: new Date(),
      version: RESULT_VERSION,
    },
    { signal: request.signal },
  );

  if (!outcome.ok) {
    if (outcome.error !== "not_found") {
      console.error(`[lookup] ${outcome.error} for ${JSON.stringify(parsed.query.key)}: ${outcome.detail ?? ""}`);
    }
    return fail(outcome.error);
  }
  return Response.json(outcome.result, {
    headers: { "Cache-Control": "no-store", "X-Cache": outcome.cached ? "HIT" : "MISS" },
  });
}

function fail(code: LookupErrorCode, message?: string) {
  return Response.json(errorBody(code, message), {
    status: errorStatus(code),
    headers: { "Cache-Control": "no-store" },
  });
}
