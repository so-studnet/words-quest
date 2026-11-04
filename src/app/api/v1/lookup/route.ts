import { providerFromEnv } from "@/lib/ai/groq";
import { errorBody, errorStatus, type LookupErrorCode } from "@/lib/domain/lookup-error";
import { parseQuery, QUERY_ERROR_MESSAGES } from "@/lib/domain/query";
import { lookup } from "@/lib/lookup";

/**
 * GET /api/v1/lookup?q=<word, phrase, or sentence>
 * 200: LookupResult   4xx/5xx: { error: { code, message } }
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const parsed = parseQuery(q);
  if (!parsed.ok) {
    return fail("invalid_query", QUERY_ERROR_MESSAGES[parsed.error]);
  }

  const outcome = await lookup(parsed.query, providerFromEnv(), { signal: request.signal });
  if (!outcome.ok) {
    if (outcome.error !== "not_found") {
      console.error(`[lookup] ${outcome.error} for ${JSON.stringify(parsed.query.key)}: ${outcome.detail ?? ""}`);
    }
    return fail(outcome.error);
  }
  return Response.json(outcome.result, {
    headers: { "Cache-Control": "no-store" },
  });
}

function fail(code: LookupErrorCode, message?: string) {
  return Response.json(errorBody(code, message), {
    status: errorStatus(code),
    headers: { "Cache-Control": "no-store" },
  });
}
