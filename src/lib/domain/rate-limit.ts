/**
 * Rate-limit rules (pure). Counting happens in the DB (consume_quota).
 * Only AI calls are limited; cached results are free and unlimited.
 */

export const DEFAULT_LIMITS = {
  /** AI lookups per IP address per hour. */
  perIpPerHour: 30,
  /** AI lookups for the whole site per day (UTC), kept under Groq's free quota. */
  aiPerDay: 500,
} as const;

export type Limits = { perIpPerHour: number; aiPerDay: number };

function intFrom(v: string | undefined, fallback: number): number {
  if (v === undefined || v.trim() === "") return fallback;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/** Limits from RATE_LIMIT_PER_HOUR / AI_DAILY_LIMIT, falling back to the defaults. */
export function limitsFromEnv(env: Record<string, string | undefined>): Limits {
  return {
    perIpPerHour: intFrom(env.RATE_LIMIT_PER_HOUR, DEFAULT_LIMITS.perIpPerHour),
    aiPerDay: intFrom(env.AI_DAILY_LIMIT, DEFAULT_LIMITS.aiPerDay),
  };
}

/** Start of the UTC hour / day containing `now`. */
export function windowStart(now: Date, unit: "hour" | "day"): Date {
  const d = new Date(now.getTime());
  d.setUTCMinutes(0, 0, 0);
  if (unit === "day") d.setUTCHours(0);
  return d;
}

/**
 * The client's IP. On Vercel, x-forwarded-for is set by the platform and its first
 * entry is the client. Falls back to x-real-ip, then "unknown" (all share one bucket).
 */
export function clientIp(headers: Headers): string {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (first) return first;
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export const ipBucket = (ipHash: string) => `ip:${ipHash}`;
export const AI_BUCKET = "ai";
