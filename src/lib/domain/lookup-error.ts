/** Error codes shared by the lookup service, the API, and the UI. */
export type LookupErrorCode =
  | "invalid_query"
  | "not_found"
  | "rate_limited"
  | "not_configured"
  | "upstream_error"
  | "invalid_response";

export type ApiErrorBody = { error: { code: LookupErrorCode; message: string } };

const ERRORS: Record<LookupErrorCode, { status: number; message: string }> = {
  invalid_query: { status: 400, message: "Type a word, phrase, or sentence in English." },
  not_found: { status: 404, message: "No entry found. Check the spelling and try again." },
  rate_limited: { status: 429, message: "Too many lookups right now. Please try again later." },
  not_configured: { status: 503, message: "The lookup service is not set up yet." },
  upstream_error: { status: 502, message: "The lookup service is unavailable. Please try again." },
  invalid_response: { status: 502, message: "Could not read the answer. Please try again." },
};

export function errorStatus(code: LookupErrorCode): number {
  return ERRORS[code].status;
}

export function errorBody(code: LookupErrorCode, message?: string): ApiErrorBody {
  return { error: { code, message: message ?? ERRORS[code].message } };
}

export function isApiErrorBody(v: unknown): v is ApiErrorBody {
  if (typeof v !== "object" || v === null) return false;
  const e = (v as { error?: unknown }).error;
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as { code?: unknown }).code === "string" &&
    (e as { code: string }).code in ERRORS &&
    typeof (e as { message?: unknown }).message === "string"
  );
}
