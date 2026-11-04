import { providerFromEnv } from "@/lib/ai/groq";
import { checkOrigin, corsHeaders, parseAllowedOrigins } from "@/lib/domain/cors";
import { errorBody, errorStatus, type LookupErrorCode } from "@/lib/domain/lookup-error";
import { RESULT_VERSION } from "@/lib/domain/lookup-result";
import { parseQuery, QUERY_ERROR_MESSAGES } from "@/lib/domain/query";
import { clientIp, limitsFromEnv } from "@/lib/domain/rate-limit";
import { lookupCached } from "@/lib/lookup";
import { hashIp, SupabaseLookupCache, SupabaseRateLimiter, supabaseFromEnv } from "@/lib/supabase/server";

/**
 * GET /api/v1/lookup?q=<word, phrase, or sentence>
 * 200: LookupResult (header X-Cache: HIT | MISS)   4xx/5xx: { error: { code, message } }
 * Documented at /docs/api. Browsers on other sites need their origin in ALLOWED_ORIGINS.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const check = checkOrigin(origin, url.origin, parseAllowedOrigins(process.env.ALLOWED_ORIGINS));
  const cors = corsHeaders(origin, check);
  if (check === "forbidden") return fail("forbidden_origin", cors);

  const parsed = parseQuery(url.searchParams.get("q") ?? "");
  if (!parsed.ok) {
    return fail("invalid_query", cors, QUERY_ERROR_MESSAGES[parsed.error]);
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
    return fail(outcome.error, cors);
  }
  return Response.json(outcome.result, {
    headers: { ...cors, "Cache-Control": "no-store", "X-Cache": outcome.cached ? "HIT" : "MISS" },
  });
}

/** CORS preflight. Simple GETs don't need it, but some clients send one anyway. */
export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  const check = checkOrigin(origin, new URL(request.url).origin, parseAllowedOrigins(process.env.ALLOWED_ORIGINS));
  if (check === "forbidden") return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: { ...corsHeaders(origin, check), Allow: "GET, OPTIONS" } });
}

function fail(code: LookupErrorCode, cors: Record<string, string>, message?: string) {
  return Response.json(errorBody(code, message), {
    status: errorStatus(code),
    headers: { ...cors, "Cache-Control": "no-store" },
  });
}
