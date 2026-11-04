/**
 * Which browser origins may call the public API (pure).
 * Same-origin requests (this site) are always fine. Other sites must be listed in
 * ALLOWED_ORIGINS (comma-separated, e.g. "https://my-blog.vercel.app"), or "*" for anyone.
 * Server-to-server calls send no Origin header and are allowed (rate limits still apply).
 */

export type OriginCheck = "no_origin" | "same_origin" | "allowed" | "forbidden";

/** "https://Example.com/" -> "https://example.com"; invalid -> null. */
export function normalizeOrigin(value: string): string | null {
  const v = value.trim();
  if (v === "*") return "*";
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function parseAllowedOrigins(env: string | undefined): string[] {
  if (!env) return [];
  return [...new Set(env.split(",").map(normalizeOrigin).filter((o): o is string => o !== null))];
}

export function checkOrigin(origin: string | null, selfOrigin: string, allowed: readonly string[]): OriginCheck {
  if (origin === null || origin === "") return "no_origin";
  const o = normalizeOrigin(origin);
  if (o === null || o === "*") return "forbidden"; // "null" (file://, sandboxed iframes) or junk
  if (o === normalizeOrigin(selfOrigin)) return "same_origin";
  if (allowed.includes("*") || allowed.includes(o)) return "allowed";
  return "forbidden";
}

/** Response headers for a cross-origin caller; empty unless the origin is allowed. */
export function corsHeaders(origin: string | null, check: OriginCheck): Record<string, string> {
  if (check !== "allowed" || !origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Expose-Headers": "X-Cache",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
